import type {
  AgentAction,
  AgentStamp,
  Connection,
  DocumentationType,
  Note,
  NoteKind,
  NoteStatus,
  Point,
  StatusStyleConfig,
  StatusStyles,
  StyleKey,
  Workspace,
  WorkspaceDocumentation,
} from '../types'
import {
  CLOSED_STATUSES,
  DUPLICATE_OFFSET,
  KIND_STYLE_KEY,
  STYLE_KEYS,
  WORKSPACE_VERSION,
  isNoteColor,
  isNoteKind,
  isNotePattern,
  isNoteStatus,
} from './constants'
import { normalizeCrossLinks } from './crossLinks'

/** Thrown when `workspace.json` can't be understood. The message is shown to the user. */
export class WorkspaceFormatError extends Error {
  name = 'WorkspaceFormatError'
}

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback

const asNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const asStringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

const AGENT_ACTIONS: readonly AgentAction[] = ['answer', 'status', 'create']

/** Who changed a note through MCP, if the file says so in a shape Bruto understands. */
function normalizeAgentStamp(value: unknown): AgentStamp | undefined {
  if (!isRecord(value)) return undefined

  const client = asString(value.client).trim()
  const at = asString(value.at)
  const action = AGENT_ACTIONS.find((item) => item === value.action)

  if (!client || !action || Number.isNaN(Date.parse(at))) return undefined

  const stamp: AgentStamp = { client, action, at }
  const version = asString(value.version).trim()
  const id = asString(value.id).trim()

  if (version) stamp.version = version
  if (id) stamp.id = id

  const reverted = Array.isArray(value.reverted)
    ? value.reverted.filter(isRecord).flatMap((item) => {
        const field = asString(item.field).trim()
        const replaced = asString(item.value)

        return field ? [replaced ? { field, value: replaced } : { field }] : []
      })
    : []

  if (reverted.length > 0) {
    stamp.reverted = reverted
    if (!Number.isNaN(Date.parse(asString(value.revertedAt)))) {
      stamp.revertedAt = asString(value.revertedAt)
    }
  }

  return stamp
}

/** How much of a replaced value is worth repeating to the agent. */
const REVERTED_VALUE_LENGTH = 120

/**
 * Marks, on the agent's stamp, the fields of its change that the user's edit
 * replaced: the agent reads it next time, instead of believing it went through.
 * Only when the other side of the conflict was that agent's own write.
 */
export function markReverted(
  workspace: Workspace,
  base: Workspace,
  conflicts: { noteId: string; field: string; replaced: unknown }[],
  at = new Date().toISOString(),
): Workspace {
  const byNote = new Map<string, typeof conflicts>()

  for (const conflict of conflicts) {
    byNote.set(conflict.noteId, [...(byNote.get(conflict.noteId) ?? []), conflict])
  }

  return {
    ...workspace,
    notes: workspace.notes.map((note) => {
      const found = byNote.get(note.id)
      const before = base.notes.find((item) => item.id === note.id)

      // A stamp that was already there wasn't this change's: another tool wrote it.
      if (!found || !note.agent || JSON.stringify(note.agent) === JSON.stringify(before?.agent)) {
        return note
      }

      const reverted = found
        .filter((conflict) => conflict.field !== 'agent')
        .map(({ field, replaced }) =>
          typeof replaced === 'string' && replaced.length <= REVERTED_VALUE_LENGTH
            ? { field, value: replaced }
            : { field },
        )

      return reverted.length > 0
        ? { ...note, agent: { ...note.agent, reverted, revertedAt: at } }
        : note
    }),
  }
}

/** Links from `webUrls` and the older single `webUrl`, without blanks or repeats. */
const normalizeLinks = (raw: UnknownRecord) => [
  ...new Set(
    [...asStringList(raw.webUrls), asString(raw.webUrl)].map((link) => link.trim()).filter(Boolean),
  ),
]

