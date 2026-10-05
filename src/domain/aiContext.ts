import type { ContextScope, CrossLinkKind, GhostNote, GhostZone, Note, Workspace } from '../types'
import { CLOSED_STATUSES } from './constants'
import { ghostArrows, zoneKey, type GhostEnd } from './ghosts'
import { getConnectedNoteIds, isStandingRule, noteLinks, noteTitle, shortId } from './workspace'

/**
 * How an AI should work with what it receives. Kept short: it is prepended to
 * every copy, so both agents with file access and plain chats know what to do.
 */
const INSTRUCTIONS = [
  '## HOW TO USE THIS CONTEXT',
  '',
  '- Notes are tasks. Refer to a note by its short id, e.g. [a1b2c3].',
  '- With file access: notes live in `.bruto/workspace.json` (keep it valid JSON). Find a note by the start of its `id`. When you finish one, write what you did in its `aiResponse`, add the files you created or changed to its `aiFilePaths` (paths relative to the project, keeping the ones already there) and set `status` to "review". Never delete notes or change `x`, `y` or `zIndex`.',
  '- Without file access: answer note by note, starting each answer with its id and ending it with a `Files:` line listing the files you created or changed.',
  '- Status "changes-requested" means the user reviewed your previous answer and wrote what is wrong in "Feedback": fix that first, say what you fixed in `aiResponse`, empty `feedback` and set the status back to "review".',
  '- `aiResponse` shows Markdown: headings, lists, bold, links, tables. Put commands and code the user has to run or paste inside code blocks (```): the note shows each one with a copy button.',
]

/** Only added when the project has rules, so other copies stay short. */
const RULES_INSTRUCTION =
  '- "STANDING RULES" are notes with `kind: "rule"`: apply every one of them on each task, every time, even when no note asks for it. Never answer them in `aiResponse` or change them. Notes with `kind: "bug"` are bugs; a note without a kind is a task.'

/** Only added when some note is read-only for agents. */
const READ_ONLY_INSTRUCTION =
  '- Notes marked "Agents: read only" (`agentAccess: "read"`) are there to read: never answer them or change their status.'

/** Only added when the board holds ghost zones. */
const GHOSTS_INSTRUCTION =
  '- "GHOST ZONES" are read-only copies of notes in linked projects: the notes there that lead to notes here. They are worked on in their own project: never answer, change or move them, and never edit `ghosts` in the file.'

const DOCUMENTATION_LABELS = {
  obsidian: 'OBSIDIAN',
  notion: 'NOTION',
  web: 'WEB',
  other: 'OTHER',
} as const

const ref = (note: Note) => `[${shortId(note.id)}] ${noteTitle(note)}`

const CROSS_LINK_LABELS: Record<CrossLinkKind, string> = {
  blocks: 'Blocks',
  'blocked-by': 'Blocked by',
  related: 'Related to',
}

const quote = (text: string) =>
  text
    .trim()
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')

/** A note as the AI reads it: id and title, status, text, files, links, answer and feedback. */
export function describeNote(note: Note): string[] {
  const lines = [`### ${ref(note)}`]

  if (note.kind) lines.push(`Kind: ${note.kind}`)
  if (note.status) lines.push(`Status: ${note.status}`)
  if (note.agentAccess === 'read') lines.push('Agents: read only')

  // How old it is and how often it came back from review: a loop that repeats is worth knowing.
  const history = [
    note.createdAt && `Created: ${note.createdAt.slice(0, 10)}`,
    note.sentBack && `sent back ${note.sentBack === 1 ? 'once' : `${note.sentBack} times`}`,
  ].filter(Boolean)

  if (history.length > 0) {
    const line = history.join(' · ')

    lines.push(line.charAt(0).toUpperCase() + line.slice(1))
  }

  // The agent believed this went through: say it didn't, before anything else about the note.
  if (note.agent?.reverted?.length) {
    const changes = note.agent.reverted.map((change) =>
      change.value === undefined ? change.field : `${change.field} "${change.value}"`,
    )

    lines.push(
      `Reverted: the user's edit replaced what ${note.agent.client}${note.agent.id ? ` (${note.agent.id})` : ''} wrote to ${changes.join(', ')}. The values above are the ones that stayed.`,
    )
  }
  if (note.description.trim()) lines.push('', note.description.trim())

  if (note.filePaths.length > 0) {
    lines.push('', 'Files:', ...note.filePaths.map((path) => `- ${path}`))
  }

  const links = noteLinks(note)

  if (links.length === 1) lines.push('', `Web: ${links[0]}`)
  if (links.length > 1) lines.push('', 'Web:', ...links.map((link) => `- ${link}`))

  if (note.images.length > 0) {
    lines.push('', 'Images:', ...note.images.map((path) => `- ${path}`))
  }

  if (note.aiResponse?.trim()) lines.push('', 'AI response:', quote(note.aiResponse))

  if (note.aiFilePaths?.length) {
    lines.push('', 'Files changed by the AI:', ...note.aiFilePaths.map((path) => `- ${path}`))
  }
  if (note.feedback?.trim()) lines.push('', 'Feedback:', quote(note.feedback))

  if (note.crossLinks?.length) {
    lines.push(
      '',
      'Linked notes in other projects:',
      ...note.crossLinks.map(
        (link) =>
          `- ${CROSS_LINK_LABELS[link.kind]} [${shortId(link.noteId)}] ${link.title?.trim() || 'Untitled'} in project "${link.project}"${link.status ? ` (${link.status})` : ''}`,
      ),
    )
  }

  return lines
}

