import type { SourceFile } from '../storage/projectFiles'
import { balanced, extensionOf, stripCComments } from './source'
import type { Column, DbModel, Program, Relation, Table } from './sql'

export const isPrismaFile = (path: string) => extensionOf(path) === 'prisma'

const SCALARS = new Set([
  'String',
  'Int',
  'BigInt',
  'Float',
  'Decimal',
  'Boolean',
  'DateTime',
  'Json',
  'Bytes',
  'Unsupported',
])

/** `[a, b]` inside an attribute → ['a', 'b']. */
const list = (raw: string | undefined) =>
  (raw ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

/**
 * Prisma schemas as the database lens draws them: each model is a table,
 * `@relation(fields: …, references: …)` is a foreign key, enums are types.
 * Schemas split over several files (`prismaSchemaFolder`) are read together.
 */
export function buildPrismaModel(sources: SourceFile[]): DbModel {
  const blocks: {
    kind: 'model' | 'view' | 'enum' | 'type'
    name: string
    body: string
    path: string
  }[] = []

  for (const source of sources.filter((item) => isPrismaFile(item.path))) {
    const code = stripCComments(source.text)

    for (const match of code.matchAll(/\b(model|view|enum|type)\s+(\w+)\s*\{/g)) {
      const body = balanced(code, match.index + match[0].length - 1, '{}') ?? ''

      blocks.push({
        kind: match[1] as 'model' | 'view' | 'enum' | 'type',
        name: match[2],
        body,
        path: source.path,
      })
    }
  }

  const models = new Set(
    blocks.filter((block) => block.kind === 'model').map((block) => block.name),
  )
  const enums = new Set(blocks.filter((block) => block.kind === 'enum').map((block) => block.name))
  const tables: Table[] = []
  const relations: Relation[] = []
  const programs: Program[] = []

  for (const block of blocks) {
    if (block.kind !== 'model') {
      programs.push({
        kind: block.kind === 'view' ? 'view' : 'type',
        name: block.name,
        paths: [block.path],
        tables: [],
      })
      continue
    }

    const columns: Column[] = []

    for (const line of block.body.split('\n')) {
      const field = /^\s*(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/.exec(line)

      if (!field) continue

      const [, name, type, many, optional, attributes] = field

      if (models.has(type)) {
        // The side of a relation that holds the key says which columns point where.
        const relation = /@relation\(([^)]*)\)/.exec(attributes)?.[1] ?? ''
        const fields = list(/\bfields\s*:\s*\[([^\]]*)\]/.exec(relation)?.[1])

        if (!many && fields.length > 0) {
          relations.push({
            from: block.name,
            fromColumns: fields,
            to: type,
            toColumns: list(/\breferences\s*:\s*\[([^\]]*)\]/.exec(relation)?.[1]),
          })
        }
        continue
      }

      if (!SCALARS.has(type) && !enums.has(type)) continue

      columns.push({
        name,
        type: `${type}${many ? '[]' : ''}`,
        primaryKey: /@id\b/.test(attributes),
        nullable: Boolean(optional),
      })
    }

    // Composite keys: @@id([a, b])
    for (const name of list(/@@id\(\s*(?:fields\s*:\s*)?\[([^\]]*)\]/.exec(block.body)?.[1])) {
      const column = columns.find((item) => item.name === name)

      if (column) column.primaryKey = true
    }

    tables.push({ name: block.name, path: block.path, columns })
  }

  return {
    tables: tables.sort((a, b) => a.name.localeCompare(b.name)),
    relations,
    programs: programs.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)),
  }
}
