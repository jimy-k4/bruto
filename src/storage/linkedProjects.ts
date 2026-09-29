import type { CrossLink, Workspace } from '../types'
import { serializeWorkspace } from '../domain/workspace'
import { ensureAccess, listRecentProjects, type RecentProject } from './recentProjects'
import { exclusive, readWorkspaceFile, writeWorkspaceFile } from './workspaceFile'

type ProjectRef = Pick<CrossLink, 'project' | 'projectId'>

/** The recent project a link points at: by its id, or else by its folder name. */
export async function findLinkedProject(
  link: ProjectRef,
  recents?: RecentProject[],
): Promise<RecentProject | null> {
  const list = recents ?? (await listRecentProjects())

  return (
    list.find((recent) => link.projectId && recent.id === link.projectId) ??
    list.find((recent) => recent.handle.name.toLowerCase() === link.project.toLowerCase()) ??
    null
  )
}

/** Whether the browser already lets Bruto into a folder, without asking. */
async function granted(handle: FileSystemDirectoryHandle, mode: 'read' | 'readwrite') {
  if (!handle.queryPermission) return true

  try {
    return (await handle.queryPermission({ mode })) === 'granted'
  } catch {
    return false
  }
}

/**
 * Another project's board, read from disk. It only asks for access when `ask`
 * is set, which needs a click: reading it in the background never shows a prompt.
 */
export async function readOtherWorkspace(
  project: RecentProject,
  ask: boolean,
): Promise<Workspace | null> {
  const allowed = ask
    ? await ensureAccess(project.handle, 'read')
    : await granted(project.handle, 'read')

  if (!allowed) return null

  try {
    const state = await exclusive(project.handle, () =>
      readWorkspaceFile(project.handle, project.name),
    )

    return state.kind === 'ok' ? state.workspace : null
  } catch {
    return null
  }
}

/**
 * Changes another project's board on disk: read, change, write in one go.
 * Without `ask` it only writes where access is already granted. Returns
 * whether it was written.
 */
export async function updateOtherWorkspace(
  project: RecentProject,
  change: (workspace: Workspace) => Workspace,
  ask: boolean,
): Promise<boolean> {
  const allowed = ask
    ? await ensureAccess(project.handle, 'readwrite')
    : await granted(project.handle, 'readwrite')

  if (!allowed) return false

  try {
    // Read, change and write as one step: nothing else touches the file in between.
    return await exclusive(project.handle, async () => {
      const state = await readWorkspaceFile(project.handle, project.name)

      if (state.kind !== 'ok') return false

      const next = change(state.workspace)

      if (next !== state.workspace)
        await writeWorkspaceFile(project.handle, serializeWorkspace(next))

      return true
    })
  } catch {
    return false
  }
}
