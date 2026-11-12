import type { Workspace } from '../types'
import { ghostArrows, moveGhostZone, zoneKey, type GhostEnd } from '../domain/ghosts'
import { moveNotes } from '../domain/workspace'
import { ARRANGE_GAP, arrangeNotes } from './arrange'
import { ZONE_LABEL_ROOM, boundingRect, noteRect, zoneFrame, type NoteSizes } from './geometry'

/** Room between the arranged notes and the column of zones beside them. */
const ZONE_COLUMN_GAP = ARRANGE_GAP * 2

/**
 * The board with the selected notes arranged and, beside them, the ghost
 * zones they lead to (and the zones those lead to): one column on the right,
 * each zone level with the note it links to where it can be, none on another.
 *
 * Zones never take part in arranging the notes: a zone is as big as the other
 * board, and counting it would push the notes here apart, which would grow
 * this board's zone over there, and so on, board after board.
 * `null` when there's nothing to arrange.
 */
export function arrangeWorkspace(
  workspace: Workspace,
  ids: string[],
  sizes: NoteSizes,
): Workspace | null {
  const notes = workspace.notes.filter((note) => ids.includes(note.id))
  const zones = zonesFrom(workspace, new Set(notes.map((note) => note.id)))

  if (notes.length < 2 && (notes.length === 0 || zones.length === 0)) return null

  const positions = arrangeNotes(
    notes.map((note) => ({ id: note.id, ...noteRect(note, sizes) })),
    workspace.connections,
  )
  let next = moveNotes(workspace, positions)
  const arranged = next.notes.filter((note) => ids.includes(note.id))
  const group = boundingRect(arranged.map((note) => noteRect(note, sizes)))!
  const noteY = new Map(arranged.map((note) => [note.id, note.y]))
  const anchors = new Map<string, number>()

  // Each zone level with the highest note it links to; a zone reached through another, with that one.
  for (const { key, through } of zones) {
    const ys = through.map((id) => noteY.get(id) ?? anchors.get(id)).filter((y) => y !== undefined)

    anchors.set(key, ys.length > 0 ? Math.min(...ys) : group.y)
  }

  const order = [...zones].sort((a, b) => anchors.get(a.key)! - anchors.get(b.key)!)
  let below = -Infinity

  for (const { key } of order) {
    const zone = next.ghosts!.find((item) => zoneKey(item) === key)!
    const frame = zoneFrame(zone, sizes)
    const top = Math.max(anchors.get(key)!, below)

    next = moveGhostZone(next, key, {
      x: zone.offset.x + group.x + group.width + ZONE_COLUMN_GAP - frame.x,
      y: zone.offset.y + top + ZONE_LABEL_ROOM - frame.y,
    })
    below = top + ZONE_LABEL_ROOM + frame.height + ARRANGE_GAP
  }

  return next
}

/** An arrow end as a key: a note by its id, a ghost by its zone. */
const endKey = (end: GhostEnd) => end.zone ?? end.id

/**
 * The zones the notes lead to, then the zones those lead to, in that order,
 * each with what brought it in: notes or zones.
 */
function zonesFrom(workspace: Workspace, noteIds: Set<string>) {
  const arrows = ghostArrows(workspace)
  const found: { key: string; through: string[] }[] = []
  const taken = new Set(noteIds)

  for (let reached = [...noteIds]; reached.length > 0;) {
    const next: { key: string; through: string[] }[] = []

    for (const { from, to } of arrows) {
      for (const [here, there] of [
        [from, to],
        [to, from],
      ]) {
        if (!there.zone || taken.has(there.zone) || !reached.includes(endKey(here))) continue

        const known = next.find((item) => item.key === there.zone)

        if (known) known.through.push(endKey(here))
        else next.push({ key: there.zone, through: [endKey(here)] })
      }
    }

    for (const item of next) taken.add(item.key)
    found.push(...next)
    reached = next.map((item) => item.key)
  }

  return found
}
