import type { SourceFile } from '../storage/projectFiles'
import { balanced, extensionOf, splitTopLevel, stripCComments } from './source'
import type { Column, DbModel, Program, Relation, Table } from './sql'

export const isDrizzleCandidate = (path: string) =>
  ['ts', 'js', 'mts', 'mjs'].includes(extensionOf(path)) &&
  !path.endsWith('.d.ts') &&
  !/\.(test|spec)\.[a-z]+$/.test(path)

const TABLE = /\b(?:export\s+)?const\s+(\w+)\s*=\s*(?:pg|mysql|sqlite)Table\s*\(/g
const ENUM = /\b(?:export\s+)?const\s+(\w+)\s*=\s*(?:pg|mysql)Enum\s*\(\s*['"`]([^'"`]+)['"`]/g

/** `users.id` inside `.references(() => users.id)`: the variable and the property. */
const REFERENCE = /\.references\(\s*\(\)\s*(?::\s*\w+\s*)?=>\s*(\w+)\.(\w+)/

/**
 * Drizzle ORM schemas as the database lens draws them: every `pgTable`
 * (or `mysqlTable`, `sqliteTable`) is a table, `.references(() => x.id)` a
 * foreign key, `pgEnum` a type. Tables and columns keep their SQL names.
 */
export function buildDrizzleModel(sources: SourceFile[]): DbModel {
  interface Found {
    variable: string
    table: Table
    /** Property name → SQL column name, to resolve what other tables reference. */
    columns: Map<string, string>
    references: { column: string; variable: string; property: string }[]
  }

  const found: Found[] = []
  const programs: Program[] = []

  for (const source of sources) {
    if (!/\b(?:pg|mysql|sqlite)(?:Table|Enum)\s*\(/.test(source.text)) continue

    const code = stripCComments(source.text)

    for (const match of code.matchAll(TABLE)) {
      const args = splitTopLevel(balanced(code, match.index + match[0].length - 1) ?? '')
      const name = /^['"`]([^'"`]+)['"`]$/.exec(args[0] ?? '')?.[1]
      const body = args[1]?.startsWith('{') ? (balanced(args[1], 0, '{}') ?? '') : ''

      if (!name) continue

      const entry: Found = {
        variable: match[1],
        table: { name, path: source.path, columns: [] },
        columns: new Map(),
        references: [],
      }

      for (const field of splitTopLevel(body)) {
        const column = /^(\w+)\s*:\s*(\w+)\s*\(([^)]*)\)(.*)$/s.exec(field)

        if (!column) continue

        const [, property, type, typeArgs, chain] = column
        // `text('first_name')` names the column; `text()` takes the property's name.
        const sqlName = /^\s*['"`]([^'"`]+)['"`]/.exec(typeArgs)?.[1] ?? property
        const primaryKey = /\.primaryKey\(/.test(chain)
        const reference = REFERENCE.exec(chain)

        entry.columns.set(property, sqlName)
        entry.table.columns.push({
          name: sqlName,
          type,
          primaryKey,
          nullable: !primaryKey && !/\.notNull\(/.test(chain),
        } satisfies Column)

        if (reference) {
          entry.references.push({
            column: sqlName,
            variable: reference[1],
            property: reference[2],
          })
        }
      }

      // Composite keys in the third argument: primaryKey({ columns: [t.a, t.b] })
      const composite = /primaryKey\(\s*\{[^}]*columns\s*:\s*\[([^\]]*)\]/.exec(args[2] ?? '')

      for (const property of composite?.[1].match(/\.(\w+)/g) ?? []) {
        const sqlName = entry.columns.get(property.slice(1))
        const column = entry.table.columns.find((item) => item.name === sqlName)

        if (column) {
          column.primaryKey = true
          column.nullable = false
        }
      }

      found.push(entry)
    }

    for (const match of code.matchAll(ENUM)) {
      programs.push({ kind: 'type', name: match[2], paths: [source.path], tables: [] })
    }
  }

  const byVariable = new Map(found.map((entry) => [entry.variable, entry]))
  const relations: Relation[] = found.flatMap((entry) =>
    entry.references.flatMap((reference) => {
      const target = byVariable.get(reference.variable)

      return target
        ? [
            {
              from: entry.table.name,
              fromColumns: [reference.column],
              to: target.table.name,
              toColumns: [target.columns.get(reference.property) ?? reference.property],
            },
          ]
        : []
    }),
  )

  return {
    tables: found.map((entry) => entry.table).sort((a, b) => a.name.localeCompare(b.name)),
    relations,
    programs: programs.sort((a, b) => a.name.localeCompare(b.name)),
  }
}
