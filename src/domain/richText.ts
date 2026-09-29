/**
 * The Markdown notes show, without a library. Blocks: headings, lists (nested,
 * numbered), quotes, tables, rules and paragraphs; code fenced with ``` (or ~~~),
 * or alone on its line, becomes a block that can be copied. Inside a line:
 * **bold**, *italic*, ~~struck~~, links and `code`.
 *
 * Unlike strict Markdown, a single line break stays a line break, as people
 * write in a note, and a line that isn't indented ends the list above it.
 */

export type Inline =
  | { kind: 'text'; value: string }
  | { kind: 'code'; value: string }
  | { kind: 'strong' | 'em' | 'strike'; children: Inline[] }
  | { kind: 'link'; href: string; children: Inline[] }

export interface ListItem {
  parts: Inline[]
  /** Lists indented under this item. */
  lists: ListBlock[]
}

export interface ListBlock {
  kind: 'list'
  ordered: boolean
  /** The first number, when it isn't 1. */
  start?: number
  items: ListItem[]
}

export type Align = 'left' | 'center' | 'right' | null

export interface CodeBlock {
  kind: 'code'
  code: string
  language?: string
}

export type Block =
  | { kind: 'paragraph'; parts: Inline[] }
  | { kind: 'heading'; level: number; parts: Inline[] }
  | ListBlock
  | { kind: 'quote'; blocks: Block[] }
  | { kind: 'table'; align: Align[]; head: Inline[][]; rows: Inline[][][] }
  | { kind: 'rule' }
  | CodeBlock

// Inline ----------------------------------------------------------------------

