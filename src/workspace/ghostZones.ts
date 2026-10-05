import { useCallback, useEffect, useRef, useState } from 'react'
import type { GhostZone, Workspace } from '../types'
import { linkKey } from '../domain/crossLinks'
import {
  parseGhostKey,
  placeGhostZones,
  zoneKey,
  zonesFrom,
  type ProjectRef,
  type ReadProject,
} from '../domain/ghosts'
import type { ActiveProject } from '../state/useProjects'
import {
  findLinkedProject,
  readOtherWorkspace,
  updateOtherWorkspace,
} from '../storage/linkedProjects'
import { listRecentProjects } from '../storage/recentProjects'
import { linkNotes } from './crossLinks'

/** How a zone's copy stands this session: read now, waiting for access, or its project gone. */
export type ZoneState = 'read' | 'locked' | 'missing'

/** The projects this board's notes link to, once each. */
function linkedProjects(workspace: Workspace): ProjectRef[] {
  const projects = new Map<string, ProjectRef>()

  for (const note of workspace.notes)
    for (const { project, projectId } of note.crossLinks ?? [])
      projects.set(project.toLowerCase(), { project, ...(projectId && { projectId }) })

  return [...projects.values()]
}

/**
 * The same zones, in any order and whenever they were copied: rewriting a
 * board for a new date alone is noise.
 */
const sameZones = (a: GhostZone[] | undefined, b: GhostZone[] | undefined) => {
  const plain = (zones: GhostZone[] | undefined) =>
    JSON.stringify(
      [...(zones ?? [])]
        .sort((one, other) => zoneKey(one).localeCompare(zoneKey(other)))
        .map((zone) => ({ ...zone, syncedAt: undefined })),
    )

  return plain(a) === plain(b)
}

/** A board with these zones, or the same board when they are the ones it has. */
function withZones(workspace: Workspace, ghosts: GhostZone[] | undefined): Workspace {
  if (sameZones(ghosts, workspace.ghosts)) return workspace

  const updated = { ...workspace }

  if (ghosts) updated.ghosts = ghosts
  else delete updated.ghosts

  return updated
}

/** What reading the linked projects gave: their zones, and how each stands. */
interface ZoneReading {
  here: ProjectRef
  read: ReadProject[]
  states: Map<string, ZoneState>
}

/** Reads every project the board links to. `ask` names the one that may ask for access. */
async function readLinkedProjects(project: ActiveProject, ask?: string): Promise<ZoneReading> {
  const here = { project: project.handle.name, projectId: project.id }
  const recents = await listRecentProjects()
  const now = new Date().toISOString()
  const read: ReadProject[] = []
  const states = new Map<string, ZoneState>()

  for (const origin of linkedProjects(project.store.getWorkspace())) {
    const target = await findLinkedProject(origin, recents)
    const other = target && (await readOtherWorkspace(target, ask === zoneKey(origin)))
    const found = target ? { project: target.handle.name, projectId: target.id } : origin

    states.set(zoneKey(origin), !target ? 'missing' : other ? 'read' : 'locked')
    read.push({
      origin: found,
      zones: other ? zonesFrom({ ...found, workspace: other }, here, now) : null,
    })
  }

  return { here, read, states }
}

/**
 * Keeps the board's ghost zones: the notes of linked projects that lead to
 * notes here. They are read when the board opens and whenever its links
 * change, from the projects the browser already lets Bruto into; `refresh`
 * may ask for access, so it needs a click. A project that can't be read keeps
 * its last copy. States are by the key of the project that was read.
 */
export function useGhostZones(project: ActiveProject, workspace: Workspace) {
  const [states, setStates] = useState(() => new Map<string, ZoneState>())
  const signature = workspace.notes
    .flatMap((note) => (note.crossLinks ?? []).map((link) => `${note.id}>${linkKey(link)}`))
    .sort()
    .join(',')

  const apply = useCallback(
    ({ here, read, states }: ZoneReading) => {
      setStates(states)
      project.store.update((current) => withZones(current, placeGhostZones(current, read, here)), {
        history: false,
      })
    },
    [project],
  )

  // The signature stands for the links: reading again on every edit would be wasteful.
  useEffect(() => {
    let cancelled = false

    void readLinkedProjects(project).then((reading) => {
      if (!cancelled) apply(reading)
    })

    return () => {
      cancelled = true
    }
  }, [project, apply, signature])

  /** Reads a zone's project again, asking for access if it must: the zone's own, or the one it came through. */
  const refresh = useCallback(
    (zone: GhostZone) =>
      readLinkedProjects(
        project,
        zoneKey({ project: zone.hops > 1 && zone.via ? zone.via : zone.project }),
      ).then(apply),
    [project, apply],
  )

  return { states, refresh }
}

/**
 * An arrow drawn between a note here and a ghost: a real link, written on
 * both boards, so blocks work and agents on both sides know of it. It points
 * from what blocks to what waits. Ghosts never link to each other here: their
 * own boards do that.
 */
export async function linkWithGhost(
  project: ActiveProject,
  from: string,
  to: string,
): Promise<{ result: 'linked' | 'one-sided' | 'missing'; project: string }> {
  const fromGhost = parseGhostKey(from)
  const end = fromGhost ?? parseGhostKey(to)
  const workspace = project.store.getWorkspace()
  const zone = workspace.ghosts?.find((item) => end && zoneKey(item) === end.zone)
  const ghost = zone?.notes.find((item) => item.id === end?.id)
  const note = workspace.notes.find((item) => item.id === (fromGhost ? to : from))
  const target = zone && (await findLinkedProject(zone))

  if (!zone || !ghost || !note || !target) {
    return { result: 'missing', project: zone?.project ?? '' }
  }

  const both = await linkNotes(project, note, fromGhost ? 'blocked-by' : 'blocks', target, ghost)

  return { result: both ? 'linked' : 'one-sided', project: target.handle.name }
}

/** A pause after the last change, so a drag or a burst of typing pushes once. */
const PUSH_DELAY = 1000

/**
 * When notes here change, the boards that show them as ghosts learn it too,
 * where the browser already lets Bruto write: their zones from this project
 * are rebuilt from this board as it is now, and zones from elsewhere stay.
 * Boards it can't write catch up when they are opened or refreshed.
 */
export function useGhostPush(project: ActiveProject, workspace: Workspace) {
  const last = useRef<string | null>(null)

  useEffect(() => {
    const here = { project: project.handle.name, projectId: project.id }
    const targets = linkedProjects(workspace)
    const current = JSON.stringify(
      targets.map((target) => zonesFrom({ ...here, workspace }, target, '')),
    )
    const previous = last.current

    last.current = current

    // The first look is what was on disk: nothing changed yet.
    if (previous === null || previous === current) return

    const timer = window.setTimeout(() => {
      void (async () => {
        const recents = await listRecentProjects()
        const now = new Date().toISOString()

        for (const target of targets) {
          const found = await findLinkedProject(target, recents)

          if (!found) continue

          const there = { project: found.handle.name, projectId: found.id }
          const zones = zonesFrom({ ...here, workspace: project.store.getWorkspace() }, there, now)

          await updateOtherWorkspace(
            found,
            (other) =>
              withZones(
                other,
                placeGhostZones(other, [{ origin: here, zones }], there, { keepOthers: true }),
              ),
            false,
          )
        }
      })()
    }, PUSH_DELAY)

    return () => window.clearTimeout(timer)
  }, [workspace, project])
}