/** Words other tools (or people) write for a status, mapped to Bruto's statuses. */
const STATUS_ALIASES: Record<string, NoteStatus> = {
  pending: 'todo',
  pendiente: 'todo',
  'to-do': 'todo',
  'por hacer': 'todo',
  doing: 'in-progress',
  'in progress': 'in-progress',
  wip: 'in-progress',
  'en curso': 'in-progress',
  completed: 'done',
  complete: 'done',
  hecho: 'done',
  finished: 'done',
  revision: 'review',
  revisión: 'review',
  'por revisar': 'review',
  bloqueado: 'blocked',
  // Until v3 "issue" meant "reviewed, with problems".
  issue: 'changes-requested',
  'changes requested': 'changes-requested',
  rework: 'changes-requested',
  'a corregir': 'changes-requested',
}

/**
 * Words for a kind, in `kind` or, as files up to v3 have it, in `status`:
 * "bug" and "loop" were statuses before they became kinds.
 */
const KIND_ALIASES: Record<string, NoteKind> = {
  bug: 'bug',
  error: 'bug',
  rule: 'rule',
  regla: 'rule',
  loop: 'rule',
  bucle: 'rule',
  always: 'rule',
  siempre: 'rule',
}

const kindWord = (value: unknown): NoteKind | undefined =>
  typeof value === 'string' ? KIND_ALIASES[value.trim().toLowerCase()] : undefined

function normalizeStatus(value: unknown): NoteStatus | undefined {
  if (isNoteStatus(value)) {
    return value
  }

  return typeof value === 'string' ? STATUS_ALIASES[value.trim().toLowerCase()] : undefined
}

function normalizeNote(raw: UnknownRecord, index: number): Note {
  // A v3 bug was a status: it becomes a bug still to do. A v3 rule had no other status.
  const statusKind = kindWord(raw.status)
  const kind = isNoteKind(raw.kind) ? raw.kind : (kindWord(raw.kind) ?? statusKind)
  const status = statusKind
    ? statusKind === 'bug'
      ? 'todo'
      : undefined
    : normalizeStatus(raw.status)
  const aiResponse = asString(raw.aiResponse)
  const feedback = asString(raw.feedback)
  const aiFilePaths = asStringList(raw.aiFilePaths)
  const crossLinks = normalizeCrossLinks(raw.crossLinks)
  const agent = normalizeAgentStamp(raw.agent)

  // Unknown fields are kept so other tools never lose data through Bruto.
  const note: Note = {
    ...raw,
    id: asString(raw.id) || crypto.randomUUID(),
    title: asString(raw.title),
    description: asString(raw.description),
    filePaths: asStringList(raw.filePaths),
    webUrls: normalizeLinks(raw),
    images: asStringList(raw.images),
    x: asNumber(raw.x, 200 + index * 25),
    y: asNumber(raw.y, 150 + index * 25),
    zIndex: asNumber(raw.zIndex, index + 1),
    colorTheme: isNoteColor(raw.colorTheme) ? raw.colorTheme : 'concrete',
    pattern: isNotePattern(raw.pattern) ? raw.pattern : 'raw',
  }

  // One link used to be `webUrl`: it becomes the first of the list.
  Reflect.deleteProperty(note, 'webUrl')
  delete note.status
  delete note.kind
  delete note.aiResponse
  delete note.feedback
  delete note.aiFilePaths
  delete note.crossLinks
  delete note.agent
  delete note.agentAccess

  if (status) note.status = status
  if (kind) note.kind = kind
  if (aiResponse.trim()) note.aiResponse = aiResponse
  if (aiFilePaths.length > 0) note.aiFilePaths = aiFilePaths
  if (feedback.trim()) note.feedback = feedback
  if (crossLinks.length > 0) note.crossLinks = crossLinks
  if (agent) note.agent = agent
  if (raw.agentAccess === 'read') note.agentAccess = 'read'

  return note
}

function normalizeStatusStyles(value: unknown): StatusStyles | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const styles: StatusStyles = {}

  for (const key of STYLE_KEYS) {
    // The old "issue" status became "changes-requested": keep its look.
    const config = value[key] ?? (key === 'changes-requested' ? value.issue : undefined)

    if (!isRecord(config)) continue

    const entry: StatusStyleConfig = {}

    if (isNoteColor(config.color)) entry.color = config.color
    if (isNotePattern(config.pattern)) entry.pattern = config.pattern
    if (entry.color || entry.pattern) styles[key] = entry
  }

  return Object.keys(styles).length > 0 ? styles : undefined
}

