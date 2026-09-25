import type { SourceFile } from '../storage/projectFiles'
import { SQL_EXTENSIONS } from './detect'
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
  /** Row level security is on: every read and write goes through its policies. */
  rls?: boolean
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
  'package' | 'procedure' | 'function' | 'view' | 'trigger' | 'sequence' | 'type' | 'policy'

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
  /** Triggers and policies: the table they belong to. */
  on?: string
  /** Policies: the command they cover (`select`, `insert`… or `all`). */
  command?: string
}

export interface DbModel {
  tables: Table[]
  relations: Relation[]
  programs: Program[]
}

/**
 * How unquoted names are written: Oracle folds them to upper case, PostgreSQL
 * and most others to lower case. Quoted names stay as they are.
 */
export type SqlDialect = 'oracle' | 'postgres' | 'sql'

export const isSqlFile = (path: string) => SQL_EXTENSIONS.has(extensionOf(path))

const NAME = String.raw`(?:"[^"]+"|[\w$#]+)(?:\s*\.\s*(?:"[^"]+"|[\w$#]+))?`
const CREATE = String.raw`\bCREATE\s+(?:OR\s+REPLACE\s+)?(?:(?:NON)?EDITIONABLE\s+)?(?:FORCE\s+|NO\s+FORCE\s+)?`
const IF_NOT_EXISTS = String.raw`(?:IF\s+NOT\s+EXISTS\s+)?`

/** Reads names the way the database does. */
function namer(dialect: SqlDialect) {
  const fold = (name: string) => (dialect === 'oracle' ? name.toUpperCase() : name.toLowerCase())

  /** `"Sales"."Orders"` → { schema: Sales, name: Orders }. */
  const objectName = (raw: string): { schema?: string; name: string } => {
    const parts = raw.split('.').map((part) => {
      const trimmed = part.trim()

      return trimmed.startsWith('"') ? trimmed.slice(1, -1) : fold(trimmed)
    })

    return parts.length > 1 ? { schema: parts[0], name: parts[1] } : { name: parts[0] }
  }

  const columnList = (raw: string) =>
    raw
      .split(',')
      .map((column) => objectName(column.trim()).name)
      .filter(Boolean)

  return { objectName, columnList }
}

type Names = ReturnType<typeof namer>

const COLUMN_STOP =
  /\s+(?:DEFAULT|NOT\s+NULL|NULL|CONSTRAINT|PRIMARY\s+KEY|REFERENCES|UNIQUE|CHECK|GENERATED|ENABLE|DISABLE|COLLATE|INVISIBLE|VISIBLE|ENCRYPT)\b/i

const TABLE_CONSTRAINT =
  /^(?:CONSTRAINT\s+\S+\s+)?(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|EXCLUDE)\b/i

/** One column definition: `total NUMBER(12,2) DEFAULT 0 REFERENCES …`. */
function addColumn(item: string, table: Table, relations: Relation[], names: Names) {
  const column = /^("[^"]+"|[\w$#]+)\s+(.*)$/s.exec(item.trim())

  if (!column) return

  const name = names.objectName(column[1]).name
  const rest = column[2]
  const type = rest.split(COLUMN_STOP)[0].trim().replace(/\s+/g, ' ')

  table.columns = table.columns.filter((existing) => existing.name !== name)
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
      to: names.objectName(reference[1]).name,
      toColumns: reference[2] ? names.columnList(reference[2]) : [],
    })
  }
}

/** A table-level constraint, from CREATE TABLE or ALTER TABLE … ADD. */
function applyConstraint(
  text: string,
  tableName: string,
  table: Table | undefined,
  relations: Relation[],
  names: Names,
) {
  const primary = /\bPRIMARY\s+KEY\s*\(([^)]*)\)/i.exec(text)

  if (primary && table) {
    for (const name of names.columnList(primary[1])) {
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
      fromColumns: names.columnList(foreign[1]),
      to: names.objectName(foreign[2]).name,
      toColumns: foreign[3] ? names.columnList(foreign[3]) : [],
    })
  }
}

function parseCreateTable(body: string, table: Table, relations: Relation[], names: Names) {
  for (const item of splitTopLevel(body)) {
    if (TABLE_CONSTRAINT.test(item)) applyConstraint(item, table.name, table, relations, names)
    else if (!/^LIKE\b/i.test(item)) addColumn(item, table, relations, names)
  }
}

/**
 * One action of `ALTER TABLE x …`: new columns and keys, dropped or renamed
 * columns, row level security. Migrations are mostly made of these.
 */
