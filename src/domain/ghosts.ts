import type { Connection, CrossLink, GhostNote, GhostZone, Note, Point, Workspace } from '../types'
import { NOTE_MIN_SIZE, isNoteColor, isNoteKind, isNotePattern, isNoteStatus } from './constants'
import { normalizeCrossLinks } from './crossLinks'

/** How far zones travel: a board passes on the zones it holds, up to this many boards away. */
export const MAX_HOPS = 3
/** What a ghost keeps of its note: enough for people and models to tell what it is. */
const DESCRIPTION_LENGTH = 400
const MAX_FILES = 10
/** Room left between a new zone and the note here it links to. */
const PLACE_GAP = 120

/** A project as links name it: its folder, and its id among this browser's recent projects. */
export interface ProjectRef {
  project: string
  projectId?: string
}

export const sameProject = (a: ProjectRef, b: ProjectRef) =>
  a.projectId && b.projectId
    ? a.projectId === b.projectId
    : a.project.toLowerCase() === b.project.toLowerCase()

/** How a project is told apart: the copies' freshness goes by project. */
export const projectKey = (ref: ProjectRef) => ref.project.toLowerCase()

/**
 * How a zone is told apart from the others on a board: its project and its
 * first note. A project can bring several zones, one per group of notes
 * joined by arrows there.
 */
export const zoneKey = (zone: GhostZone) =>
  `${projectKey(zone)}:${zone.notes.map((ghost) => ghost.id).sort()[0] ?? ''}`

/** A zone cut into its groups of notes joined by arrows: unrelated chains get a zone each. */
function splitZone(zone: GhostZone): GhostZone[] {
  const groupOf = new Map<string, number>()
  let groups = 0

  for (const ghost of zone.notes) {
    if (groupOf.has(ghost.id)) continue

    const queue = [ghost.id]

    groupOf.set(ghost.id, groups)

    while (queue.length > 0) {
      const id = queue.shift()!

      for (const { from, to } of zone.connections) {
        const other = from === id ? to : to === id ? from : null

        if (other && !groupOf.has(other)) {
          groupOf.set(other, groups)
          queue.push(other)
        }
      }
    }

    groups++
  }

  return Array.from({ length: groups }, (_, group) => ({
    ...zone,
    notes: zone.notes.filter((ghost) => groupOf.get(ghost.id) === group),
    connections: zone.connections.filter((connection) => groupOf.get(connection.from) === group),
  }))
}

const sharesNotes = (a: GhostZone, b: GhostZone) =>
  sameProject(a, b) && a.notes.some((ghost) => b.notes.some((other) => other.id === ghost.id))

/** The notes an arrow chain leads from into `seeds`, seeds included. */
function chainTo(workspace: Workspace, seeds: Set<string>): Set<string> {
  const chain = new Set(seeds)
  const queue = [...seeds]

  while (queue.length > 0) {
    const id = queue.shift()!

    for (const connection of workspace.connections) {
      if (connection.to === id && !chain.has(connection.from)) {
        chain.add(connection.from)
        queue.push(connection.from)
      }
    }
  }

  return chain
}

function toGhost(note: Note): GhostNote {
  const description = note.description.trim()
  const files = [...new Set([...note.filePaths, ...(note.aiFilePaths ?? [])])].slice(0, MAX_FILES)
  const links = (note.crossLinks ?? []).map(({ kind, project, projectId, noteId }) => ({
    kind,
    project,
    noteId,
    ...(projectId && { projectId }),
  }))

  return {
    id: note.id,
    title: note.title,
    ...(note.kind && { kind: note.kind }),
    ...(note.status && { status: note.status }),
    colorTheme: note.colorTheme,
    pattern: note.pattern,
    x: note.x,
    y: note.y,
    ...(description && {
      description:
        description.length > DESCRIPTION_LENGTH
          ? `${description.slice(0, DESCRIPTION_LENGTH).trimEnd()}…`
          : description,
    }),
    ...(files.length > 0 && { files }),
    ...(links.length > 0 && { crossLinks: links }),
  }
}

/**
 * What a linked project's board brings here: its notes linked to this
 * project and the chain of arrows that leads to them, plus the zones it holds
 * that lead into that chain, from projects further away. Offsets are as on
 * that board: its own notes at 0,0 and its zones where they sit around them.
 */