const DOCUMENTATION_TYPES: readonly DocumentationType[] = ['obsidian', 'notion', 'web', 'other']

function normalizeDocumentation(raw: UnknownRecord): WorkspaceDocumentation {
  const type = DOCUMENTATION_TYPES.find((item) => item === raw.type) ?? 'other'

  return {
    ...raw,
    id: asString(raw.id) || crypto.randomUUID(),
    name: asString(raw.name),
    url: asString(raw.url),
    type,
  }
}

/**
 * Turns anything read from disk into a valid workspace, filling defaults and
 * migrating old versions. Lenient on purpose: an AI editing the file by hand
 * should never make Bruto refuse it over a missing field.
 */
export function normalizeWorkspace(raw: unknown, fallbackTitle = 'BRUTO'): Workspace {
  if (!isRecord(raw)) {
    throw new WorkspaceFormatError('workspace.json must contain a JSON object.')
  }

  for (const key of ['notes', 'connections', 'documentation'] as const) {
    if (raw[key] !== undefined && !Array.isArray(raw[key])) {
      throw new WorkspaceFormatError(`"${key}" must be a list.`)
    }
  }

  const notes = ((raw.notes as unknown[] | undefined) ?? []).filter(isRecord).map(normalizeNote)

  const noteIds = new Set(notes.map((note) => note.id))

  const connections = ((raw.connections as unknown[] | undefined) ?? [])
    .filter(isRecord)
    .map((connection): Connection => ({
      ...connection,
      id: asString(connection.id) || crypto.randomUUID(),
      from: asString(connection.from),
      to: asString(connection.to),
    }))
    .filter(
      (connection) =>
        noteIds.has(connection.from) &&
        noteIds.has(connection.to) &&
        connection.from !== connection.to,
    )

  const version = asNumber(raw.version, 1)
  const statusStyles = normalizeStatusStyles(raw.statusStyles)

  const workspace: Workspace = {
    ...raw,
    version: Math.max(version, WORKSPACE_VERSION),
    title: asString(raw.title) || fallbackTitle,
    description: asString(raw.description),
    aiContext: asString(raw.aiContext),
    documentation: ((raw.documentation as unknown[] | undefined) ?? [])
      .filter(isRecord)
      .map(normalizeDocumentation),
    notes: dedupeById(notes),
    connections: dedupeConnections(connections),
  }

  delete workspace.statusStyles
  if (statusStyles) workspace.statusStyles = statusStyles

  // Up to v2 the status style overrode the note's own look at render time.
  // From v3 it is applied when the status changes, so bake it in once to keep
  // every note looking exactly as it did.
  if (version < 3 && statusStyles) {
    workspace.notes = workspace.notes.map((note) =>
      note.status ? { ...note, ...styleFor(note.status, statusStyles) } : note,
    )
  } else if (statusStyles) {
    workspace.notes = workspace.notes.map((note) => restyleIfStale(note, statusStyles))
  }

  return workspace
}

const DEFAULT_LOOK = { colorTheme: 'concrete', pattern: 'raw' } as const

function looksLike(note: Pick<Note, 'colorTheme' | 'pattern'>, config: StatusStyleConfig) {
  return (
    Boolean(config.color || config.pattern) &&
    (!config.color || note.colorTheme === config.color) &&
    (!config.pattern || note.pattern === config.pattern)
  )
}

/**
 * A tool may change a note's status while Bruto is closed, leaving the note
 * with the look of its previous status. A note still wearing an automatic look
 * (another status's, or the default one) gets the look of its current status;
 * a look chosen by hand is left alone.
 */
function restyleIfStale(note: Note, styles: StatusStyles): Note {
  const current = note.status ? styles[note.status] : undefined
  const kindLook = note.kind ? styles[KIND_STYLE_KEY[note.kind]] : undefined

  if (!note.status || !current || looksLike(note, current)) return note
  if (kindLook && looksLike(note, kindLook)) return note

  const automatic =
    (note.colorTheme === DEFAULT_LOOK.colorTheme && note.pattern === DEFAULT_LOOK.pattern) ||
    Object.entries(styles).some(
      ([status, config]) => status !== note.status && config && looksLike(note, config),
    )

  return automatic ? { ...note, ...styleFor(note.status, styles) } : note
}

