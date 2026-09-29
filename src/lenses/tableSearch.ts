import { normalizeText } from '../domain/search'
import type { Table, UndeclaredTable } from './sql'

export interface TableMatch {
  name: string
  /** The table as a script creates it; missing for one the code only uses. */
  table?: Table
  /** Files that use a table no script creates. */
  usedIn?: string[]
  /** The column that matched, when the table's own name didn't. */
  column?: string
}

/** Exact name, then names that start with the query, then names that contain it. */
function nameRank(name: string, needle: string): number | null {
  const normalized = normalizeText(name)

  if (!normalized.includes(needle)) return null

  return normalized === needle ? 0 : normalized.startsWith(needle) ? 1 : 2
}

/**
 * Tables whose name, or one of whose columns, contains the query, ignoring
 * case and accents. Best first: the exact name, then names that start with
 * it, then names that contain it, then tables found by a column. Tables the
 * code only uses are found by name, after the created ones that rank the same.
 */
export function findTables(
  tables: Table[],
  query: string,
  undeclared: UndeclaredTable[] = [],
): TableMatch[] {
  const needle = normalizeText(query.trim())

  if (!needle) return []

  const ranked: { match: TableMatch; rank: number }[] = []

  for (const table of tables) {
    const rank = nameRank(table.name, needle)

    if (rank !== null) {
      ranked.push({ match: { name: table.name, table }, rank })
      continue
    }

    const column = table.columns.find((item) => normalizeText(item.name).includes(needle))

    if (column) ranked.push({ match: { name: table.name, table, column: column.name }, rank: 3 })
  }

  for (const table of undeclared) {
    const rank = nameRank(table.name, needle)

    if (rank !== null) ranked.push({ match: { name: table.name, usedIn: table.paths }, rank })
  }

  return ranked
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        Number(!a.match.table) - Number(!b.match.table) ||
        a.match.name.localeCompare(b.match.name),
    )
    .map((item) => item.match)
}