export function zonesFrom(
  origin: ProjectRef & { workspace: Workspace },
  here: ProjectRef,
  now: string,
): GhostZone[] {
  const { workspace } = origin
  const seeds = new Set(
    workspace.notes
      .filter((note) => note.crossLinks?.some((link) => sameProject(link, here)))
      .map((note) => note.id),
  )

  if (seeds.size === 0) return []

  const chain = chainTo(workspace, seeds)
  const whole: GhostZone = {
    project: origin.project,
    ...(origin.projectId && { projectId: origin.projectId }),
    offset: { x: 0, y: 0 },
    notes: workspace.notes.filter((note) => chain.has(note.id)).map(toGhost),
    connections: workspace.connections.filter(
      (connection) => chain.has(connection.from) && chain.has(connection.to),
    ),
    syncedAt: now,
    hops: 1,
  }

  // Its own zones that lead into the chain, as long as they aren't this project's or too far.
  const passedOn = (workspace.ghosts ?? [])
    .filter(
      (other) =>
        other.hops < MAX_HOPS &&
        !sameProject(other, here) &&
        !sameProject(other, origin) &&
        other.notes.some((ghost) =>
          ghost.crossLinks?.some((link) => sameProject(link, origin) && chain.has(link.noteId)),
        ),
    )
    .map((other) => ({ ...other, via: origin.project, hops: other.hops + 1 }))

  return [...splitZone(whole), ...passedOn]
}

const averageX = (points: Point[]) =>
  points.reduce((sum, point) => sum + point.x, 0) / points.length

/**
 * Where a new zone goes: wholly beside the note here it links to, level with
 * it, on the side that keeps the flow of the boards. A chain that runs
 * leftwards (what leads to a note sits right of it) keeps running leftwards;
 * the zone's own chain tells, or else the arrows into the note here, or else
 * what blocks goes left and what waits goes right. A side where the zone
 * would cover notes here gives way to the other.
 */
function placement(workspace: Workspace, origin: ProjectRef, zone: GhostZone): Point {
  const left = Math.min(...zone.notes.map((ghost) => ghost.x))
  const right = Math.max(...zone.notes.map((ghost) => ghost.x)) + NOTE_MIN_SIZE.width
  const top = Math.min(...zone.notes.map((ghost) => ghost.y))
  const bottom = Math.max(...zone.notes.map((ghost) => ghost.y)) + NOTE_MIN_SIZE.height
  const notesById = new Map(workspace.notes.map((note) => [note.id, note]))

  for (const note of workspace.notes) {
    for (const link of note.crossLinks ?? []) {
      const ghost = sameProject(link, origin) && zone.notes.find((item) => item.id === link.noteId)

      if (!ghost) continue

      const rest = zone.notes.filter((item) => item !== ghost)
      const before = workspace.connections
        .filter((connection) => connection.to === note.id)
        .flatMap((connection) => notesById.get(connection.from) ?? [])
      const flowsLeft =
        rest.length > 0 ? averageX(rest) > ghost.x : before.length > 0 && averageX(before) > note.x
      const preferRight = link.kind === 'blocks' ? !flowsLeft : flowsLeft
      const y = Math.round(note.y - ghost.y)
      const at = (onRight: boolean): Point => ({
        x: Math.round(
          onRight ? note.x + NOTE_MIN_SIZE.width + PLACE_GAP - left : note.x - PLACE_GAP - right,
        ),
        y,
      })
      const covers = ({ x }: Point) =>
        workspace.notes.some(
          (other) =>
            other.x < x + right &&
            other.x + NOTE_MIN_SIZE.width > x + left &&
            other.y < y + bottom &&
            other.y + NOTE_MIN_SIZE.height > y + top,
        )
      const preferred = at(preferRight)

      return covers(preferred) && !covers(at(!preferRight)) ? at(!preferRight) : preferred
    }
  }

  return { x: -left, y: -top }
}

/**
 * One project's copies, from every path, as its groups: every note once (the
 * nearest copy wins), then split by arrows. Each group keeps the place and
 * the details of the first copy that has one of its notes.
 */
function regroup(copies: GhostZone[]): GhostZone[] {
  const nearest = [...copies].sort((a, b) => a.hops - b.hops)
  const notes = new Map<string, GhostNote>()
  const connections = new Map<string, Connection>()

  // In the order they came, each note as its nearest copy has it.
  for (const copy of copies) {
    for (const ghost of copy.notes) {
      const best = nearest.find((item) => item.notes.some((other) => other.id === ghost.id))!

      if (!notes.has(ghost.id))
        notes.set(
          ghost.id,
          best.notes.find((other) => other.id === ghost.id)!,
        )
    }
    for (const connection of copy.connections) connections.set(connection.id, connection)
  }

  return splitZone({
    ...nearest[0],
    notes: [...notes.values()],
    connections: [...connections.values()],
  }).map((group) => {
    const first = copies.find((copy) => sharesNotes(copy, group)) ?? nearest[0]

    return { ...first, notes: group.notes, connections: group.connections }
  })
}

