import type { Workspace } from '../types'
import { WorkspaceFormatError, parseWorkspace } from '../domain/workspace'

export const BRUTO_DIRECTORY = '.bruto'
const WORKSPACE_FILE = 'workspace.json'
const BACKUP_DIRECTORY = 'backups'
const BACKUPS_TO_KEEP = 10

/** What is on disk right now. */
export type DiskState =
  | { kind: 'missing' }
  | { kind: 'invalid'; text: string; error: string }
  | { kind: 'ok'; text: string; workspace: Workspace }

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

    // Only a broken file is worth a second look: it may be mid-write.
    if (state.kind !== 'invalid') return state

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

  try {
    return { kind: 'ok', text, workspace: parseWorkspace(text, fallbackTitle) }
  } catch (error) {
    if (error instanceof WorkspaceFormatError) {
      return { kind: 'invalid', text, error: error.message }
    }

    throw error
  }
}

/** Cheap check used to notice changes made by other tools. */
export async function getWorkspaceFileStamp(root: FileSystemDirectoryHandle): Promise<string> {
  const file = await getWorkspaceFile(root)

  return file ? `${file.lastModified}:${file.size}` : 'missing'
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