/** `code`, or ``code with a ` inside``: on one line, and never read as formatting. */
const CODE_SPAN = /(?<![`\\])(`+)(?!`)(.+?)(?<!`)\1(?!`)/g

/** Stands in for a code span while the rest of the line is read. */
const SPAN_MARK = /(\d+)/

/** [text](address), the address with one level of brackets at most: https://…/Tree_(graph). */
const LINK = /^\[([^\]\n]+)\]\(<?((?:[^\s<>()]|\([^\s<>()]*\))+)>?\)/
const ANGLE_URL = /^<(https?:\/\/[^\s<>]+)>/
const BARE_URL = /^https?:\/\/[^\s<>]+/

/** A backslash only escapes what could be formatting: Windows paths keep theirs (C:\Users\.claude). */
const ESCAPABLE = '*_~`[]|#>+-'

/** Longest first, so ** is never read as two *. */
const DELIMITERS = [
  ['**', 'strong'],
  ['__', 'strong'],
  ['~~', 'strike'],
  ['*', 'em'],
  ['_', 'em'],
] as const

const WORD = /[\p{L}\p{N}]/u
const SPACE = /\s/

/** Web and mail addresses only: a link to anything else keeps just its text. */
const safeHref = (href: string) => (/^(https?:|mailto:)/i.test(href) ? href : null)

/** Where a delimiter opened at `from` closes, or -1. */
function findCloser(text: string, delimiter: string, from: number): number {
  const underscore = delimiter[0] === '_'

  for (let at = text.indexOf(delimiter, from); at !== -1;) {
    let end = at
    while (text[end] === delimiter[0]) end++

    // A single * doesn't close on a **: that one belongs to bold inside.
    const close = delimiter.length === 1 && end - at === 2 ? -1 : end - delimiter.length
    const before = text[close - 1]

    if (
      close > from &&
      !SPACE.test(before) &&
      before !== '\\' &&
      !(underscore && WORD.test(text[close + delimiter.length] ?? ''))
    )
      return close

    at = text.indexOf(delimiter, end)
  }

  return -1
}

function append(parts: Inline[], part: Inline) {
  const last = parts.at(-1)

  if (part.kind === 'text' && last?.kind === 'text') last.value += part.value
  else if (part.kind !== 'text' || part.value) parts.push(part)
}

/** An address ends before the punctuation that follows it, and before an unmatched ). */
function trimUrl(url: string) {
  let end = url.length

  while (end > 0) {
    const char = url[end - 1]
    const opened = url.slice(0, end).split('(').length
    const closed = url.slice(0, end).split(')').length

    if ('.,;:!?\'"*_~'.includes(char) || (char === ')' && closed > opened)) end--
    else break
  }

  return url.slice(0, end)
}

function scan(text: string): Inline[] {
  const parts: Inline[] = []
  let index = 0

  const addText = (value: string) => append(parts, { kind: 'text', value })

  outer: while (index < text.length) {
    const char = text[index]
    const rest = text.slice(index)

    if (char === '\\' && ESCAPABLE.includes(text[index + 1] ?? '')) {
      addText(text[index + 1])
      index += 2
      continue
    }

    if (char === '[') {
      const link = LINK.exec(rest)

      if (link) {
        const href = safeHref(link[2])
        const children = scan(link[1])

        if (href) append(parts, { kind: 'link', href, children })
        else children.forEach((child) => append(parts, child))
        index += link[0].length
        continue
      }
    }

    if (char === '<') {
      const url = ANGLE_URL.exec(rest)

      if (url) {
        append(parts, { kind: 'link', href: url[1], children: [{ kind: 'text', value: url[1] }] })
        index += url[0].length
        continue
      }
    }

    if (char === 'h' && !WORD.test(text[index - 1] ?? '')) {
      const url = BARE_URL.exec(rest)

      if (url) {
        const href = trimUrl(url[0])

        append(parts, { kind: 'link', href, children: [{ kind: 'text', value: href }] })
        index += href.length
        continue
      }
    }

    const run = /^([*_~])\1*/.exec(rest)?.[0] ?? char

    for (const [delimiter, kind] of DELIMITERS) {
      // A ** that doesn't close is not two *: in src/**/*.ts it is just text.
      if (!run.startsWith(delimiter) || (delimiter.length === 1 && run.length === 2)) continue

      const after = text[index + delimiter.length] ?? ''
      const opens =
        after !== '' &&
        !SPACE.test(after) &&
        !(delimiter[0] === '_' && WORD.test(text[index - 1] ?? ''))
      const close = opens ? findCloser(text, delimiter, index + delimiter.length) : -1

      if (close !== -1) {
        append(parts, { kind, children: scan(text.slice(index + delimiter.length, close)) })
        index = close + delimiter.length
        continue outer
      }
    }

    addText(run)
    index += run.length
  }

  return parts
}

/** Puts the code spans back where their marks are. */
function restoreSpans(parts: Inline[], spans: string[]): Inline[] {
  const restored: Inline[] = []

  for (const part of parts) {
    if (part.kind === 'text') {
      part.value
        .split(SPAN_MARK)
        .forEach((piece, position) =>
          append(
            restored,
            position % 2
              ? { kind: 'code', value: spans[Number(piece)] }
              : { kind: 'text', value: piece },
          ),
        )
    } else if ('children' in part) {
      restored.push({ ...part, children: restoreSpans(part.children, spans) })
    } else {
      restored.push(part)
    }
  }

  return restored
}

export function parseInline(text: string): Inline[] {
  const spans: string[] = []
  const masked = text.replace(CODE_SPAN, (_, _fence, code: string) => {
    // `` `x` `` keeps its backticks: one space each side is only padding.
    spans.push(/^ .*[^ ].* $/.test(code) ? code.slice(1, -1) : code)
    return `${spans.length - 1}`
  })

  return restoreSpans(scan(masked), spans)
}

// Blocks ----------------------------------------------------------------------

const FENCE = /^\s*(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/

/** A line that is only `one piece of code`: a command meant to be copied as a whole. */
const LONE_CODE = /^\s*`([^`]+)`\s*$/

const HEADING = /^ {0,3}(#{1,6})[ \t]+(\S.*?)(?:[ \t]+#+)?[ \t]*$/
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/
const QUOTE = /^ {0,3}>[ \t]?(.*)$/
const LIST_ITEM = /^([ \t]*)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/
const TABLE_DIVIDER = /^[ \t]*\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/

const blank = (line: string) => line.trim() === ''
const indentOf = (line: string) => /^[ \t]*/.exec(line)![0].replace(/\t/g, '    ').length

/** A table row's cells. A | inside `code` or escaped as \| stays in its cell. */
function splitRow(line: string): string[] {
  const cells: string[] = []
  let cell = ''
  const row = line.trim().replace(/^\|/, '')

  for (let index = 0; index < row.length; index++) {
    const char = row[index]

    if (char === '\\' && row[index + 1] === '|') {
      cell += '|'
      index++
    } else if (char === '`') {
      const fence = /^`+/.exec(row.slice(index))![0]
      const close = row.indexOf(fence, index + fence.length)
      const end = close === -1 ? index + fence.length : close + fence.length

      cell += row.slice(index, end)
      index = end - 1
    } else if (char === '|') {
      cells.push(cell)
      cell = ''
    } else {
      cell += char
    }
  }

  // A closing | leaves nothing after it; a row without one ends in its last cell.
  if (cell.trim() || !row.trimEnd().endsWith('|')) cells.push(cell)

  return cells.map((text) => text.trim())
}

const isTableStart = (lines: string[], index: number) =>
  lines[index].includes('|') &&
  index + 1 < lines.length &&
  TABLE_DIVIDER.test(lines[index + 1]) &&
  splitRow(lines[index]).length === splitRow(lines[index + 1]).length

const alignOf = (divider: string): Align =>
  divider.startsWith(':') && divider.endsWith(':')
    ? 'center'
    : divider.endsWith(':')
      ? 'right'
      : divider.startsWith(':')
        ? 'left'
        : null

const isListItem = (line: string) => LIST_ITEM.test(line) && !RULE.test(line)

/** Whether a line starts a block of its own, ending the paragraph above it. */
const startsBlock = (lines: string[], index: number) => {
  const line = lines[index]

  return (
    FENCE.test(line) ||
    LONE_CODE.test(line) ||
    HEADING.test(line) ||
    RULE.test(line) ||
    QUOTE.test(line) ||
    isListItem(line) ||
    isTableStart(lines, index)
  )
}

interface RawItem {
  indent: number
  ordered: boolean
  number: number
  lines: string[]
}

/** The items of the list starting at `start`, and the line after it. */
function readListItems(lines: string[], start: number) {
  const items: RawItem[] = []
  let index = start

  while (index < lines.length) {
    const line = lines[index]
    const item = isListItem(line) && LIST_ITEM.exec(line)

    if (item) {
      items.push({
        indent: indentOf(item[1]),
        ordered: /\d/.test(item[2]),
        number: Number.parseInt(item[2], 10) || 1,
        lines: [item[3]],
      })
      index++
      continue
    }

    // Code always stands on its own, so it can be copied.
    if (FENCE.test(line) || LONE_CODE.test(line)) break

    if (blank(line)) {
      let next = index
      while (next < lines.length && blank(lines[next])) next++

      // A blank line inside the list, when the list goes on after it.
      if (next < lines.length && (isListItem(lines[next]) || indentOf(lines[next]) > 0)) {
        if (!isListItem(lines[next])) items.at(-1)!.lines.push('')
        index = next
        continue
      }

      break
    }

    // Indented lines carry on the item above; one that isn't ends the list.
    if (indentOf(line) === 0) break

    items.at(-1)!.lines.push(line.trim())
    index++
  }

  return { items, next: index }
}

function buildLists(items: RawItem[]): ListBlock[] {
  const lists: ListBlock[] = []
  // The open lists, from the outermost in, with where each one goes.
  const stack: { indent: number; list: ListBlock; siblings: ListBlock[] }[] = []

  for (const raw of items) {
    const item: ListItem = { parts: parseInline(raw.lines.join('\n').trimEnd()), lists: [] }
    const newList = (): ListBlock => ({
      kind: 'list',
      ordered: raw.ordered,
      ...(raw.ordered && raw.number !== 1 && { start: raw.number }),
      items: [item],
    })

    while (stack.length && raw.indent < stack.at(-1)!.indent) stack.pop()

    const level = stack.at(-1)

    if (level && raw.indent > level.indent) {
      const parent = level.list.items.at(-1)!
      const list = newList()

      parent.lists.push(list)
      stack.push({ indent: raw.indent, list, siblings: parent.lists })
    } else if (level && level.list.ordered === raw.ordered) {
      level.list.items.push(item)
    } else {
      // The first item, or the other kind of list at the same depth: a list of its own.
      const siblings = level?.siblings ?? lists
      const list = newList()

      if (level) stack.pop()
      siblings.push(list)
      stack.push({ indent: raw.indent, list, siblings })
    }
  }

  return lists
}

export function parseRichText(text: string): Block[] {
  const blocks: Block[] = []
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (blank(line)) {
      index++
      continue
    }

    const fence = FENCE.exec(line)

    if (fence) {
      const marker = fence[1]
      const code: string[] = []
      // The block ends at a fence of the same kind, at least as long; an unclosed one runs to the end.
      const closing = new RegExp(`^\\s*${marker[0]}{${marker.length},}\\s*$`)

      index++
      while (index < lines.length && !closing.test(lines[index])) code.push(lines[index++])
      index++

      blocks.push({ kind: 'code', code: code.join('\n'), ...(fence[2] && { language: fence[2] }) })
      continue
    }

    const lone = LONE_CODE.exec(line)

    if (lone) {
      blocks.push({ kind: 'code', code: lone[1].trim() })
      index++
      continue
    }

    const heading = HEADING.exec(line)

    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, parts: parseInline(heading[2]) })
      index++
      continue
    }

    if (RULE.test(line)) {
      blocks.push({ kind: 'rule' })
      index++
      continue
    }

    if (QUOTE.test(line)) {
      const quoted: string[] = []

      while (index < lines.length && QUOTE.test(lines[index]))
        quoted.push(QUOTE.exec(lines[index++])![1])

      blocks.push({ kind: 'quote', blocks: parseRichText(quoted.join('\n')) })
      continue
    }

    if (isListItem(line)) {
      const { items, next } = readListItems(lines, index)

      blocks.push(...buildLists(items))
      index = next
      continue
    }

    if (isTableStart(lines, index)) {
      const head = splitRow(line)
      const align = splitRow(lines[index + 1]).map(alignOf)
      const rows: Inline[][][] = []

      index += 2
      while (index < lines.length && !blank(lines[index]) && lines[index].includes('|')) {
        const cells = splitRow(lines[index++])

        rows.push(head.map((_, column) => parseInline(cells[column] ?? '')))
      }

      blocks.push({ kind: 'table', align, head: head.map(parseInline), rows })
      continue
    }

    // A paragraph runs to a blank line or to the next block; its line breaks stay.
    const paragraph = [line]

    index++
    while (index < lines.length && !blank(lines[index]) && !startsBlock(lines, index))
      paragraph.push(lines[index++])

    blocks.push({ kind: 'paragraph', parts: parseInline(paragraph.join('\n')) })
  }

  return blocks
}

// Code ------------------------------------------------------------------------

const inlineHasCode = (parts: Inline[]): boolean =>
  parts.some((part) => part.kind === 'code' || ('children' in part && inlineHasCode(part.children)))

const blockHasCode = (block: Block): boolean => {
  switch (block.kind) {
    case 'code':
      return true
    case 'paragraph':
    case 'heading':
      return inlineHasCode(block.parts)
    case 'list':
      return block.items.some((item) => inlineHasCode(item.parts) || item.lists.some(blockHasCode))
    case 'quote':
      return block.blocks.some(blockHasCode)
    case 'table':
      return [block.head, ...block.rows].some((row) => row.some(inlineHasCode))
    case 'rule':
      return false
  }
}

const codeBlocksIn = (blocks: Block[]): CodeBlock[] =>
  blocks.flatMap((block) =>
    block.kind === 'code' ? [block] : block.kind === 'quote' ? codeBlocksIn(block.blocks) : [],
  )

/** Every block of code in a text, quoted ones included. */
export const codeBlocks = (text: string | undefined) => codeBlocksIn(parseRichText(text ?? ''))

/** Whether a text has any code at all: a block, or `code` inside a line. */
export const hasCode = (text: string | undefined) =>
  Boolean(text) && parseRichText(text!).some(blockHasCode)

/** Whether a text has any code worth a copy button. */
export const hasCodeBlocks = (text: string | undefined) => codeBlocks(text).length > 0