function applyAlter(
  action: string,
  table: Table | undefined,
  tableName: string,
  relations: Relation[],
  names: Names,
) {
  const text = action.trim()
  const add = /^ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([\s\S]*)$/i.exec(text)

  if (/^ENABLE\s+ROW\s+LEVEL\s+SECURITY\b/i.test(text)) {
    if (table) table.rls = true
  } else if (/^DISABLE\s+ROW\s+LEVEL\s+SECURITY\b/i.test(text)) {
    if (table) delete table.rls
  } else if (add) {
    const rest = add[1].trim()

    if (TABLE_CONSTRAINT.test(rest)) {
      applyConstraint(rest, tableName, table, relations, names)
    } else if (rest.startsWith('(') && table) {
      // Oracle: ADD (col type, col type)
      for (const item of splitTopLevel(balanced(rest, 0) ?? '')) {
        if (TABLE_CONSTRAINT.test(item)) applyConstraint(item, tableName, table, relations, names)
        else addColumn(item, table, relations, names)
      }
    } else if (table) {
      addColumn(rest, table, relations, names)
    }
  } else if (table) {
    const drop = /^DROP\s+(?:COLUMN\s+)?(?:IF\s+EXISTS\s+)?("[^"]+"|[\w$#]+)/i.exec(text)
    const rename = /^RENAME\s+(?:COLUMN\s+)?("[^"]+"|[\w$#]+)\s+TO\s+("[^"]+"|[\w$#]+)/i.exec(text)

    if (drop && !/^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE)$/i.test(drop[1])) {
      const name = names.objectName(drop[1]).name

      table.columns = table.columns.filter((column) => column.name !== name)
    } else if (rename) {
      const column = table.columns.find((item) => item.name === names.objectName(rename[1]).name)

      if (column) column.name = names.objectName(rename[2]).name
    }
  }
}

interface Statement {
  kind: ProgramKind | 'table' | 'package-body' | 'type-body'
  name: string
  schema?: string
  path: string
  index: number
  /** From the CREATE keyword to the end of the statement. */
  text: string
  /** Where the object's own name ends, to read what follows it. */
  afterName: number
}

const STATEMENT = new RegExp(
  String.raw`${CREATE}(?:(GLOBAL\s+TEMPORARY\s+|PRIVATE\s+TEMPORARY\s+|TEMP(?:ORARY)?\s+|UNLOGGED\s+)?(TABLE)|(PACKAGE\s+BODY|PACKAGE|PROCEDURE|FUNCTION|(?:CONSTRAINT\s+)?TRIGGER|SEQUENCE|TYPE\s+BODY|TYPE|POLICY|(?:MATERIALIZED\s+)?VIEW))\s+${IF_NOT_EXISTS}(${NAME})`,
  'gi',
)

/** Kinds with no code inside: they end at their first semicolon. */
const PLAIN = new Set(['table', 'view', 'sequence', 'policy'])

/** Where a statement starting at `start` ends, never past `limit` (the next CREATE). */
function statementEnd(code: string, start: number, limit: number, plain: boolean): number {
  // PostgreSQL bodies sit between dollar quotes: $$ … $$ or $body$ … $body$.
  const dollar = /\bAS\s+(\$\w*\$)/i.exec(code.slice(start, limit))

  if (dollar) {
    const open = start + dollar.index + dollar[0].length
    const close = code.indexOf(dollar[1], open)

    if (close !== -1) {
      const semicolon = code.indexOf(';', close + dollar[1].length)

      return semicolon === -1 || semicolon > limit ? limit : semicolon + 1
    }
  }

  if (!plain) return limit

  let depth = 0

  for (let index = start; index < limit; index++) {
    const char = code[index]

    if (char === "'" || char === '"') {
      const end = code.indexOf(char, index + 1)

      index = end === -1 ? limit : end
    } else if (char === '(') depth++
    else if (char === ')') depth--
    else if (char === ';' && depth <= 0) return index + 1
  }

  return limit
}

function statementsOf(file: SourceFile, code: string, names: Names): Statement[] {
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
              : keyword.endsWith('TRIGGER')
                ? 'trigger'
                : (keyword.toLowerCase() as ProgramKind)
    const limit = matches[index + 1]?.index ?? code.length
    const end = statementEnd(code, match.index, limit, PLAIN.has(kind))

    return {
      kind,
      ...names.objectName(match[4]),
      path: file.path,
      index: match.index,
      text: code.slice(match.index, end),
      afterName: match[0].length,
    }
  })
}

const MEMBER = /\b(PROCEDURE|FUNCTION)\s+("[^"]+"|[\w$#]+)/gi

