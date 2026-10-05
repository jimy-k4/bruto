import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import type { Note, Workspace } from '../../src/types'
import {
  WorkspaceFormatError,
  createEmptyWorkspace,
  parseWorkspace,
  serializeWorkspace,
} from '../../src/domain/workspace'
import { findGhost } from '../../src/domain/ghosts'

/** Where every project keeps its board, the same file the app reads and writes. */
export const BOARD_FILE = join('.bruto', 'workspace.json')

/** An error meant for the model: it says what went wrong and what to do about it. */
export class BoardError extends Error {}

/** The closest folder with a board, going up from `start`, never above `top` when given. */
function closestBoard(start: string, top?: string): string | null {
  let folder = resolve(start)

  for (;;) {
    if (existsSync(join(folder, BOARD_FILE))) return folder

    const parent = dirname(folder)

    if (parent === folder || (top && folder === resolve(top))) return null
    folder = parent
  }
}

/**
 * When `folder` is inside a linked git worktree (`git worktree add`), its
 * root and the main checkout's. Null in the main checkout itself, in a bare
 * repository, outside git, or when git isn't there to ask.
 */
export function linkedWorktree(folder: string): { worktree: string; main: string } | null {
  try {
    const [gitDir, commonDir, top] = execFileSync(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir', '--show-toplevel'],
      { cwd: folder, stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 },
    )
      .toString()
      .trim()
      .split(/\r?\n/)

    // Git before 2.31 echoes an option it doesn't know: then it can't say, and nothing changes.
    if (!gitDir || !commonDir || !top || gitDir.startsWith('-')) return null

    // The main checkout's .git is shared: a linked worktree's own lives in .git/worktrees/<name>.
    if (resolve(gitDir) === resolve(commonDir)) return null
    if (basename(commonDir) !== '.git') return null

    return { worktree: real(top), main: dirname(real(commonDir)) }
  } catch {
    return null
  }
}

/** A path as the file system spells it: git and a Windows short name (JLLINA~1) must agree. */
function real(path: string): string {
  try {
    return realpathSync.native(path)
  } catch {
    return resolve(path)
  }
}

export interface ProjectOptions {
  /** Use a worktree's own board, not the main checkout's. */
  ownWorktree?: boolean
}

/**
 * The folder whose board a tool started in `start` works on. Agents often run
 * in git worktrees: there, the same place in the main checkout comes first,
 * so answers land on the board the user has open rather than on a copy.
 */
export function boardFolder(start: string, { ownWorktree = false }: ProjectOptions = {}): string {
  const tree = ownWorktree ? null : linkedWorktree(start)

  return tree ? inMainCheckout(start, tree) : resolve(start)
}

/** The same place as `start`, in the main checkout. */
const inMainCheckout = (start: string, tree: { worktree: string; main: string }) =>
  join(tree.main, relative(tree.worktree, real(start)))

/**
 * The project that holds `start`: the closest folder, going up, with a Bruto
 * board. Inside a linked worktree, the main checkout's board comes first (up
 * to its root), then the worktree's own, as outside one.
 */
export function findProject(start: string, options: ProjectOptions = {}): string | null {
  const tree = options.ownWorktree ? null : linkedWorktree(start)

  if (tree) {
    const found = closestBoard(inMainCheckout(start, tree), tree.main)

    if (found) return found
  }

  return closestBoard(start)
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

const boardText = (root: string) => {
  try {
    return readFileSync(join(root, BOARD_FILE), 'utf8')
  } catch {
    return null
  }
}

/** Times a change starts over when the app saves the board under it, before writing anyway. */
const RACE_RETRIES = 3

/**
 * Reads, changes and writes the board in one go. If the file changed between
 * the read and the write (the app saved, say), the change starts over on
 * what's there now, so it never writes over someone else's save.
 */
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

  for (let attempt = 0; ; attempt++) {
    const before = boardText(root)
    const next = change(readBoard(root, options))

    if (attempt < RACE_RETRIES && boardText(root) !== before) continue

    writeBoard(root, next)

    return next
  }
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
    const found = findGhost(workspace, reference)

    if (found) {
      throw new BoardError(
        `[${found.ghost.id.slice(0, 6)}] ${found.ghost.title || 'Untitled'} is a ghost: a read-only copy of a note in project "${found.zone.project}". It is worked on in that project, never here.`,
      )
    }

    throw new BoardError(
      `No note has an id starting with "${reference}". Call list_notes to see them.`,
    )
  }

  throw new BoardError(
    `"${reference}" matches ${matches.length} notes (${matches.map((note) => note.id.slice(0, 8)).join(', ')}). Use more characters of the id.`,
  )
}
