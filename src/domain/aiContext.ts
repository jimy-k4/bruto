import type { ContextScope, Note, Workspace } from '../types'
import { CLOSED_STATUSES } from './constants'
import { getConnectedNoteIds, noteTitle, shortId } from './workspace'

/**
 * How an AI should work with what it receives. Kept short: it is prepended to
 * every copy, so both agents with file access and plain chats know what to do.
 */
const INSTRUCTIONS = [
  '## HOW TO USE THIS CONTEXT',
  '',
  '- Notes are tasks. Refer to a note by its short id, e.g. [a1b2c3].',
  '- With file access: notes live in `.bruto/workspace.json` (keep it valid JSON). Find a note by the start of its `id`. When you finish one, write what you did in its `aiResponse` and set `status` to "review". Never delete notes or change `x`, `y` or `zIndex`.',
  '- Without file access: answer note by note, starting each answer with its id.',
  '- "Feedback" is what the user found wrong after reviewing a previous answer: address it first.',
]

const DOCUMENTATION_LABELS = {
  obsidian: 'OBSIDIAN',
  notion: 'NOTION',
  web: 'WEB',
  other: 'OTHER',
} as const

const ref = (note: Note) => `[${shortId(note.id)}] ${noteTitle(note)}`

const quote = (text: string) =>
  text
    .trim()
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')

function describeNote(note: Note): string[] {
  const lines = [`### ${ref(note)}`]

  if (note.status) lines.push(`Status: ${note.status}`)
  if (note.description.trim()) lines.push('', note.description.trim())

  if (note.filePaths.length > 0) {
    lines.push('', 'Files:', ...note.filePaths.map((path) => `- ${path}`))
  }

  if (note.webUrl.trim()) lines.push('', `Web: ${note.webUrl.trim()}`)

  if (note.images.length > 0) {
    lines.push('', 'Images:', ...note.images.map((path) => `- ${path}`))
  }

  if (note.aiResponse?.trim()) lines.push('', 'AI response:', quote(note.aiResponse))
  if (note.feedback?.trim()) lines.push('', 'Feedback:', quote(note.feedback))

  return lines
}

/** Which notes a copy includes: the selection, its connected graph, or everything. */
export function getContextNoteIds(
  workspace: Workspace,
  scope: ContextScope,
  selectedIds: string[],
): Set<string> {
  if (scope === 'entire') {
    return new Set(workspace.notes.map((note) => note.id))
  }

  if (scope === 'current') {
    return new Set(selectedIds)
  }

  const ids = new Set<string>()

  for (const id of selectedIds) {
    for (const connected of getConnectedNoteIds(workspace, id)) ids.add(connected)
  }

  return ids
}

/** Builds the Markdown copied into AI chats. */
export function buildAiContext(
  workspace: Workspace,
  scope: ContextScope,
  selectedIds: string[],
): string {
  const includedIds = getContextNoteIds(workspace, scope, selectedIds)
  const included = workspace.notes.filter((note) => includedIds.has(note.id))
  const isClosed = (note: Note) => Boolean(note.status && CLOSED_STATUSES.includes(note.status))

  // In a full copy, finished work is listed briefly so it doesn't drown the rest.
  const detailed = scope === 'entire' ? included.filter((note) => !isClosed(note)) : included
  const closed = scope === 'entire' ? included.filter(isClosed) : []

  const lines: string[] = [`# PROJECT CONTEXT: ${workspace.title}`]

  if (workspace.description.trim()) lines.push('', workspace.description.trim())

  lines.push('', ...INSTRUCTIONS)

  if (workspace.documentation.length > 0) {
    lines.push(
      '',
      '## DOCUMENTATION',
      '',
      ...workspace.documentation.map(
        (item) => `- [${DOCUMENTATION_LABELS[item.type]}] ${item.name}: ${item.url}`,
      ),
    )
  }

  if (workspace.aiContext.trim()) {
    lines.push('', '## GLOBAL AI CONTEXT', '', workspace.aiContext.trim())
  }

  lines.push('', '## NOTES')

  const roots = workspace.notes.filter((note) => selectedIds.includes(note.id))

  if (scope === 'current' && roots.length > 1) {
    lines.push('', `Scope: ${roots.length} selected notes.`)
  }

  if (scope === 'connected' && roots.length > 0) {
    lines.push('', `Scope: notes connected from ${roots.map(ref).join(', ')}.`)
  }

  if (detailed.length === 0) {
    lines.push('', '_No open notes._')
  }

  for (const note of detailed) {
    lines.push('', ...describeNote(note))
  }

  const relationships = describeRelationships(workspace, includedIds)

  if (relationships.length > 0) {
    lines.push('', '## RELATIONSHIPS', '', ...relationships)
  }

  if (closed.length > 0) {
    lines.push(
      '',
      '## CLOSED NOTES',
      '',
      ...closed.map((note) => `- ${ref(note)} (${note.status})`),
    )
  }

  return lines.join('\n')
}

function describeRelationships(workspace: Workspace, includedIds: Set<string>): string[] {
  const notesById = new Map(workspace.notes.map((note) => [note.id, note]))
  const pairs = new Set(
    workspace.connections.map((connection) => `${connection.from}>${connection.to}`),
  )
  const written = new Set<string>()
  const lines: string[] = []

  for (const connection of workspace.connections) {
    const from = notesById.get(connection.from)
    const to = notesById.get(connection.to)

    if (!from || !to || !includedIds.has(from.id) || !includedIds.has(to.id)) continue

    const key = [from.id, to.id].sort().join('|')

    if (written.has(key)) continue

    written.add(key)

    const bothWays = pairs.has(`${to.id}>${from.id}`)

    lines.push(`- ${ref(from)} ${bothWays ? '<->' : '->'} ${ref(to)}`)
  }

  return lines
}
