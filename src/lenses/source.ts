/** Small helpers shared by the lens parsers. They work on paths and plain text only. */

export const extensionOf = (path: string) => {
  const name = path.slice(path.lastIndexOf('/') + 1)
  const dot = name.lastIndexOf('.')

  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1)

/** File name without its extension(s): `Button.test.tsx` → `Button.test`. */
export const stemOf = (path: string) => {
  const name = baseName(path)
  const dot = name.lastIndexOf('.')

  return dot > 0 ? name.slice(0, dot) : name
}

export const dirName = (path: string) => {
  const slash = path.lastIndexOf('/')

  return slash === -1 ? '' : path.slice(0, slash)
}

/** Resolves `.` and `..` segments. */
export function joinPath(directory: string, relative: string): string {
  const parts: string[] = directory ? directory.split('/') : []

  for (const part of relative.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }

  return parts.join('/')
}

/**
 * Removes comments from C-like code (C#, JS, TS) while keeping string
 * literals, which hold routes. Comments are replaced by spaces so that
 * positions and line breaks stay where they were.
 */
export function stripCComments(code: string): string {
  let out = ''
  let index = 0

  while (index < code.length) {
    const char = code[index]
    const next = code[index + 1]

    if (char === '/' && next === '/') {
      while (index < code.length && code[index] !== '\n') {
        out += ' '
        index++
      }
    } else if (char === '/' && next === '*') {
      const end = code.indexOf('*/', index + 2)
      const stop = end === -1 ? code.length : end + 2

      out += code.slice(index, stop).replace(/[^\n]/g, ' ')
      index = stop
    } else if (char === '"' || char === "'" || char === '`') {
      // Verbatim C# strings (@"...") escape quotes by doubling them.
      const verbatim = char === '"' && code[index - 1] === '@'
      let end = index + 1

      while (end < code.length) {
        if (!verbatim && code[end] === '\\') {
          end += 2
          continue
        }
        if (code[end] === char) {
          if (verbatim && code[end + 1] === char) {
            end += 2
            continue
          }
          break
        }
        if (code[end] === '\n' && char !== '`' && !verbatim) break
        end++
      }

      out += code.slice(index, end + 1)
      index = end + 1
    } else {
      out += char
      index++
    }
  }

  return out
}

/** Removes `--` and `/* *\/` comments from SQL, keeping 'strings' as they are. */
export function stripSqlComments(sql: string): string {
  let out = ''
  let index = 0

  while (index < sql.length) {
    const char = sql[index]
    const next = sql[index + 1]

    if (char === '-' && next === '-') {
      while (index < sql.length && sql[index] !== '\n') index++
    } else if (char === '/' && next === '*') {
      const end = sql.indexOf('*/', index + 2)
      const stop = end === -1 ? sql.length : end + 2

      out += sql.slice(index, stop).replace(/[^\n]/g, ' ')
      index = stop
    } else if (char === "'") {
      let end = index + 1

      while (end < sql.length) {
        if (sql[end] === "'" && sql[end + 1] === "'") end += 2
        else if (sql[end] === "'") break
        else end++
      }

      out += sql.slice(index, end + 1)
      index = end + 1
    } else {
      out += char
      index++
    }
  }

  return out
}

/** The text between the bracket at `open` and its matching closing bracket. */
export function balanced(text: string, open: number, pair = '()'): string | null {
  const [left, right] = pair
  let depth = 0

  for (let index = open; index < text.length; index++) {
    if (text[index] === left) depth++
    else if (text[index] === right) {
      depth--
      if (depth === 0) return text.slice(open + 1, index)
    }
  }

  return null
}

/** Splits on commas that aren't inside brackets (and `<…>` generics when `angles`). */
export function splitTopLevel(text: string, angles = false): string[] {
  const opening = angles ? '([{<' : '([{'
  const closing = angles ? ')]}>' : ')]}'
  const separator = ','
  const parts: string[] = []
  let depth = 0
  let start = 0

  for (let index = 0; index < text.length; index++) {
    const char = text[index]

    if (opening.includes(char)) depth++
    else if (closing.includes(char)) depth--
    else if (char === separator && depth === 0) {
      parts.push(text.slice(start, index))
      start = index + 1
    }
  }

  parts.push(text.slice(start))

  return parts.map((part) => part.trim()).filter(Boolean)
}

/** Joins route pieces the way routers do: `/api` + `orders/:id` → `/api/orders/:id`. */
export function joinRoute(...parts: string[]): string {
  const joined = parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join('/')

  return `/${joined}`.replace(/\/+/g, '/').replace(/(.)\/$/, '$1')
}

/** The first quoted string in a piece of code: `('orders')`, `({ path: "x" })` → the text. */
export const firstString = (text: string | undefined) =>
  /(['"`])((?:(?!\1)[^\\]|\\.)*)\1/.exec(text ?? '')?.[2]

/** Decorators or annotations with their arguments, one bracket level deep: `@Get(':id')`. */
export const ANNOTATION = String.raw`@[\w.]+(?:\s*\((?:[^()]|\([^()]*\))*\))?`

/** The chain of decorators or annotations written right before `index`. */
export function annotationsBefore(code: string, index: number): string {
  const before = code.slice(Math.max(0, index - 2000), index)

  return (
    new RegExp(
      String.raw`((?:${ANNOTATION}\s*)*)(?:(?:export|default|public|private|protected|static|final|abstract|async|open|sealed)\s+)*$`,
    ).exec(before)?.[1] ?? ''
  )
}
