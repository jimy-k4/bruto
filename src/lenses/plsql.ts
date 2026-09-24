import type { SourceFile } from '../storage/projectFiles'
import { PLSQL_EXTENSIONS } from './detect'
import { balanced, extensionOf, splitTopLevel, stripSqlComments } from './source'

export interface Column {
  name: string
  type: string
  primaryKey: boolean
  nullable: boolean
}

export interface Table {
  name: string
  schema?: string
  path: string
  columns: Column[]
}

export interface Relation {
  /** The table holding the foreign key. */
  from: string
  fromColumns: string[]
  /** The table it points at. */
  to: string
  toColumns: string[]
}

export type ProgramKind =
  'package' | 'procedure' | 'function' | 'view' | 'trigger' | 'sequence' | 'type'

export interface Member {
  kind: 'procedure' | 'function'
  name: string
  /** Declared in the package specification, so callable from outside. */
  public: boolean
}

export interface Program {
  kind: ProgramKind
  name: string
  /** Every file that defines it: a package's specification and body can be apart. */
  paths: string[]
  /** Packages: whether the specification and the body were found. */
  hasSpec?: boolean
  hasBody?: boolean
  members?: Member[]
  /** Tables it reads or writes. */
  tables: string[]
  /** Triggers: the table they fire on. */
  on?: string
}

export interface DbModel {
  tables: Table[]
  relations: Relation[]
  programs: Program[]
}

export const isPlsqlFile = (path: string) => PLSQL_EXTENSIONS.has(extensionOf(path))

const NAME = String.raw`(?:"[^"]+"|[\w$#]+)(?:\s*\.\s*(?:"[^"]+"|[\w$#]+))?`
const CREATE = String.raw`\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:(?:NON)?EDITIONABLE\s+)?(?:FORCE\s+|NO\s+FORCE\s+)?`

/** `"Sales"."Orders"` → { schema: Sales, name: Orders }; unquoted names are upper case in Oracle. */
function objectName(raw: string): { schema?: string; name: string } {
  const parts = raw.split('.').map((part) => {
    const trimmed = part.trim()

    return trimmed.startsWith('"') ? trimmed.slice(1, -1) : trimmed.toUpperCase()
  })

  return parts.length > 1 ? { schema: parts[0], name: parts[1] } : { name: parts[0] }
}

const columnList = (raw: string) =>
  raw
    .split(',')
    .map((column) => objectName(column.trim()).name)
    .filter(Boolean)

const COLUMN_STOP =
  /\s+(?:DEFAULT|NOT\s+NULL|NULL|CONSTRAINT|PRIMARY\s+KEY|REFERENCES|UNIQUE|CHECK|GENERATED|ENABLE|DISABLE|COLLATE|INVISIBLE|VISIBLE|ENCRYPT)\b/i

function parseCreateTable(body: string, table: Table, relations: Relation[]) {
  for (const item of splitTopLevel(body)) {
    const constraint =
      /^(?:CONSTRAINT\s+\S+\s+)?(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK)\b/i.exec(item)

    if (constraint) {
      applyConstraint(item, table.name, table, relations)
      continue
    }

    const column = /^("[^"]+"|[\w$#]+)\s+(.*)$/s.exec(item)

    if (!column) continue

    const name = objectName(column[1]).name
    const rest = column[2]
    const type = rest.split(COLUMN_STOP)[0].trim().replace(/\s+/g, ' ')

    table.columns.push({
      name,
      type,
      primaryKey: /\bPRIMARY\s+KEY\b/i.test(rest),
      nullable: !/\bNOT\s+NULL\b/i.test(rest) && !/\bPRIMARY\s+KEY\b/i.test(rest),
    })

    const reference = new RegExp(String.raw`\bREFERENCES\s+(${NAME})\s*(?:\(([^)]*)\))?`, 'i').exec(
      rest,
    )

    if (reference) {
      relations.push({
        from: table.name,
        fromColumns: [name],
        to: objectName(reference[1]).name,
        toColumns: reference[2] ? columnList(reference[2]) : [],
      })
    }
  }
}

