import type { Workspace } from '../types'
import { WorkspaceFormatError, parseWorkspace } from '../domain/workspace'
import {
  type SyncStamps,
  isConflictCopyName,
  mergeCopy,
  readSyncStamps,
} from '../domain/syncStamps'

export const BRUTO_DIRECTORY = '.bruto'
const WORKSPACE_FILE = 'workspace.json'
const BACKUP_DIRECTORY = 'backups'
const BACKUPS_TO_KEEP = 10

/** What is on disk right now. */
export type DiskState =
  | { kind: 'missing' }
  | { kind: 'invalid'; text: string; error: string }
  | {
      kind: 'ok'
      /** Exactly what `workspace.json` holds. */
      text: string
      /** The board, with any conflicted copies merged in. */
      workspace: Workspace
      stamps?: SyncStamps
      /** Conflicted copies a sync tool left, merged into `workspace`: archive them once it is saved. */
      copies?: string[]
    }

const queues = new Map<string, Promise<unknown>>()

/**
 * Runs file work on one project's board after any other in this page is done.
 * Two writers swapping the same file in at once make the browser fail one of
 * them, and a read in between can find no file at all. Keyed by folder name:
 * two folders with the same name only wait for each other, which is harmless.
 */
export function exclusive<T>(root: FileSystemDirectoryHandle, run: () => Promise<T>): Promise<T> {
  const previous = queues.get(root.name) ?? Promise.resolve()
  const next = previous.then(run, run)

  queues.set(
    root.name,
    next.catch(() => undefined),
  )

  return next
}

export function getBrutoDirectory(root: FileSystemDirectoryHandle) {
  return root.getDirectoryHandle(BRUTO_DIRECTORY, { create: true })
}

async function getWorkspaceFile(root: FileSystemDirectoryHandle): Promise<File | null> {
  try {
    const directory = await root.getDirectoryHandle(BRUTO_DIRECTORY)
    const handle = await directory.getFileHandle(WORKSPACE_FILE)

    return await handle.getFile()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      return null
    }

    throw error
  }
}

/** Many tools write files in place: a read in the middle can see half a file. */
const READ_ATTEMPTS = 4
const RETRY_DELAY = 120

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function readWorkspaceFile(
  root: FileSystemDirectoryHandle,
  fallbackTitle: string,
): Promise<DiskState> {
  let state: DiskState = { kind: 'missing' }

  for (let attempt = 1; attempt <= READ_ATTEMPTS; attempt += 1) {
    state = await readOnce(root, fallbackTitle)

    // A broken or missing file is worth a second look: it may be mid-write, or
    // being swapped in by another writer. Taking it as missing too soon would
    // start an empty board over a real one.
    if (state.kind === 'ok') return state

    await wait(RETRY_DELAY)
  }

  return state
}

async function readOnce(
  root: FileSystemDirectoryHandle,
  fallbackTitle: string,
): Promise<DiskState> {
  const file = await getWorkspaceFile(root)

  if (!file) {
    return { kind: 'missing' }
  }

  const text = await file.text()
  let board

  try {
    board = { workspace: parseWorkspace(text, fallbackTitle), stamps: readSyncStamps(text) }
  } catch (error) {
    if (error instanceof WorkspaceFormatError) {
      return { kind: 'invalid', text, error: error.message }
    }

    throw error
  }

  const copies: string[] = []

  for (const { name, text: copyText } of await readConflictCopies(root)) {
    try {
      board = mergeCopy(board, {
        workspace: parseWorkspace(copyText, fallbackTitle),
        stamps: readSyncStamps(copyText),
      })
      copies.push(name)
    } catch {
      // A copy that can't be read stays where it is, for the user to look at.
    }
  }

  return { kind: 'ok', text, ...board, copies }
}

/** Copies of `workspace.json` a sync tool left next to it, by name. */
async function conflictCopyNames(root: FileSystemDirectoryHandle): Promise<string[]> {
  let directory: FileSystemDirectoryHandle

  try {
    directory = await root.getDirectoryHandle(BRUTO_DIRECTORY)
  } catch {
    return []
  }

  const names: string[] = []

  for await (const [name, handle] of directory.entries()) {
    if (handle.kind === 'file' && isConflictCopyName(name)) names.push(name)
  }

  return names.sort()
}