export function parseWorkspace(text: string, fallbackTitle?: string): Workspace {
  let raw: unknown

  try {
    raw = JSON.parse(text)
  } catch (error) {
    throw new WorkspaceFormatError(error instanceof Error ? error.message : String(error))
  }

  return normalizeWorkspace(raw, fallbackTitle)
}

export function serializeWorkspace(workspace: Workspace): string {
  return `${JSON.stringify(workspace, null, 2)}\n`
}

export function createEmptyWorkspace(title: string): Workspace {
  return {
    version: WORKSPACE_VERSION,
    title,
    description: '',
    aiContext: '',
    documentation: [],
    notes: [],
    connections: [],
  }
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()

  return items.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)))
}

function dedupeConnections(connections: Connection[]): Connection[] {
  const seen = new Set<string>()

  return dedupeById(connections).filter((connection) => {
    const key = `${connection.from}->${connection.to}`

    return seen.has(key) ? false : (seen.add(key), true)
  })
}

// ---------------------------------------------------------------------------
// Queries

export const shortId = (id: string) => id.slice(0, 6)

/** The links of a note that have something in them: the editor keeps blank ones while typing. */
export const noteLinks = (note: Pick<Note, 'webUrls'>) =>
  (note.webUrls ?? []).map((link) => link.trim()).filter(Boolean)

export const noteTitle = (note: Pick<Note, 'title'>, untitled = 'Untitled') =>
  note.title.trim() || untitled

export function nextZIndex(workspace: Workspace): number {
  return Math.max(0, ...workspace.notes.map((note) => note.zIndex)) + 1
}

/** A rule the AI applies on every task: of kind rule, and not retired by closing it. */
export const isStandingRule = (note: Note) =>
  note.kind === 'rule' && !(note.status && CLOSED_STATUSES.includes(note.status))

export function findNote(workspace: Workspace, id: string | null | undefined): Note | undefined {
  return id ? workspace.notes.find((note) => note.id === id) : undefined
}

/** Ids of every note reachable from `startId` following connections forward. */
export function getConnectedNoteIds(workspace: Workspace, startId: string): Set<string> {
  const visited = new Set([startId])
  const queue = [startId]

  while (queue.length > 0) {
    const current = queue.shift()!

    for (const connection of workspace.connections) {
      if (connection.from === current && !visited.has(connection.to)) {
        visited.add(connection.to)
        queue.push(connection.to)
      }
    }
  }

  return visited
}

// ---------------------------------------------------------------------------
// Status styles

function styleFor(key: StyleKey, styles: StatusStyles | undefined): Partial<Note> {
  const config = styles?.[key]
  const patch: Partial<Note> = {}

  if (config?.color) patch.colorTheme = config.color
  if (config?.pattern) patch.pattern = config.pattern

  return patch
}

/**
 * Applies the configured look of the new status, or of the new kind, to every
 * note whose status or kind changed between `before` and `after`. Used both
 * for edits in the app and for changes an AI wrote straight into the file.
 */
export function applyStatusStylesToChangedNotes(before: Workspace, after: Workspace): Workspace {
  if (!after.statusStyles) {
    return after
  }

  const previous = new Map(before.notes.map((note) => [note.id, note]))
  let changed = false

  const notes = after.notes.map((note) => {
    const old = previous.get(note.id)

    if (!old) return note

    const key =
      note.kind && note.kind !== old.kind
        ? KIND_STYLE_KEY[note.kind]
        : note.status && note.status !== old.status
          ? note.status
          : undefined

    if (!key) return note

    const patch = styleFor(key, after.statusStyles)

    if (Object.keys(patch).length === 0) return note

    changed = true

    return { ...note, ...patch }
  })

  return changed ? { ...after, notes } : after
}

/** Whether a note is of the status or kind a style key stands for. */
const wears = (note: Note, key: StyleKey) =>
  note.status === key || (note.kind !== undefined && KIND_STYLE_KEY[note.kind] === key)