/** A table-level constraint, from CREATE TABLE or ALTER TABLE … ADD. */
function applyConstraint(
  text: string,
  tableName: string,
  table: Table | undefined,
  relations: Relation[],
) {
  const primary = /\bPRIMARY\s+KEY\s*\(([^)]*)\)/i.exec(text)

  if (primary && table) {
    for (const name of columnList(primary[1])) {
      const column = table.columns.find((item) => item.name === name)

      if (column) {
        column.primaryKey = true
        column.nullable = false
      }
    }
  }

  const foreign = new RegExp(
    String.raw`\bFOREIGN\s+KEY\s*\(([^)]*)\)\s*REFERENCES\s+(${NAME})\s*(?:\(([^)]*)\))?`,
    'i',
  ).exec(text)

  if (foreign) {
    relations.push({
      from: tableName,
      fromColumns: columnList(foreign[1]),
      to: objectName(foreign[2]).name,
      toColumns: foreign[3] ? columnList(foreign[3]) : [],
    })
  }
}

interface Statement {
  kind: ProgramKind | 'table' | 'package-body' | 'type-body'
  name: string
  schema?: string
  path: string
  /** From the CREATE keyword to the next CREATE in the same file. */
  text: string
  /** Where the object's own name ends, to read what follows it. */
  afterName: number
}

const STATEMENT = new RegExp(
  String.raw`${CREATE}(?:(GLOBAL\s+TEMPORARY\s+|PRIVATE\s+TEMPORARY\s+)?(TABLE)|(PACKAGE\s+BODY|PACKAGE|PROCEDURE|FUNCTION|TRIGGER|SEQUENCE|TYPE\s+BODY|TYPE|(?:MATERIALIZED\s+)?VIEW))\s+(${NAME})`,
  'gi',
)

function statementsOf(file: SourceFile): Statement[] {
  const code = stripSqlComments(file.text)
  const matches = [...code.matchAll(STATEMENT)]

  return matches.map((match, index) => {
    const keyword = (match[2] ?? match[3]).toUpperCase().replace(/\s+/g, ' ')
    const kind =
      keyword === 'TABLE'
        ? 'table'
        : keyword === 'PACKAGE BODY'
          ? 'package-body'
          : keyword === 'TYPE BODY'
            ? 'type-body'
            : keyword.endsWith('VIEW')
              ? 'view'
              : (keyword.toLowerCase() as ProgramKind)
    const end = matches[index + 1]?.index ?? code.length
    const text = code.slice(match.index, end)

    return {
      kind,
      ...objectName(match[4]),
      path: file.path,
      text,
      afterName: match[0].length,
    }
  })
}

const MEMBER = /\b(PROCEDURE|FUNCTION)\s+("[^"]+"|[\w$#]+)/gi

function membersOf(text: string): { kind: 'procedure' | 'function'; name: string }[] {
  // Skip the header itself: "CREATE PACKAGE BODY x AS".
  return [...text.matchAll(MEMBER)].map((match) => ({
    kind: match[1].toLowerCase() as 'procedure' | 'function',
    name: objectName(match[2]).name,
  }))
}

