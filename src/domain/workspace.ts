import type {
  Connection,
  DocumentationType,
  Note,
  NoteStatus,
  Point,
  StatusStyleConfig,
  StatusStyles,
  Workspace,
  WorkspaceDocumentation,
} from '../types'
import {
  DUPLICATE_OFFSET,
  NOTE_STATUSES,
  WORKSPACE_VERSION,
  isNoteColor,
  isNotePattern,
  isNoteStatus,
} from './constants'

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
  bucle: 'loop',
  always: 'loop',
  siempre: 'loop',
  rule: 'loop',
  regla: 'loop',
}

function normalizeStatus(value: unknown): NoteStatus | undefined {
  if (isNoteStatus(value)) {
    return value
  }

  return typeof value === 'string' ? STATUS_ALIASES[value.trim().toLowerCase()] : undefined
}

function normalizeNote(raw: UnknownRecord, index: number): Note {
  const status = normalizeStatus(raw.status)
  const aiResponse = asString(raw.aiResponse)
  const feedback = asString(raw.feedback)
  const aiFilePaths = asStringList(raw.aiFilePaths)

  // Unknown fields are kept so other tools never lose data through Bruto.
  const note: Note = {
    ...raw,
    id: asString(raw.id) || crypto.randomUUID(),
    title: asString(raw.title),
    description: asString(raw.description),
    filePaths: asStringList(raw.filePaths),
    webUrl: asString(raw.webUrl),
    images: asStringList(raw.images),
    x: asNumber(raw.x, 200 + index * 25),
    y: asNumber(raw.y, 150 + index * 25),
    zIndex: asNumber(raw.zIndex, index + 1),
    colorTheme: isNoteColor(raw.colorTheme) ? raw.colorTheme : 'concrete',
    pattern: isNotePattern(raw.pattern) ? raw.pattern : 'raw',
  }

  delete note.status
  delete note.aiResponse
  delete note.feedback
  delete note.aiFilePaths

  if (status) note.status = status
  if (aiResponse.trim()) note.aiResponse = aiResponse
  if (aiFilePaths.length > 0) note.aiFilePaths = aiFilePaths
  if (feedback.trim()) note.feedback = feedback

  return note
}

function normalizeStatusStyles(value: unknown): StatusStyles | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const styles: StatusStyles = {}

  for (const status of NOTE_STATUSES) {
    // The old "issue" status became "changes-requested": keep its look.
    const config = value[status] ?? (status === 'changes-requested' ? value.issue : undefined)

    if (!isRecord(config)) continue

    const entry: StatusStyleConfig = {}

    if (isNoteColor(config.color)) entry.color = config.color
    if (isNotePattern(config.pattern)) entry.pattern = config.pattern
    if (entry.color || entry.pattern) styles[status] = entry
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

  if (!note.status || !current || looksLike(note, current)) return note

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

export const noteTitle = (note: Pick<Note, 'title'>, untitled = 'Untitled') =>
  note.title.trim() || untitled

export function nextZIndex(workspace: Workspace): number {
  return Math.max(0, ...workspace.notes.map((note) => note.zIndex)) + 1
}

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

function styleFor(status: NoteStatus, styles: StatusStyles | undefined): Partial<Note> {
  const config = styles?.[status]
  const patch: Partial<Note> = {}

  if (config?.color) patch.colorTheme = config.color
  if (config?.pattern) patch.pattern = config.pattern

  return patch
}

/**
 * Applies the configured look of the new status to every note whose status
 * changed between `before` and `after`. Used both for edits in the app and for
 * status changes an AI wrote straight into the file.
 */
export function applyStatusStylesToChangedNotes(before: Workspace, after: Workspace): Workspace {
  if (!after.statusStyles) {
    return after
  }

  const previousStatus = new Map(before.notes.map((note) => [note.id, note.status]))
  let changed = false

  const notes = after.notes.map((note) => {
    if (!note.status || !previousStatus.has(note.id)) return note
    if (previousStatus.get(note.id) === note.status) return note

    const patch = styleFor(note.status, after.statusStyles)

    if (Object.keys(patch).length === 0) return note

    changed = true

    return { ...note, ...patch }
  })

  return changed ? { ...after, notes } : after
}

/**
 * Sets (or clears) the look of one status. Notes of that status that still use
 * the previous automatic look follow the change; notes customised by hand keep
 * their own look.
 */
export function setStatusStyle(
  workspace: Workspace,
  status: NoteStatus,
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
    if (note.status !== status) return note

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
  return NOTE_STATUSES.reduce(
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
    webUrl: '',
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
      if ('aiFilePaths' in patch && !updated.aiFilePaths?.length) delete updated.aiFilePaths

      return updated
    }),
  }

  return 'status' in patch ? applyStatusStylesToChangedNotes(workspace, next) : next
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

/** Duplicates notes (and the connections between them) next to the originals. */
export function duplicateNotes(
  workspace: Workspace,
  ids: string[],
  titleSuffix: string,
): { workspace: Workspace; ids: string[] } {
  const sources = workspace.notes.filter((note) => ids.includes(note.id))

  return insertNotes(
    workspace,
    sources.map((note) => ({ ...note, title: `${note.title.trim()} (${titleSuffix})`.trim() })),
    workspace.connections,
    { x: DUPLICATE_OFFSET, y: DUPLICATE_OFFSET },
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

  const copies = notes.map((note, index) => ({
    ...structuredClone(note),
    id: newIds.get(note.id)!,
    x: Math.round(note.x + offset.x),
    y: Math.round(note.y + offset.y),
    zIndex: zStart + index,
  }))

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