/** Rough token count, to know if a copy will fit in a chat. */
export const estimateTokens = (text: string) => Math.ceil(text.length / 4)

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
  // Rules go in every copy, whatever is selected: that's what makes them rules.
  const rules = workspace.notes.filter(isStandingRule)
  const includedIds = getContextNoteIds(workspace, scope, selectedIds)
  const included = workspace.notes.filter(
    (note) => includedIds.has(note.id) && !isStandingRule(note),
  )
  const isClosed = (note: Note) => Boolean(note.status && CLOSED_STATUSES.includes(note.status))

  // In a full copy, finished work is listed briefly so it doesn't drown the rest.
  const detailed = scope === 'entire' ? included.filter((note) => !isClosed(note)) : included
  const closed = scope === 'entire' ? included.filter(isClosed) : []

  const lines: string[] = [`# PROJECT CONTEXT: ${workspace.title}`]

  if (workspace.description.trim()) lines.push('', workspace.description.trim())

  lines.push('', ...INSTRUCTIONS)
  if (rules.length > 0) lines.push(RULES_INSTRUCTION)
  if (workspace.notes.some((note) => note.agentAccess === 'read')) {
    lines.push(READ_ONLY_INSTRUCTION)
  }
  if (workspace.ghosts?.length) lines.push(GHOSTS_INSTRUCTION)

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

  if (rules.length > 0) {
    lines.push('', '## STANDING RULES')

    for (const note of rules) {
      lines.push('', ...describeNote(note))
    }
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

  for (const note of rules) includedIds.add(note.id)

  const relationships = describeRelationships(workspace, includedIds)

  if (relationships.length > 0) {
    lines.push('', '## RELATIONSHIPS', '', ...relationships)
  }

  const ghosts = describeGhostZones(workspace, scope, includedIds)

  if (ghosts.length > 0) lines.push('', ...ghosts)

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

const ghostRef = (ghost: GhostNote) => `[${shortId(ghost.id)}] ${ghost.title.trim() || 'Untitled'}`

/** A ghost as the AI reads it: what it is, briefly, in the project it belongs to. */
export function describeGhostNote(zone: GhostZone, ghost: GhostNote): string[] {
  const standing = [ghost.kind, ghost.status].filter(Boolean).join(', ')
  const lines = [`- ${ghostRef(ghost)}${standing ? ` (${standing})` : ''}`]

  if (ghost.description) lines.push(`  ${ghost.description.replace(/\s+/g, ' ')}`)
  if (ghost.files?.length) {
    lines.push(`  Files in project "${zone.project}": ${ghost.files.join(', ')}`)
  }

  return lines
}

/**
 * The ghost zones a copy needs: all of them in a full copy; otherwise those
 * linked to the notes in it, and the zones linked to those.
 */
function describeGhostZones(
  workspace: Workspace,
  scope: ContextScope,
  includedIds: Set<string>,
): string[] {
  const zones = workspace.ghosts ?? []
  const arrows = ghostArrows(workspace)
  const keys = new Set(scope === 'entire' ? zones.map(zoneKey) : [])
  const touches = (end: GhostEnd) => (end.zone ? keys.has(end.zone) : includedIds.has(end.id))

  for (let grew = scope !== 'entire'; grew;) {
    grew = false

    for (const arrow of arrows) {
      if (!touches(arrow.from) && !touches(arrow.to)) continue

      for (const end of [arrow.from, arrow.to]) {
        if (end.zone && !keys.has(end.zone)) {
          keys.add(end.zone)
          grew = true
        }
      }
    }
  }

  const shown = zones.filter((zone) => keys.has(zoneKey(zone)))

  if (shown.length === 0) return []

  const notesById = new Map(workspace.notes.map((note) => [note.id, note]))
  const zonesByKey = new Map(shown.map((zone) => [zoneKey(zone), zone]))
  const name = (end: GhostEnd) => {
    if (!end.zone) {
      const note = notesById.get(end.id)

      return note ? `${ref(note)} here` : null
    }

    const zone = zonesByKey.get(end.zone)
    const ghost = zone?.notes.find((item) => item.id === end.id)

    return zone && ghost ? `${ghostRef(ghost)} in "${zone.project}"` : null
  }

  const lines = [
    '## GHOST ZONES',
    '',
    'Notes of linked projects that lead to notes here, copied from their boards. Read only.',
  ]

  for (const zone of shown) {
    const origin = [
      zone.hops > 1 && zone.via && `through project "${zone.via}"`,
      zone.syncedAt && `copied ${zone.syncedAt.slice(0, 16).replace('T', ' ')} UTC`,
    ].filter(Boolean)
    const byId = new Map(zone.notes.map((ghost) => [ghost.id, ghost]))
    const inside = zone.connections.flatMap((connection) => {
      const from = byId.get(connection.from)
      const to = byId.get(connection.to)

      return from && to ? [`- ${ghostRef(from)} -> ${ghostRef(to)}`] : []
    })

    lines.push(
      '',
      `### From project "${zone.project}"${origin.length ? ` (${origin.join(', ')})` : ''}`,
      '',
      ...zone.notes.flatMap((ghost) => describeGhostNote(zone, ghost)),
    )
    if (inside.length > 0) lines.push('', 'Arrows:', ...inside)
  }

  const links = arrows.flatMap((arrow) => {
    const from = name(arrow.from)
    const to = name(arrow.to)

    return from && to ? [`- ${from} ${arrow.directed ? 'blocks' : 'relates to'} ${to}`] : []
  })

  if (links.length > 0) lines.push('', 'Links across projects:', ...links)

  return lines
}
