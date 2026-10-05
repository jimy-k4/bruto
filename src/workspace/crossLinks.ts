import { useEffect, useRef, useState } from 'react'
import type { CrossLink, CrossLinkKind, Note, Workspace } from '../types'
import {
  INVERSE_KIND,
  addCrossLink,
  linkKey,
  removeCrossLink,
  sameTarget,
  type LinkedNoteInfo,
} from '../domain/crossLinks'
import type { TranslationKey } from '../i18n'
import type { ActiveProject } from '../state/useProjects'
import {
  findLinkedProject,
  readOtherWorkspace,
  updateOtherWorkspace,
} from '../storage/linkedProjects'
import { listRecentProjects, type RecentProject } from '../storage/recentProjects'

export const KIND_LABELS: Record<CrossLinkKind, TranslationKey> = {
  blocks: 'crossLinkBlocks',
  'blocked-by': 'crossLinkBlockedBy',
  related: 'crossLinkRelated',
}

/** The linked note as best known: read from its project now, or as the link remembers it. */
export function linkedNote(link: CrossLink, info: Map<string, LinkedNoteInfo>) {
  const known = info.get(linkKey(link))

  return {
    title: known?.found ? known.title : link.title,
    status: known ? known.status : link.status,
    missing: known?.found === false,
  }
}

/** This project as the other one's links name it. */
const here = (project: ActiveProject) => ({ project: project.handle.name, projectId: project.id })

const snapshot = (note: Pick<Note, 'title' | 'status'>) => ({
  title: note.title,
  ...(note.status && { status: note.status }),
})

/**
 * Links a note here with one in another project, writing the link on both
 * sides so each board shows it. Returns false when the other project could
 * not be written: the link then only lives here.
 */
export async function linkNotes(
  project: ActiveProject,
  note: Note,
  kind: CrossLinkKind,
  target: RecentProject,
  /** A note there, or the ghost of one shown here. */
  targetNote: Pick<Note, 'id' | 'title' | 'status'>,
): Promise<boolean> {
  const there = { project: target.handle.name, projectId: target.id, noteId: targetNote.id }

  project.store.update((workspace) =>
    addCrossLink(workspace, note.id, { kind, ...there, ...snapshot(targetNote) }),
  )

  return updateOtherWorkspace(
    target,
    (workspace) =>
      addCrossLink(workspace, targetNote.id, {
        kind: INVERSE_KIND[kind],
        ...here(project),
        noteId: note.id,
        ...snapshot(note),
      }),
    true,
  )
}

/** Removes a link here and, when its project can be reached, its other side too. */
export async function unlinkNotes(project: ActiveProject, note: Note, link: CrossLink) {
  project.store.update((workspace) => removeCrossLink(workspace, note.id, link))

  const target = await findLinkedProject(link)

  if (target) {
    await updateOtherWorkspace(
      target,
      (workspace) => removeCrossLink(workspace, link.noteId, { ...here(project), noteId: note.id }),
      true,
    )
  }
}

const linkedProjectsOf = (notes: Note[]) => {
  const projects = new Map<string, CrossLink>()

  for (const note of notes)
    for (const link of note.crossLinks ?? []) projects.set(link.project.toLowerCase(), link)

  return [...projects.values()]
}

/**
 * The linked notes as they are now in their projects, read when the board
 * opens and whenever its links change. Projects the browser hasn't let Bruto
 * into yet are left out: the link's remembered title and status stand in.
 * Titles and statuses that changed there are brought up to date here.
 */
export function useLinkedNotes(project: ActiveProject, workspace: Workspace) {
  const [info, setInfo] = useState(() => new Map<string, LinkedNoteInfo>())
  const linked = linkedProjectsOf(workspace.notes)
  const signature = workspace.notes
    .flatMap((note) => (note.crossLinks ?? []).map(linkKey))
    .sort()
    .join(',')

  useEffect(() => {
    if (!signature) return

    let cancelled = false

    void (async () => {
      const recents = await listRecentProjects()
      const next = new Map<string, LinkedNoteInfo>()

      for (const link of linked) {
        const target = await findLinkedProject(link, recents)
        const other = target && (await readOtherWorkspace(target, false))

        if (!other) continue

        for (const note of project.store.getWorkspace().notes)
          for (const item of note.crossLinks ?? []) {
            if (item.project.toLowerCase() !== link.project.toLowerCase()) continue

            const found = other.notes.find((candidate) => candidate.id === item.noteId)

            next.set(linkKey(item), {
              found: Boolean(found),
              ...(found && snapshot(found)),
            })
          }
      }

      if (cancelled) return

      setInfo(next)
      refreshSnapshots(project, next)
    })()

    return () => {
      cancelled = true
    }
    // The signature stands for the links: reading again on every edit would be wasteful.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, project])

  return info
}

/** Keeps what a link remembers of the other note current, so AI context and offline views stay right. */
function refreshSnapshots(project: ActiveProject, info: Map<string, LinkedNoteInfo>) {
  const stale = (link: CrossLink) => {
    const known = info.get(linkKey(link))

    return known?.found && (known.title !== link.title || known.status !== link.status)
  }

  if (!project.store.getWorkspace().notes.some((note) => note.crossLinks?.some(stale))) return

  project.store.update(
    (workspace) => ({
      ...workspace,
      notes: workspace.notes.map((note) =>
        note.crossLinks?.some(stale)
          ? {
              ...note,
              crossLinks: note.crossLinks.map((link) => {
                if (!stale(link)) return link

                const { title, status } = info.get(linkKey(link))!
                const next: CrossLink = { ...link, title }

                if (status) next.status = status
                else delete next.status

                return next
              }),
            }
          : note,
      ),
    }),
    { history: false },
  )
}

const SYNC_DELAY = 1000

/**
 * When a linked note's title or status changes here, the other project's link
 * learns it too, where the browser already lets Bruto write. So a note there
 * stops showing as blocked as soon as this one is done.
 */
export function useLinkSnapshotSync(project: ActiveProject, workspace: Workspace) {
  const last = useRef<Map<string, string> | null>(null)

  useEffect(() => {
    const current = new Map(
      workspace.notes
        .filter((note) => note.crossLinks?.length)
        .map((note) => [note.id, `${note.title}\u0001${note.status ?? ''}`]),
    )
    const previous = last.current

    last.current = current

    // The first look is what was on disk: nothing changed yet.
    if (!previous) return

    const changed = workspace.notes.filter(
      (note) => current.has(note.id) && previous.get(note.id) !== current.get(note.id),
    )

    if (changed.length === 0) return

    const timer = window.setTimeout(() => {
      void (async () => {
        const recents = await listRecentProjects()

        for (const note of changed)
          for (const link of note.crossLinks ?? []) {
            const target = await findLinkedProject(link, recents)

            if (!target) continue

            await updateOtherWorkspace(
              target,
              (other) => {
                const there = other.notes.find((item) => item.id === link.noteId)
                const back = there?.crossLinks?.find((item) =>
                  sameTarget(item, { ...here(project), noteId: note.id }),
                )

                if (!there || !back) return other

                return addCrossLink(other, there.id, {
                  ...back,
                  ...snapshot(note),
                  ...(!note.status && { status: undefined }),
                })
              },
              false,
            )
          }
      })()
    }, SYNC_DELAY)

    return () => window.clearTimeout(timer)
  }, [workspace.notes, project])
}