/** What reading one linked project gave: its zones, or `null` when it couldn't be read. */
export interface ReadProject {
  origin: ProjectRef
  zones: GhostZone[] | null
}

/** The project whose board a zone was copied from: its own, or the one that passed it on. */
const broughtBy = (zone: GhostZone): ProjectRef => ({
  project: zone.hops > 1 && zone.via ? zone.via : zone.project,
})

/**
 * This board's zones after reading the projects it links to. Zones stay
 * where the user put them; new ones go beside the note here they link to.
 * A project that couldn't be read keeps its last copy, and so do the zones
 * it brought. One zone per project, never this one's. With `keepOthers`,
 * zones brought by projects not in `read` stay too: one project pushing its
 * own news leaves the rest alone.
 */
export function placeGhostZones(
  workspace: Workspace,
  read: ReadProject[],
  here: ProjectRef,
  { keepOthers = false } = {},
): GhostZone[] | undefined {
  const previous = workspace.ghosts ?? []
  const copies: GhostZone[] = []

  const add = (zone: GhostZone) => {
    if (!sameProject(zone, here)) copies.push(zone)
  }

  /** Where a group sat before, when one of its notes was on this board already. */
  const before = (zone: GhostZone) => previous.find((item) => sharesNotes(item, zone))?.offset

  for (const { origin, zones } of read) {
    if (!zones) {
      for (const zone of previous) if (sameProject(broughtBy(zone), origin)) add(zone)
      continue
    }

    if (zones.length === 0) continue

    // Its own groups each go beside the note here they link to; zones it passes on keep
    // their place around its first group, as on its board.
    const placed = zones
      .filter((zone) => zone.hops === 1)
      .map((zone) => ({ ...zone, offset: before(zone) ?? placement(workspace, origin, zone) }))
    const base = placed[0]?.offset ?? { x: 0, y: 0 }

    placed.forEach(add)

    for (const zone of zones.filter((item) => item.hops > 1)) {
      add({
        ...zone,
        offset: before(zone) ?? { x: zone.offset.x + base.x, y: zone.offset.y + base.y },
      })
    }
  }

  if (keepOthers) {
    for (const zone of previous) {
      if (!read.some(({ origin }) => sameProject(broughtBy(zone), origin))) add(zone)
    }
  }

  const projects = [...new Set(copies.map(projectKey))]
  const result = projects.flatMap((key) =>
    regroup(copies.filter((copy) => projectKey(copy) === key)),
  )

  return result.length > 0 ? result : undefined
}

/** How a ghost is told apart from notes wherever ids meet: sizes, connecting. */
export const ghostKey = (zone: ProjectRef, id: string) => `ghost|${projectKey(zone)}|${id}`

export function parseGhostKey(key: string): { project: string; id: string } | null {
  const [mark, project, id] = key.split('|')

  return mark === 'ghost' && project && id ? { project, id } : null
}

/** Moves one zone, by its key, to a new place on this board. */
export function moveGhostZone(workspace: Workspace, key: string, offset: Point): Workspace {
  return {
    ...workspace,
    ghosts: workspace.ghosts?.map((zone) =>
      zoneKey(zone) === key
        ? { ...zone, offset: { x: Math.round(offset.x), y: Math.round(offset.y) } }
        : zone,
    ),
  }
}

/** The ghost a short id like "a1b2c3" or "[a1b2c3]" points at, if any. */
export function findGhost(
  workspace: Workspace,
  reference: string,
): { zone: GhostZone; ghost: GhostNote } | null {
  const prefix = reference
    .trim()
    .replace(/^\[|\]$/g, '')
    .toLowerCase()

  if (!prefix) return null

  for (const zone of workspace.ghosts ?? [])
    for (const ghost of zone.notes)
      if (ghost.id.toLowerCase().startsWith(prefix)) return { zone, ghost }

  return null
}

/** One end of an arrow across projects: a note here, or a ghost in a zone. */
export interface GhostEnd {
  /** The zone's key; absent for a note of this board. */
  zone?: string
  id: string
}

export interface GhostArrow {
  key: string
  from: GhostEnd
  to: GhostEnd
  /** "Related" links have no direction. */
  directed: boolean
}

