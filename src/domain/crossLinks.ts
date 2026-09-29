import type { CrossLink, CrossLinkKind, Note, NoteStatus, Workspace } from '../types'
import { CLOSED_STATUSES, isNoteStatus } from './constants'

export const CROSS_LINK_KINDS: readonly CrossLinkKind[] = ['blocks', 'blocked-by', 'related']

/** The same link seen from the other note: what blocks there is blocked here. */
export const INVERSE_KIND: Record<CrossLinkKind, CrossLinkKind> = {
  blocks: 'blocked-by',
  'blocked-by': 'blocks',
  related: 'related',
}

const isKind = (value: unknown): value is CrossLinkKind =>
  CROSS_LINK_KINDS.includes(value as CrossLinkKind)

/** Valid links only, one per target note: a hand-edited file never breaks the note. */
export function normalizeCrossLinks(value: unknown): CrossLink[] {
  if (!Array.isArray(value)) return []

  const links: CrossLink[] = []

  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue

    const { kind, project, projectId, noteId, title, status } = raw as Record<string, unknown>

    if (!isKind(kind) || typeof project !== 'string' || !project.trim()) continue
    if (typeof noteId !== 'string' || !noteId) continue
    if (links.some((link) => sameTarget(link, { project, noteId }))) continue

    links.push({
      kind,
      project,
      noteId,
      ...(typeof projectId === 'string' && projectId && { projectId }),
      ...(typeof title === 'string' && { title }),
      ...(isNoteStatus(status) && { status }),
    })
  }

  return links
}

type Target = Pick<CrossLink, 'project' | 'noteId'>

export const sameTarget = (a: Target, b: Target) =>
  a.noteId === b.noteId && a.project.toLowerCase() === b.project.toLowerCase()

const withLinks = (note: Note, links: CrossLink[]): Note => {
  const next = { ...note }

  if (links.length > 0) next.crossLinks = links
  else delete next.crossLinks

  return next
}

const mapNote = (workspace: Workspace, noteId: string, change: (note: Note) => Note) => ({
  ...workspace,
  notes: workspace.notes.map((note) => (note.id === noteId ? change(note) : note)),
})

/** Links a note to one in another project; linking the same target again replaces the link. */
export function addCrossLink(workspace: Workspace, noteId: string, link: CrossLink): Workspace {
  return mapNote(workspace, noteId, (note) =>
    withLinks(note, [...(note.crossLinks ?? []).filter((item) => !sameTarget(item, link)), link]),
  )
}

export function removeCrossLink(workspace: Workspace, noteId: string, target: Target): Workspace {
  return mapNote(workspace, noteId, (note) =>
    withLinks(
      note,
      (note.crossLinks ?? []).filter((item) => !sameTarget(item, target)),
    ),
  )
}

/** What is known of the linked note: read now from its project, or remembered from the link. */
export interface LinkedNoteInfo {
  title?: string
  status?: NoteStatus
  /** False when its project was read and the note is gone. */
  found: boolean
}

export const linkKey = (link: Target) => `${link.project.toLowerCase()}|${link.noteId}`

export const isClosed = (status: NoteStatus | undefined) =>
  Boolean(status && CLOSED_STATUSES.includes(status))

/**
 * A note is blocked while a note it waits on is still open, and blocking while
 * it is itself open and something waits on it. A linked note that can't be
 * found no longer blocks anything.
 */
export function blockState(note: Note, info: Map<string, LinkedNoteInfo>) {
  const links = note.crossLinks ?? []
  const open = (link: CrossLink) => {
    const known = info.get(linkKey(link))

    return known ? known.found && !isClosed(known.status) : !isClosed(link.status)
  }

  return {
    blockedBy: links.filter((link) => link.kind === 'blocked-by' && open(link)),
    blocking: isClosed(note.status) ? [] : links.filter((link) => link.kind === 'blocks'),
  }
}