async function readConflictCopies(root: FileSystemDirectoryHandle) {
  const names = await conflictCopyNames(root)

  if (names.length === 0) return []

  const directory = await root.getDirectoryHandle(BRUTO_DIRECTORY)
  const copies: { name: string; text: string }[] = []

  for (const name of names) {
    try {
      const file = await (await directory.getFileHandle(name)).getFile()

      copies.push({ name, text: await file.text() })
    } catch {
      // Gone already (another window archived it): nothing to merge.
    }
  }

  return copies
}

/**
 * Moves conflicted copies, once merged and saved, into `.bruto/backups`: they
 * stop showing up, and are still there if the merge got something wrong.
 */
export async function archiveConflictCopies(root: FileSystemDirectoryHandle, names: string[]) {
  if (names.length === 0) return

  const directory = await getBrutoDirectory(root)
  const backups = await directory.getDirectoryHandle(BACKUP_DIRECTORY, { create: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')

  for (const [index, name] of names.entries()) {
    try {
      const text = await (await (await directory.getFileHandle(name)).getFile()).text()

      await writeText(backups, `workspace-${stamp}-copy${index + 1}.json`, text)
      await directory.removeEntry(name)
    } catch {
      // Gone already, or still locked by the sync tool: it is tried again next time.
    }
  }
}

/** Cheap check used to notice changes made by other tools, and copies a sync tool left. */
export async function getWorkspaceFileStamp(root: FileSystemDirectoryHandle): Promise<string> {
  const file = await getWorkspaceFile(root)
  const copies = await conflictCopyNames(root)
  const stamp = file ? `${file.lastModified}:${file.size}` : 'missing'

  return copies.length > 0 ? `${stamp}|${copies.join('|')}` : stamp
}

async function writeText(directory: FileSystemDirectoryHandle, name: string, text: string) {
  const handle = await directory.getFileHandle(name, { create: true })

  // createWritable writes to a temporary file and swaps it in on close, so a
  // reader never sees a half-written workspace.
  const writable = await handle.createWritable()

  await writable.write(text)
  await writable.close()
}

export async function writeWorkspaceFile(root: FileSystemDirectoryHandle, text: string) {
  await writeText(await getBrutoDirectory(root), WORKSPACE_FILE, text)
}

/** The agents' audit log, next to the board: only ever added to (the MCP server writes it too). */
const LOG_FILE = 'log.jsonl'

export async function appendLogLines(root: FileSystemDirectoryHandle, lines: string) {
  const handle = await (await getBrutoDirectory(root)).getFileHandle(LOG_FILE, { create: true })
  const size = (await handle.getFile()).size
  const writable = await handle.createWritable({ keepExistingData: true })

  await writable.seek(size)
  await writable.write(lines)
  await writable.close()
}

/** Keeps a timestamped copy in `.bruto/backups`, pruning the oldest ones. */
export async function writeBackup(root: FileSystemDirectoryHandle, text: string) {
  const backups = await (
    await getBrutoDirectory(root)
  ).getDirectoryHandle(BACKUP_DIRECTORY, {
    create: true,
  })

  const existing = (await listBackupNames(backups)).sort()
  const latest = existing.at(-1)

  // Nothing worth keeping, or the same as the last copy: reopening or
  // switching projects must not push older, different copies out.
  if (!text.trim()) return
  if (latest && (await (await (await backups.getFileHandle(latest)).getFile()).text()) === text)
    return

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')

  await writeText(backups, `workspace-${stamp}.json`, text)

  const names = (await listBackupNames(backups)).sort()

  for (const name of names.slice(0, Math.max(0, names.length - BACKUPS_TO_KEEP))) {
    await backups.removeEntry(name)
  }
}

async function listBackupNames(directory: FileSystemDirectoryHandle): Promise<string[]> {
  const names: string[] = []

  for await (const [name, handle] of directory.entries()) {
    if (handle.kind === 'file' && name.endsWith('.json')) names.push(name)
  }

  return names
}

/** Newest backup that can still be read, used to recover from a broken file. */
export async function readLatestValidBackup(
  root: FileSystemDirectoryHandle,
  fallbackTitle: string,
): Promise<{ name: string; workspace: Workspace } | null> {
  let backups: FileSystemDirectoryHandle

  try {
    backups = await (
      await root.getDirectoryHandle(BRUTO_DIRECTORY)
    ).getDirectoryHandle(BACKUP_DIRECTORY)
  } catch {
    return null
  }

  const names = (await listBackupNames(backups)).sort().reverse()

  for (const name of names) {
    try {
      const text = await (await (await backups.getFileHandle(name)).getFile()).text()

      return { name, workspace: parseWorkspace(text, fallbackTitle) }
    } catch {
      // Try the next one.
    }
  }

  return null
}
