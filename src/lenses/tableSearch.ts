import { normalizeText } from '../domain/search'
import type { Table } from './sql'

export interface TableMatch {
  table: Table
  /** The column that matched, when the table's own name didn't. */
  column?: string
}

/**
 * Tables whose name, or one of whose columns, contains the query, ignoring
 * case and accents. Best first: the exact name, then names that start with
 * it, then names that contain it, then tables found by a column.
 */
export function findTables(tables: Table[], query: string): TableMatch[] {
  const needle = normalizeText(query.trim())

  if (!needle) return []

  const ranked: { match: TableMatch; rank: number }[] = []

  for (const table of tables) {
    const name = normalizeText(table.name)

    if (name.includes(needle)) {
      ranked.push({
        match: { table },
        rank: name === needle ? 0 : name.startsWith(needle) ? 1 : 2,
      })
      continue
    }

    const column = table.columns.find((item) => normalizeText(item.name).includes(needle))

    if (column) ranked.push({ match: { table, column: column.name }, rank: 3 })
  }

  return ranked
    .sort((a, b) => a.rank - b.rank || a.match.table.name.localeCompare(b.match.table.name))
    .map((item) => item.match)
}