/** Tables a piece of PL/SQL or a view touches, among the tables the project defines. */
function tablesUsed(text: string, known: Set<string>, own: string): string[] {
  const found = new Set<string>()
  const add = (raw: string) => {
    const name = objectName(raw).name

    if (known.has(name) && name !== own) found.add(name)
  }

  for (const match of text.matchAll(
    new RegExp(String.raw`\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+(${NAME})`, 'gi'),
  )) {
    add(match[1])
  }

  // Anchored types: orders%ROWTYPE, orders.id%TYPE.
  for (const match of text.matchAll(new RegExp(String.raw`(${NAME})\s*%\s*ROWTYPE`, 'gi')))
    add(match[1])
  for (const match of text.matchAll(
    /("[^"]+"|[\w$#]+)\s*\.\s*(?:"[^"]+"|[\w$#]+)\s*%\s*TYPE\b/gi,
  )) {
    add(match[1])
  }

  // FROM a, b JOIN … : the other tables of a comma list.
  for (const match of text.matchAll(
    /\bFROM\s+([^;]*?)(?=\bWHERE\b|\bGROUP\b|\bORDER\b|\bCONNECT\b|;|\)|$)/gi,
  )) {
    for (const item of match[1].split(',')) {
      const name = objectName(item.trim().split(/\s+/)[0] ?? '').name

      if (known.has(name) && name !== own) found.add(name)
    }
  }

  return [...found].sort()
}

/** Tables, their relations and the PL/SQL around them, from the project's scripts. */
export function buildDbModel(sources: SourceFile[]): DbModel {
  const statements = sources.filter((source) => isPlsqlFile(source.path)).flatMap(statementsOf)
  const tables = new Map<string, Table>()
  const relations: Relation[] = []

  for (const statement of statements.filter((item) => item.kind === 'table')) {
    const open = statement.text.indexOf('(', statement.afterName - 1)

    // CREATE TABLE … AS SELECT has no column list: it still is a table.
    const body =
      open !== -1 && /^\s*\(/.test(statement.text.slice(statement.afterName))
        ? balanced(statement.text, open)
        : null
    const table = tables.get(statement.name) ?? {
      name: statement.name,
      schema: statement.schema,
      path: statement.path,
      columns: [],
    }

    if (body && table.columns.length === 0) parseCreateTable(body, table, relations)
    tables.set(statement.name, table)
  }

  // Keys added afterwards: ALTER TABLE x ADD CONSTRAINT … FOREIGN KEY …
  for (const source of sources.filter((item) => isPlsqlFile(item.path))) {
    const code = stripSqlComments(source.text)
    const alter = new RegExp(String.raw`\bALTER\s+TABLE\s+(${NAME})\s+ADD\b([^;]*)`, 'gi')

    for (const match of code.matchAll(alter)) {
      const name = objectName(match[1]).name

      applyConstraint(match[2], name, tables.get(name), relations)
    }
  }

  const known = new Set(tables.keys())
  const programs = new Map<string, Program>()
  const programOf = (kind: ProgramKind, name: string) => {
    const key = `${kind}:${name}`
    const program = programs.get(key) ?? { kind, name, paths: [], tables: [] }

    programs.set(key, program)

    return program
  }

  for (const statement of statements) {
    if (statement.kind === 'table') continue

    const body = statement.text.slice(statement.afterName)

    if (statement.kind === 'package' || statement.kind === 'package-body') {
      const program = programOf('package', statement.name)
      const members = membersOf(body)

      program.members ??= []

      if (statement.kind === 'package') {
        program.hasSpec = true
        for (const member of members) {
          const existing = program.members.find((item) => item.name === member.name)

          // Declared in the specification: public, even if the body was read first.
          if (existing) existing.public = true
          else program.members.push({ ...member, public: true })
        }
      } else {
        program.hasBody = true
        for (const member of members) {
          const existing = program.members.find((item) => item.name === member.name)

          if (!existing) program.members.push({ ...member, public: false })
        }
      }

      addPath(program, statement.path)
      program.tables = merge(program.tables, tablesUsed(body, known, statement.name))
      continue
    }

    if (statement.kind === 'type-body') {
      addPath(programOf('type', statement.name), statement.path)
      continue
    }

    const program = programOf(statement.kind, statement.name)

    addPath(program, statement.path)

    if (statement.kind === 'trigger') {
      const on = new RegExp(String.raw`\bON\s+(${NAME})`, 'i').exec(body)

      if (on) program.on = objectName(on[1]).name
    }

    if (statement.kind !== 'sequence' && statement.kind !== 'type') {
      program.tables = merge(program.tables, tablesUsed(body, known, statement.name))
    }
  }

  return {
    tables: [...tables.values()].sort((a, b) => a.name.localeCompare(b.name)),
    relations: dedupe(relations.filter((relation) => known.has(relation.from))),
    programs: [...programs.values()].sort(
      (a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name),
    ),
  }
}

const addPath = (program: Program, path: string) => {
  if (!program.paths.includes(path)) program.paths.push(path)
}

const merge = (a: string[], b: string[]) => [...new Set([...a, ...b])].sort()

function dedupe(relations: Relation[]): Relation[] {
  const seen = new Set<string>()

  return relations.filter((relation) => {
    const key = `${relation.from}(${relation.fromColumns})>${relation.to}`

    if (seen.has(key)) return false
    seen.add(key)

    return true
  })
}
