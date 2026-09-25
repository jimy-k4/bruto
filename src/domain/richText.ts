/**
 * The little Markdown notes need: code fenced with ``` (or ~~~) becomes a
 * block that can be copied, `code` between backticks stays in the line.
 * Everything else is plain text, shown as written.
 */

export type Inline = { kind: 'text'; value: string } | { kind: 'code'; value: string }

export type Block =
  { kind: 'text'; parts: Inline[] } | { kind: 'code'; code: string; language?: string }

const FENCE = /^\s*(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/

/** A line that is only `one piece of code`: a command meant to be copied as a whole. */
const LONE_CODE = /^\s*`([^`]+)`\s*$/

function inlineParts(text: string): Inline[] {
  const parts: Inline[] = []
  let last = 0

  for (const match of text.matchAll(/`([^`\n]+)`/g)) {
    if (match.index > last) parts.push({ kind: 'text', value: text.slice(last, match.index) })
    parts.push({ kind: 'code', value: match[1] })
    last = match.index + match[0].length
  }

  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) })

  return parts
}

export function parseRichText(text: string): Block[] {
  const blocks: Block[] = []
  const lines = text.split('\n')
  let prose: string[] = []

  const flushProse = () => {
    const joined = prose.join('\n')

    // Blank lines around code are the code's spacing, not text of their own.
    if (joined.trim())
      blocks.push({ kind: 'text', parts: inlineParts(joined.replace(/^\n+|\n+$/g, '')) })
    prose = []
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const fence = FENCE.exec(line)

    if (fence) {
      const marker = fence[1]
      const code: string[] = []

      index++
      // The block ends at a fence of the same kind, at least as long; an unclosed one runs to the end.
      while (
        index < lines.length &&
        !new RegExp(`^\\s*${marker[0]}{${marker.length},}\\s*$`).test(lines[index])
      ) {
        code.push(lines[index])
        index++
      }

      flushProse()
      blocks.push({ kind: 'code', code: code.join('\n'), ...(fence[2] && { language: fence[2] }) })
      continue
    }

    const lone = LONE_CODE.exec(line)

    if (lone) {
      flushProse()
      blocks.push({ kind: 'code', code: lone[1].trim() })
      continue
    }

    prose.push(line)
  }

  flushProse()

  return blocks
}

/** Whether a text has any code at all: a block, or `code` inside a line. */
export const hasCode = (text: string | undefined) =>
  Boolean(text) &&
  parseRichText(text!).some(
    (block) => block.kind === 'code' || block.parts.some((part) => part.kind === 'code'),
  )

/** Whether a text has any code worth a copy button. */
export const hasCodeBlocks = (text: string | undefined) =>
  Boolean(text) && parseRichText(text!).some((block) => block.kind === 'code')
