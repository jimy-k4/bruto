import type { Relation, Table } from './sql'

export const CARD_WIDTH = 236
export const CARD_HEADER = 38
export const CARD_ROW = 20
/** Columns listed per table before "+N more". */
export const CARD_ROWS = 10
const CARD_PADDING = 10
const GAP_X = 56
const GAP_Y = 84
/** Tables per row before a level wraps onto another row. */
const PER_ROW = 5

export interface PlacedTable {
  table: Table
  x: number
  y: number
  width: number
  height: number
}

export interface ErLayout {
  tables: PlacedTable[]
  width: number
  height: number
}

export const cardHeight = (table: Table) =>
  CARD_HEADER +
  Math.min(table.columns.length, CARD_ROWS) * CARD_ROW +
  (table.columns.length > CARD_ROWS ? CARD_ROW : 0) +
  CARD_PADDING

/**
 * Places tables in levels: tables nothing else is needed for at the top, the
 * tables that point at them below, so foreign keys run upwards. Within a
 * level, each table sits near the tables it points at.
 */
export function layoutEr(tables: Table[], relations: Relation[]): ErLayout {
  const names = new Set(tables.map((table) => table.name))
  const parents = new Map<string, string[]>()

  for (const relation of relations) {
    if (relation.from === relation.to || !names.has(relation.to)) continue
    parents.set(relation.from, [...(parents.get(relation.from) ?? []), relation.to])
  }

  const depths = new Map<string, number>()
  const depthOf = (name: string, visiting = new Set<string>()): number => {
    const known = depths.get(name)

    if (known !== undefined) return known
    // A cycle of foreign keys: stop climbing.
    if (visiting.has(name)) return 0

    visiting.add(name)
    const depth =
      Math.max(-1, ...(parents.get(name) ?? []).map((parent) => depthOf(parent, visiting))) + 1
    visiting.delete(name)
    depths.set(name, depth)

    return depth
  }

  const levels: Table[][] = []

  for (const table of tables) {
    const depth = depthOf(table.name)
    levels[depth] = [...(levels[depth] ?? []), table]
  }

  const columnOf = new Map<string, number>()
  const children = (name: string) =>
    relations.filter((relation) => relation.to === name && relation.from !== name).length
  const placed: PlacedTable[] = []
  let y = 0
  let width = 0

  for (const level of levels.filter(Boolean)) {
    // Barycentre: under the tables it points at; the most referenced first at the top.
    const order = level
      .map((table) => {
        const above = (parents.get(table.name) ?? [])
          .map((parent) => columnOf.get(parent))
          .filter((column): column is number => column !== undefined)
        const centre = above.length > 0 ? above.reduce((a, b) => a + b, 0) / above.length : Infinity

        return { table, centre, weight: children(table.name) }
      })
      .sort(
        (a, b) =>
          a.centre - b.centre || b.weight - a.weight || a.table.name.localeCompare(b.table.name),
      )
      .map((item) => item.table)

    for (let start = 0; start < order.length; start += PER_ROW) {
      const row = order.slice(start, start + PER_ROW)
      const rowHeight = Math.max(...row.map(cardHeight))

      row.forEach((table, column) => {
        const x = column * (CARD_WIDTH + GAP_X)

        columnOf.set(table.name, column)
        placed.push({ table, x, y, width: CARD_WIDTH, height: cardHeight(table) })
        width = Math.max(width, x + CARD_WIDTH)
      })

      y += rowHeight + GAP_Y
    }
  }

  return { tables: placed, width, height: Math.max(0, y - GAP_Y) }
}
