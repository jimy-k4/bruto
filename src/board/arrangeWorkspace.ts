import type { Workspace } from '../types'
import { ghostArrows, moveGhostZone, zoneKey, type GhostEnd } from '../domain/ghosts'
import { moveNotes } from '../domain/workspace'
import { arrangeNotes, type ArrangeItem } from './arrange'
import { ZONE_LABEL_ROOM, noteRect, zoneFrame, type NoteSizes } from './geometry'

/** An arrow end as `arrangeNotes` knows it: a note by its id, a ghost by its zone. */
const endId = (end: GhostEnd) => end.zone ?? end.id

/**
 * The board with the selected notes arranged, and with them the ghost zones
 * they lead to: each zone moves as one block, its label included, and the
 * arrows across projects count like any other. Zones joined only to other
 * zones come too. `null` when there aren't two things to arrange.
 */
export function arrangeWorkspace(
  workspace: Workspace,
  ids: string[],
  sizes: NoteSizes,
): Workspace | null {
  const notes = workspace.notes.filter((note) => ids.includes(note.id))
  const arrows = ghostArrows(workspace)
  const taken = new Set(notes.map((note) => note.id))

  for (let grew = true; grew;) {
    grew = false

    for (const { from, to } of arrows) {
      for (const [here, there] of [
        [from, to],
        [to, from],
      ]) {
        if (there.zone && taken.has(endId(here)) && !taken.has(there.zone)) {
          taken.add(there.zone)
          grew = true
        }
      }
    }
  }

  const zones = (workspace.ghosts ?? []).filter((zone) => taken.has(zoneKey(zone)))
  const boxes = new Map(
    zones.map((zone) => {
      const frame = zoneFrame(zone, sizes)

      return [
        zoneKey(zone),
        { ...frame, y: frame.y - ZONE_LABEL_ROOM, height: frame.height + ZONE_LABEL_ROOM },
      ]
    }),
  )
  const items: ArrangeItem[] = [
    ...notes.map((note) => ({ id: note.id, ...noteRect(note, sizes) })),
    ...[...boxes].map(([id, box]) => ({ id, ...box })),
  ]

  if (items.length < 2) return null

  const positions = arrangeNotes(items, [
    ...workspace.connections,
    ...arrows.map(({ from, to }) => ({ from: endId(from), to: endId(to) })),
  ])
  const noteIds = new Set(notes.map((note) => note.id))
  let next = moveNotes(workspace, new Map([...positions].filter(([id]) => noteIds.has(id))))

  for (const zone of zones) {
    const key = zoneKey(zone)
    const box = boxes.get(key)!
    const to = positions.get(key)

    if (to) {
      next = moveGhostZone(next, key, {
        x: zone.offset.x + to.x - box.x,
        y: zone.offset.y + to.y - box.y,
      })
    }
  }

  return next
}