/**
 * Sets (or clears) the look of one status or kind. Notes of it that still use
 * the previous automatic look follow the change; notes customised by hand keep
 * their own look.
 */
export function setStatusStyle(
  workspace: Workspace,
  status: StyleKey,
  config: StatusStyleConfig | undefined,
): Workspace {
  const previous = workspace.statusStyles?.[status]
  const styles: StatusStyles = { ...workspace.statusStyles }

  if (config?.color || config?.pattern) {
    styles[status] = {
      ...(config.color && { color: config.color }),
      ...(config.pattern && { pattern: config.pattern }),
    }
  } else {
    delete styles[status]
  }

  const notes = workspace.notes.map((note) => {
    if (!wears(note, status)) return note

    const patch: Partial<Note> = {}

    if (config?.color && note.colorTheme === (previous?.color ?? note.colorTheme)) {
      patch.colorTheme = config.color
    }

    if (config?.pattern && note.pattern === (previous?.pattern ?? note.pattern)) {
      patch.pattern = config.pattern
    }

    return Object.keys(patch).length > 0 ? { ...note, ...patch } : note
  })

  const next: Workspace = { ...workspace, notes }

  if (Object.keys(styles).length > 0) {
    next.statusStyles = styles
  } else {
    delete next.statusStyles
  }

  return next
}

/**
 * Takes the look of every status from another project. Statuses it leaves
 * unstyled are cleared too, so both projects end up alike; notes still on
 * their automatic look follow, as with any change of a status style.
 */
export function replaceStatusStyles(
  workspace: Workspace,
  styles: StatusStyles | undefined,
): Workspace {
  return STYLE_KEYS.reduce(
    (next, status) => setStatusStyle(next, status, styles?.[status]),
    workspace,
  )
}

// ---------------------------------------------------------------------------
// Note operations (all pure: they return a new workspace)

export type NotePatch = Partial<Omit<Note, 'id'>>

export function createNote(
  workspace: Workspace,
  position: Point,
  title: string,
  status: NoteStatus = 'idea',
): { workspace: Workspace; note: Note } {
  const note: Note = {
    id: crypto.randomUUID(),
    title,
    description: '',
    filePaths: [],
    webUrls: [],
    images: [],
    x: Math.round(position.x),
    y: Math.round(position.y),
    zIndex: nextZIndex(workspace),
    colorTheme: 'concrete',
    pattern: 'raw',
    status,
    ...styleFor(status, workspace.statusStyles),
  }

  return { workspace: { ...workspace, notes: [...workspace.notes, note] }, note }
}

/** Updates notes. A status change also applies that status's configured look. */
export function updateNotes(workspace: Workspace, ids: string[], patch: NotePatch): Workspace {
  const targets = new Set(ids)

  const next: Workspace = {
    ...workspace,
    notes: workspace.notes.map((note) => {
      if (!targets.has(note.id)) return note

      const updated: Note = { ...note, ...patch }

      // Empty optional texts are removed so the file stays clean.
      for (const key of ['aiResponse', 'feedback'] as const) {
        if (key in patch && !updated[key]?.trim()) delete updated[key]
      }

      if ('status' in patch && !patch.status) delete updated.status
      if ('kind' in patch && !patch.kind) delete updated.kind
      if ('aiFilePaths' in patch && !updated.aiFilePaths?.length) delete updated.aiFilePaths
      if ('agentAccess' in patch && !patch.agentAccess) delete updated.agentAccess

      return updated
    }),
  }

  return 'status' in patch || 'kind' in patch
    ? applyStatusStylesToChangedNotes(workspace, next)
    : next
}

export function deleteNotes(workspace: Workspace, ids: string[]): Workspace {
  const targets = new Set(ids)

  return {
    ...workspace,
    notes: workspace.notes.filter((note) => !targets.has(note.id)),
    connections: workspace.connections.filter(
      (connection) => !targets.has(connection.from) && !targets.has(connection.to),
    ),
  }
}

/**
 * Duplicates notes (and the connections between them) next to the originals,
 * or right on top of them with a zero offset. The new ids follow the order of
 * the originals on the board.
 */
