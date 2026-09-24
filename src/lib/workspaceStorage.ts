import type { Workspace } from '../types'

export async function saveWorkspace(
  directoryHandle: FileSystemDirectoryHandle,
  data: Workspace,
) {
  const brutoDirectory =
    await directoryHandle.getDirectoryHandle(
      '.bruto',
      {
        create: true,
      },
    )

  const workspaceFile =
    await brutoDirectory.getFileHandle(
      'workspace.json',
      {
        create: true,
      },
    )

  const writable =
    await workspaceFile.createWritable()

  await writable.write(
    JSON.stringify(
      data,
      null,
      2,
    ),
  )

  await writable.close()
}