function membersOf(text: string, names: Names): { kind: 'procedure' | 'function'; name: string }[] {
  // Skip the header itself: "CREATE PACKAGE BODY x AS".
  return [...text.matchAll(MEMBER)].map((match) => ({
    kind: match[1].toLowerCase() as 'procedure' | 'function',
    name: names.objectName(match[2]).name,
  }))
}

/** Tables a piece of code or a view touches, among the tables the project defines. */
function tablesUsed(text: string, known: Set<string>, own: string, names: Names): string[] {
  const found = new Set<string>()
  const add = (raw: string) => {
    const name = names.objectName(raw).name

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
      const name = names.objectName(item.trim().split(/\s+/)[0] ?? '').name

      if (known.has(name) && name !== own) found.add(name)
    }
  }

  return [...found].sort()
}

/** Tables and what changes them, in the order the scripts run: file by file, top to bottom. */
type TableEvent =
  | { at: [string, number]; kind: 'create'; statement: Statement }
  | { at: [string, number]; kind: 'alter'; name: string; actions: string }
  | { at: [string, number]; kind: 'drop'; name: string }

const byPosition = (a: TableEvent, b: TableEvent) =>
  a.at[0].localeCompare(b.at[0]) || a.at[1] - b.at[1]

/** Tables, their relations and the code around them, from the project's SQL scripts. */
export function buildDbModel(sources: SourceFile[], dialect: SqlDialect = 'oracle'): DbModel {
  const names = namer(dialect)
  const files = sources
    .filter((source) => isSqlFile(source.path))
    .map((source) => ({ source, code: stripSqlComments(source.text) }))
  const statements = files.flatMap(({ source, code }) => statementsOf(source, code, names))
  const events: TableEvent[] = statements
    .filter((statement) => statement.kind === 'table')
    .map((statement) => ({ at: [statement.path, statement.index], kind: 'create', statement }))

  for (const { source, code } of files) {
    const alter = new RegExp(
      String.raw`\bALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(${NAME})\s+([^;]*)`,
      'gi',
    )
    const drop = new RegExp(String.raw`\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(${NAME})`, 'gi')

    for (const match of code.matchAll(alter)) {
      events.push({
        at: [source.path, match.index],
        kind: 'alter',
        name: names.objectName(match[1]).name,
        actions: match[2],
      })
    }

    for (const match of code.matchAll(drop)) {
      events.push({
        at: [source.path, match.index],
        kind: 'drop',
        name: names.objectName(match[1]).name,
      })
    }
  }

  const tables = new Map<string, Table>()
  let relations: Relation[] = []

  for (const event of events.sort(byPosition)) {
    if (event.kind === 'create') {
      const { statement } = event
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

      if (body && table.columns.length === 0) parseCreateTable(body, table, relations, names)
      tables.set(statement.name, table)
    } else if (event.kind === 'alter') {
      for (const action of splitTopLevel(event.actions)) {
        applyAlter(action, tables.get(event.name), event.name, relations, names)
      }
    } else {
      tables.delete(event.name)
      relations = relations.filter((item) => item.from !== event.name && item.to !== event.name)
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
      const members = membersOf(body, names)

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
      program.tables = merge(program.tables, tablesUsed(body, known, statement.name, names))
      continue
    }

    if (statement.kind === 'type-body') {
      addPath(programOf('type', statement.name), statement.path)
      continue
    }

    const on = new RegExp(String.raw`\bON\s+(${NAME})`, 'i').exec(body)

    if (statement.kind === 'policy') {
      // Policies share names across tables ("Users can read their own rows"): key them by both.
      const table = on ? names.objectName(on[1]).name : ''
      const program = programOf('policy', `${statement.name}@${table}`)

      program.name = statement.name
      program.on = table || undefined
      program.command =
        /\bFOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)\b/i.exec(body)?.[1].toLowerCase() ?? 'all'
      addPath(program, statement.path)
      continue
    }

    const program = programOf(statement.kind, statement.name)

    addPath(program, statement.path)

    if (statement.kind === 'trigger' && on) program.on = names.objectName(on[1]).name

    if (statement.kind !== 'sequence' && statement.kind !== 'type') {
      program.tables = merge(program.tables, tablesUsed(body, known, statement.name, names))
    }
  }

  return {
    tables: [...tables.values()].sort((a, b) => a.name.localeCompare(b.name)),
    relations: dedupe(
      relations.filter((relation) => known.has(relation.from) && known.has(relation.to)),
    ),
    programs: [...programs.values()].sort(
      (a, b) =>
        a.kind.localeCompare(b.kind) ||
        (a.on ?? '').localeCompare(b.on ?? '') ||
        a.name.localeCompare(b.name),
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