export function duplicateNotes(
  workspace: Workspace,
  ids: string[],
  titleSuffix: string,
  offset: Point = { x: DUPLICATE_OFFSET, y: DUPLICATE_OFFSET },
): { workspace: Workspace; ids: string[] } {
  const sources = workspace.notes.filter((note) => ids.includes(note.id))

  return insertNotes(
    workspace,
    sources.map((note) => ({ ...note, title: `${note.title.trim()} (${titleSuffix})`.trim() })),
    workspace.connections,
    offset,
  )
}

/**
 * Inserts copies of `notes` with fresh ids, moved by `offset`, keeping the
 * connections among them. Shared by duplicate and paste.
 */
export function insertNotes(
  workspace: Workspace,
  notes: Note[],
  connections: Connection[],
  offset: Point,
): { workspace: Workspace; ids: string[] } {
  const zStart = nextZIndex(workspace)
  const newIds = new Map(notes.map((note) => [note.id, crypto.randomUUID()]))

  const copies = notes.map((note, index) => {
    const copy: Note = {
      ...structuredClone(note),
      id: newIds.get(note.id)!,
      x: Math.round(note.x + offset.x),
      y: Math.round(note.y + offset.y),
      zIndex: zStart + index,
    }

    // The other project's note points back at the original only: a copy's link would be one-sided.
    delete copy.crossLinks

    return copy
  })

  const copiedConnections = connections
    .filter((connection) => newIds.has(connection.from) && newIds.has(connection.to))
    .map((connection) => ({
      ...connection,
      id: crypto.randomUUID(),
      from: newIds.get(connection.from)!,
      to: newIds.get(connection.to)!,
    }))

  return {
    workspace: {
      ...workspace,
      notes: [...workspace.notes, ...copies],
      connections: [...workspace.connections, ...copiedConnections],
    },
    ids: copies.map((note) => note.id),
  }
}

export function moveNotes(workspace: Workspace, positions: Map<string, Point>): Workspace {
  return {
    ...workspace,
    notes: workspace.notes.map((note) => {
      const position = positions.get(note.id)

      return position ? { ...note, x: Math.round(position.x), y: Math.round(position.y) } : note
    }),
  }
}

/** Brings notes to the front, keeping their relative stacking order. */
export function raiseNotes(workspace: Workspace, ids: string[]): Workspace {
  const targets = workspace.notes
    .filter((note) => ids.includes(note.id))
    .sort((a, b) => a.zIndex - b.zIndex)

  const top = Math.max(0, ...workspace.notes.map((note) => note.zIndex))

  // Already on top in the right order: nothing to change.
  if (targets.every((note, index) => note.zIndex === top - targets.length + 1 + index)) {
    return workspace
  }

  const zIndexes = new Map(targets.map((note, index) => [note.id, top + 1 + index]))

  return {
    ...workspace,
    notes: workspace.notes.map((note) =>
      zIndexes.has(note.id) ? { ...note, zIndex: zIndexes.get(note.id)! } : note,
    ),
  }
}

export function addConnection(workspace: Workspace, from: string, to: string): Workspace {
  const exists = workspace.connections.some(
    (connection) => connection.from === from && connection.to === to,
  )

  if (from === to || exists || !findNote(workspace, from) || !findNote(workspace, to)) {
    return workspace
  }

  return {
    ...workspace,
    connections: [...workspace.connections, { id: crypto.randomUUID(), from, to }],
  }
}

export function removeConnection(workspace: Workspace, id: string): Workspace {
  return {
    ...workspace,
    connections: workspace.connections.filter((connection) => connection.id !== id),
  }
}

export function upsertDocumentation(
  workspace: Workspace,
  documentation: WorkspaceDocumentation,
): Workspace {
  const exists = workspace.documentation.some((item) => item.id === documentation.id)

  return {
    ...workspace,
    documentation: exists
      ? workspace.documentation.map((item) => (item.id === documentation.id ? documentation : item))
      : [...workspace.documentation, documentation],
  }
}

export function removeDocumentation(workspace: Workspace, id: string): Workspace {
  return {
    ...workspace,
    documentation: workspace.documentation.filter((item) => item.id !== id),
  }
}
