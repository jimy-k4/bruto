import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import type { Note, Workspace } from '../../src/types'
import {
  WorkspaceFormatError,
  createEmptyWorkspace,
  parseWorkspace,
  serializeWorkspace,
} from '../../src/domain/workspace'

/** Where every project keeps its board, the same file the app reads and writes. */
export const BOARD_FILE = join('.bruto', 'workspace.json')

/** An error meant for the model: it says what went wrong and what to do about it. */
export class BoardError extends Error {}

/** The project that holds `start`: the closest folder, going up, with a Bruto board. */
export function findProject(start: string): string | null {
  let folder = resolve(start)

  for (;;) {
    if (existsSync(join(folder, BOARD_FILE))) return folder

    const parent = dirname(folder)

    if (parent === folder) return null
    folder = parent
  }
}

const titleOf = (root: string) => basename(root).toUpperCase() || 'BRUTO'

/** The board of a project. A broken file is reported, never replaced. */
export function readBoard(root: string, { createIfMissing = false } = {}): Workspace {
  const path = join(root, BOARD_FILE)

  if (!existsSync(path)) {
    if (createIfMissing) return createEmptyWorkspace(titleOf(root))

    throw new BoardError(
      `There is no Bruto board in ${root}. Open the folder in Bruto (https://jimy-k4.github.io/bruto/) or create a note first.`,
    )
  }

  try {
    return parseWorkspace(readFileSync(path, 'utf8'), titleOf(root))
  } catch (error) {
    if (error instanceof WorkspaceFormatError) {
      throw new BoardError(
        `${BOARD_FILE} in ${root} is not valid: ${error.message} Fix the file (or restore a backup from .bruto/backups) before changing notes.`,
      )
    }

    throw error
  }
}

/**
 * Writes the whole file at once: to a temporary file first, then renamed over
 * the board, so the app (which reloads it every second and a half) never
 * reads half of it.
 */
export function writeBoard(root: string, workspace: Workspace) {
  const path = join(root, BOARD_FILE)
  const temporary = `${path}.${process.pid}.tmp`

  writeFileSync(temporary, serializeWorkspace(workspace))
  renameSync(temporary, path)
}

/** Reads, changes and writes the board in one go, as close together as possible. */
export function changeBoard(
  root: string,
  change: (workspace: Workspace) => Workspace,
  options?: { createIfMissing?: boolean },
): Workspace {
  if (options?.createIfMissing) {
    // A board can be started in an existing project folder, never in a made-up one.
    if (!existsSync(root)) throw new BoardError(`The folder ${root} does not exist.`)
    mkdirSync(join(root, '.bruto'), { recursive: true })
  }

  const next = change(readBoard(root, options))

  writeBoard(root, next)

  return next
}

/**
 * A note by the start of its id, as the AI context writes it: `a1b2c3` or
 * `[a1b2c3]`. Refuses to guess between several.
 */
export function resolveNote(workspace: Workspace, reference: string): Note {
  const prefix = reference
    .trim()
    .replace(/^\[|\]$/g, '')
    .toLowerCase()
  const matches = prefix
    ? workspace.notes.filter((note) => note.id.toLowerCase().startsWith(prefix))
    : []

  if (matches.length === 1) return matches[0]

  if (matches.length === 0) {
    throw new BoardError(
      `No note has an id starting with "${reference}". Call list_notes to see them.`,
    )
  }

  throw new BoardError(
    `"${reference}" matches ${matches.length} notes (${matches.map((note) => note.id.slice(0, 8)).join(', ')}). Use more characters of the id.`,
  )
}
