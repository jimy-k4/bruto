import type { Workspace } from '../types'
import { createEmptyWorkspace, serializeWorkspace } from '../domain/workspace'
import {
  getWorkspaceFileStamp,
  readLatestValidBackup,
  readWorkspaceFile,
  writeBackup,
  writeWorkspaceFile,
} from '../storage/workspaceFile'
import type { WorkspaceIO } from './workspaceSync'

export type LoadResult =
  | { kind: 'ready'; workspace: Workspace; diskText: string }
  | {
      kind: 'invalid'
      error: string
      backup: { name: string; workspace: Workspace } | null
    }

export const projectTitle = (handle: FileSystemDirectoryHandle) => handle.name.toUpperCase()

export function createWorkspaceIO(handle: FileSystemDirectoryHandle): WorkspaceIO {
  const title = projectTitle(handle)

  return {
    read: () => readWorkspaceFile(handle, title),
    write: (text) => writeWorkspaceFile(handle, text),
    stamp: () => getWorkspaceFileStamp(handle),
  }
}

/**
 * Reads the project's workspace, creating it on first use. A file that can't
 * be read is reported, never replaced: the user decides what to do.
 */
export async function loadWorkspace(handle: FileSystemDirectoryHandle): Promise<LoadResult> {
  const title = projectTitle(handle)
  const disk = await readWorkspaceFile(handle, title)

  if (disk.kind === 'invalid') {
    return {
      kind: 'invalid',
      error: disk.error,
      backup: await readLatestValidBackup(handle, title),
    }
  }

  if (disk.kind === 'missing') {
    const workspace = createEmptyWorkspace(title)
    const text = serializeWorkspace(workspace)

    await writeWorkspaceFile(handle, text)

    return { kind: 'ready', workspace, diskText: text }
  }

  // One backup per opening: a safety net if a session goes wrong.
  await writeBackup(handle, disk.text).catch(() => undefined)

  const text = serializeWorkspace(disk.workspace)

  // Normalised or migrated on load: write it back so every tool sees the same file.
  if (text !== disk.text) {
    await writeWorkspaceFile(handle, text)
  }

  return { kind: 'ready', workspace: disk.workspace, diskText: text }
}

export async function restoreWorkspace(handle: FileSystemDirectoryHandle, workspace: Workspace) {
  const current = await readWorkspaceFile(handle, projectTitle(handle))

  // Keep the broken file too, in case something in it matters.
  if (current.kind !== 'missing') {
    await writeBackup(handle, current.text).catch(() => undefined)
  }

  await writeWorkspaceFile(handle, serializeWorkspace(workspace))
}
