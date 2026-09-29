import { isAbsolute, relative } from 'node:path'
import type { Note, NoteStatus, Point, Workspace } from '../../src/types'
import { buildAiContext, describeNote } from '../../src/domain/aiContext'
import { CLOSED_STATUSES, NOTE_MIN_SIZE } from '../../src/domain/constants'
import { searchNotes as findNotes } from '../../src/domain/search'
import {
  addConnection,
  createNote,
  noteTitle,
  shortId,
  updateNotes,
  type NotePatch,
} from '../../src/domain/workspace'
import { BoardError, changeBoard, readBoard, resolveNote } from './board'

/**
 * What the MCP tools do, as plain functions over a project folder. Each one
 * returns the text the model reads back.
 */

const ref = (note: Note) => `[${shortId(note.id)}] ${noteTitle(note)}`
const isClosed = (note: Note) => Boolean(note.status && CLOSED_STATUSES.includes(note.status))
const byReadingOrder = (a: Note, b: Note) => a.y - b.y || a.x - b.x

/** Paths as the board keeps them: relative to the project, with forward slashes. */
function projectPath(root: string, path: string): string {
  const inside = isAbsolute(path) ? relative(root, path) : path

  return inside.replace(/\\/g, '/').replace(/^\.\//, '')
}

const unique = (items: string[]) => [...new Set(items.filter(Boolean))]

export function listNotes(
  root: string,
  { statuses, includeClosed = false }: { statuses?: NoteStatus[]; includeClosed?: boolean } = {},
): string {
  const workspace = readBoard(root)
  const notes = workspace.notes
    .filter((note) =>
      statuses?.length
        ? Boolean(note.status && statuses.includes(note.status))
        : includeClosed || !isClosed(note),
    )
    .sort(byReadingOrder)
  const header = [`# ${workspace.title}`, workspace.description.trim()].filter(Boolean)

  if (notes.length === 0) return [...header, '', 'No notes match.'].join('\n')

  return [
    ...header,
    '',
    ...notes.map((note) => `- ${ref(note)} — ${note.status ?? 'no status'}`),
    '',
    'Read one with get_note, or everything the AI needs with get_context.',
  ].join('\n')
}

export function searchNotes(
  root: string,
  { query = '', statuses = [] }: { query?: string; statuses?: NoteStatus[] },
): string {
  const workspace = readBoard(root)
  const found = findNotes(workspace.notes, { query, statuses })

  if (found.length === 0) return 'No notes match.'

  return found.map((note) => `- ${ref(note)} — ${note.status ?? 'no status'}`).join('\n')
}

/**
 * Marks where a note stands, without answering it: "in-progress" when you
 * start on it, so the user sees on the board what is being worked on.
 */
export function setStatus(
  root: string,
  { id, status }: { id: string; status: NoteStatus },
): string {
  let changed: Note | undefined

  changeBoard(root, (workspace) => {
    const note = resolveNote(workspace, id)

    if (note.status === 'loop' || status === 'loop') {
      throw new BoardError(
        `Standing rules (status "loop") are set by the user only: ${ref(note)} keeps its status.`,
      )
    }

    changed = note

    return updateNotes(workspace, [note.id], { status })
  })

  return `${ref(changed!)} is now "${status}".`
}

export function getContext(
  root: string,
  { ids = [], withConnections = false }: { ids?: string[]; withConnections?: boolean } = {},
): string {
  const workspace = readBoard(root)

  if (ids.length === 0) return buildAiContext(workspace, 'entire', [])

  const selected = ids.map((id) => resolveNote(workspace, id).id)

  return buildAiContext(workspace, withConnections ? 'connected' : 'current', selected)
}

export function getNote(root: string, id: string): string {
  const workspace = readBoard(root)
  const note = resolveNote(workspace, id)
  const refsOf = (ids: string[]) =>
    ids
      .map((other) => workspace.notes.find((item) => item.id === other))
      .filter((item): item is Note => Boolean(item))
      .map(ref)
  const pointsTo = refsOf(
    workspace.connections.filter((link) => link.from === note.id).map((link) => link.to),
  )
  const pointedFrom = refsOf(
    workspace.connections.filter((link) => link.to === note.id).map((link) => link.from),
  )

  return [
    ...describeNote(note),
    ...(pointsTo.length ? ['', `Points to: ${pointsTo.join(', ')}`] : []),
    ...(pointedFrom.length ? ['', `Pointed from: ${pointedFrom.join(', ')}`] : []),
  ].join('\n')
}

export function answerNote(
  root: string,
  {
    id,
    response,
    files = [],
    status = 'review',
    append = false,
  }: { id: string; response: string; files?: string[]; status?: NoteStatus; append?: boolean },
): string {
  let answered: Note | undefined

  changeBoard(root, (workspace) => {
    const note = resolveNote(workspace, id)

    if (note.status === 'loop') {
      throw new BoardError(
        `${ref(note)} is a standing rule (status "loop"): apply it on every task, but never answer it or change its status.`,
      )
    }

    const patch: NotePatch = {
      aiResponse:
        append && note.aiResponse?.trim() ? `${note.aiResponse.trim()}\n\n${response}` : response,
      aiFilePaths: unique([
        ...(note.aiFilePaths ?? []),
        ...files.map((path) => projectPath(root, path)),
      ]),
      status,
    }

    // The feedback was what to fix; once answered, it's done with.
    if (note.status === 'changes-requested') patch.feedback = ''

    answered = { ...note, ...patch }

    return updateNotes(workspace, [note.id], patch)
  })

  return `${ref(answered!)} is now "${status}" with your answer${
    files.length ? ` and ${files.length} file(s) you touched` : ''
  }. The user sees it on the board right away.`
}

/** A free spot for a new note: right of the one it follows, or under everything. */
function freeSpot(workspace: Workspace, after?: Note): Point {
  const gap = 40
  const spot = after
    ? { x: after.x + NOTE_MIN_SIZE.width + 80, y: after.y }
    : {
        x: workspace.notes.length ? Math.min(...workspace.notes.map((note) => note.x)) : 60,
        y: workspace.notes.length ? Math.max(...workspace.notes.map((note) => note.y)) + 260 : 60,
      }
  const taken = (point: Point) =>
    workspace.notes.some(
      (note) =>
        Math.abs(note.x - point.x) < NOTE_MIN_SIZE.width && Math.abs(note.y - point.y) < gap * 4,
    )

  while (taken(spot)) spot.y += NOTE_MIN_SIZE.height + gap

  return spot
}

export function createNoteTool(
  root: string,
  {
    title,
    description = '',
    status = 'idea',
    files = [],
    links = [],
    after,
  }: {
    title: string
    description?: string
    status?: NoteStatus
    files?: string[]
    links?: string[]
    after?: string
  },
): string {
  let created: Note | undefined

  changeBoard(
    root,
    (workspace) => {
      const previous = after ? resolveNote(workspace, after) : undefined
      const result = createNote(workspace, freeSpot(workspace, previous), title.trim(), status)
      let next = updateNotes(result.workspace, [result.note.id], {
        description,
        filePaths: unique(files.map((path) => projectPath(root, path))),
        webUrls: unique(links.map((link) => link.trim())),
      })

      if (previous) next = addConnection(next, previous.id, result.note.id)

      created = result.note

      return next
    },
    { createIfMissing: true },
  )

  return `Created ${ref(created!)} as "${status}"${after ? `, connected from [${after.replace(/^\[|\]$/g, '')}]` : ''}.`
}

export function connectNotes(root: string, { from, to }: { from: string; to: string }): string {
  let message = ''

  changeBoard(root, (workspace) => {
    const source = resolveNote(workspace, from)
    const target = resolveNote(workspace, to)

    if (source.id === target.id) throw new BoardError('A note cannot point at itself.')

    message = `${ref(source)} now points to ${ref(target)}.`

    return addConnection(workspace, source.id, target.id)
  })

  return message
}
