import { createContext, useContext } from 'react'

/** Folder of the open project, for components that read its files. */
export const ProjectRootContext = createContext<FileSystemDirectoryHandle | null>(null)

export function useProjectRoot(): FileSystemDirectoryHandle {
  const root = useContext(ProjectRootContext)

  if (!root) {
    throw new Error('useProjectRoot must be used inside an open project')
  }

  return root
}
