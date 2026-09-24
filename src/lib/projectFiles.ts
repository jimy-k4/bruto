import type { FileTreeNode } from '../types'

export const IGNORED_DIRECTORY_NAMES = new Set([
  '.bruto',
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
])

export async function readDirectoryChildren(
  directoryHandle: FileSystemDirectoryHandle,
  currentPath = '',
): Promise<FileTreeNode[]> {
  const children: FileTreeNode[] = []

  for await (const [name, handle] of directoryHandle.entries()) {
    if (handle.kind === 'directory' && IGNORED_DIRECTORY_NAMES.has(name)) {
      continue
    }

    const path = currentPath ? `${currentPath}/${name}` : name

    children.push({
      name,
      path,
      kind: handle.kind === 'directory' ? 'directory' : 'file',
      handle,
      loaded: handle.kind === 'file' ? true : false,
    })
  }

  return sortFileTreeNodes(children)
}

export function sortFileTreeNodes(nodes: FileTreeNode[]) {
  return [...nodes].sort((first, second) => {
    if (first.kind !== second.kind) {
      return first.kind === 'directory' ? -1 : 1
    }

    return first.name.localeCompare(second.name, undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  })
}

export function updateDirectoryTreeNode(
  node: FileTreeNode,
  targetPath: string,
  children: FileTreeNode[],
): FileTreeNode {
  if (node.path === targetPath) {
    return {
      ...node,
      children,
      loaded: true,
    }
  }

  if (node.kind !== 'directory' || !node.children) {
    return node
  }

  return {
    ...node,
    children: node.children.map((child) =>
      child.kind === 'directory' ? updateDirectoryTreeNode(child, targetPath, children) : child,
    ),
  }
}

export async function searchDirectoryRecursively(
  directoryHandle: FileSystemDirectoryHandle,
  currentPath: string,
  query: string,
): Promise<FileTreeNode[]> {
  const results: FileTreeNode[] = []

  for await (const [name, handle] of directoryHandle.entries()) {
    if (handle.kind === 'directory' && IGNORED_DIRECTORY_NAMES.has(name)) {
      continue
    }

    const path = currentPath ? `${currentPath}/${name}` : name

    const matches = `${name} ${path}`.toLowerCase().includes(query)

    if (handle.kind === 'file') {
      if (matches) {
        results.push({
          name,
          path,
          kind: 'file',
          handle,
          loaded: true,
        })
      }

      continue
    }

    const nestedResults = await searchDirectoryRecursively(
      handle as FileSystemDirectoryHandle,
      path,
      query,
    )

    if (matches || nestedResults.length > 0) {
      results.push({
        name,
        path,
        kind: 'directory',
        handle,
        children: nestedResults,
        loaded: true,
      })
    }
  }

  return sortFileTreeNodes(results)
}

export async function findRelativeFilePath(
  rootDirectory: FileSystemDirectoryHandle,
  targetFile: FileSystemFileHandle,
  currentPath = '',
): Promise<string | null> {
  for await (const [name, handle] of rootDirectory.entries()) {
    if (name === '.bruto' && currentPath === '') {
      continue
    }

    if (handle.kind === 'file') {
      if (await handle.isSameEntry(targetFile)) {
        return currentPath ? `${currentPath}/${name}` : name
      }
    }

    if (handle.kind === 'directory') {
      const directoryHandle = handle as FileSystemDirectoryHandle

      const nestedPath = currentPath ? `${currentPath}/${name}` : name

      const result = await findRelativeFilePath(directoryHandle, targetFile, nestedPath)

      if (result) {
        return result
      }
    }
  }

  return null
}

export async function getFileHandleFromPath(
  rootDirectory: FileSystemDirectoryHandle,
  filePath: string,
  emptyPathMessage: string,
): Promise<FileSystemFileHandle> {
  const pathParts = filePath.split('/').filter(Boolean)

  if (pathParts.length === 0) {
    throw new Error(emptyPathMessage)
  }

  let currentDirectory = rootDirectory

  for (let index = 0; index < pathParts.length - 1; index += 1) {
    currentDirectory = await currentDirectory.getDirectoryHandle(pathParts[index])
  }

  return currentDirectory.getFileHandle(pathParts[pathParts.length - 1])
}