const endKey = (end: GhostEnd) => `${end.zone ?? ''}|${end.id}`

/**
 * The arrows between this board and its zones, and between zones: one per
 * linked pair, pointing from what blocks to what waits on it.
 */
export function ghostArrows({ notes, ghosts }: Pick<Workspace, 'notes' | 'ghosts'>): GhostArrow[] {
  const zones = ghosts ?? []
  const arrows = new Map<string, GhostArrow>()

  const add = (
    end: GhostEnd,
    link: Pick<CrossLink, 'kind' | 'project' | 'projectId' | 'noteId'>,
  ) => {
    const zone = zones.find(
      (item) => sameProject(item, link) && item.notes.some((ghost) => ghost.id === link.noteId),
    )

    if (!zone) return

    const other = { zone: zoneKey(zone), id: link.noteId }
    const key = [endKey(end), endKey(other)].sort().join('>')

    if (arrows.has(key)) return

    const [from, to] = link.kind === 'blocked-by' ? [other, end] : [end, other]

    arrows.set(key, { key, from, to, directed: link.kind !== 'related' })
  }

  for (const note of notes) for (const link of note.crossLinks ?? []) add({ id: note.id }, link)

  for (const zone of zones)
    for (const ghost of zone.notes)
      for (const link of ghost.crossLinks ?? []) add({ zone: zoneKey(zone), id: ghost.id }, link)

  return [...arrows.values()]
}

// ---------------------------------------------------------------------------
// Reading the file

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

function normalizeGhostNote(raw: UnknownRecord): GhostNote | null {
  if (typeof raw.id !== 'string' || !raw.id || !isNumber(raw.x) || !isNumber(raw.y)) return null

  const files = Array.isArray(raw.files)
    ? raw.files.filter((file): file is string => typeof file === 'string')
    : []
  const links = normalizeCrossLinks(raw.crossLinks).map(({ kind, project, projectId, noteId }) => ({
    kind,
    project,
    noteId,
    ...(projectId && { projectId }),
  }))

  return {
    id: raw.id,
    title: typeof raw.title === 'string' ? raw.title : '',
    ...(isNoteKind(raw.kind) && { kind: raw.kind }),
    ...(isNoteStatus(raw.status) && { status: raw.status }),
    colorTheme: isNoteColor(raw.colorTheme) ? raw.colorTheme : 'concrete',
    pattern: isNotePattern(raw.pattern) ? raw.pattern : 'raw',
    x: raw.x,
    y: raw.y,
    ...(typeof raw.description === 'string' && raw.description && { description: raw.description }),
    ...(files.length > 0 && { files }),
    ...(links.length > 0 && { crossLinks: links }),
  }
}

/** Valid zones only, one per project: a hand-edited file never breaks the board. */
export function normalizeGhostZones(value: unknown): GhostZone[] | undefined {
  if (!Array.isArray(value)) return undefined

  const zones: GhostZone[] = []

  for (const raw of value) {
    if (!isRecord(raw) || typeof raw.project !== 'string' || !raw.project.trim()) continue

    const project = raw.project
    const offset = isRecord(raw.offset) ? raw.offset : {}
    const notes = (Array.isArray(raw.notes) ? raw.notes : [])
      .filter(isRecord)
      .map(normalizeGhostNote)
      .filter((ghost): ghost is GhostNote => ghost !== null)
    const ids = new Set(notes.map((ghost) => ghost.id))
    const connections = (Array.isArray(raw.connections) ? raw.connections : [])
      .filter(isRecord)
      .filter(
        (item): item is UnknownRecord & Connection =>
          typeof item.id === 'string' &&
          typeof item.from === 'string' &&
          typeof item.to === 'string' &&
          ids.has(item.from) &&
          ids.has(item.to),
      )
      .map(({ id, from, to }) => ({ id, from, to }))

    if (notes.length === 0) continue

    zones.push({
      project,
      ...(typeof raw.projectId === 'string' && raw.projectId && { projectId: raw.projectId }),
      offset: { x: isNumber(offset.x) ? offset.x : 0, y: isNumber(offset.y) ? offset.y : 0 },
      notes,
      connections,
      syncedAt: typeof raw.syncedAt === 'string' ? raw.syncedAt : '',
      ...(typeof raw.via === 'string' && raw.via && { via: raw.via }),
      hops: isNumber(raw.hops) && raw.hops >= 1 ? Math.round(raw.hops) : 1,
    })
  }

  return zones.length > 0 ? zones : undefined
}
