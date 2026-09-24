import type { FileTreeNode } from '../types'
import { BRUTO_DIRECTORY, getBrutoDirectory } from './workspaceFile'

/** Folders that are generated, huge or private: never listed or searched. */
export const IGNORED_DIRECTORIES = new Set([
  BRUTO_DIRECTORY,
  '.git',
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.vercel',
  '.turbo',
  '.cache',
  '.parcel-cache',
  '.venv',
  'venv',
  '__pycache__',
  'target',
  // .NET build output and Visual Studio state.
  'bin',
  'obj',
  '.vs',
])

/** Safety net for enormous folders: the index stops growing past this. */
export const MAX_INDEXED_FILES = 25_000

const byKindThenName = (a: FileTreeNode, b: FileTreeNode) =>
  a.kind !== b.kind
    ? a.kind === 'directory'
      ? -1
      : 1
    : a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })

const joinPath = (parent: string, name: string) => (parent ? `${parent}/${name}` : name)

export async function readDirectoryChildren(
  directory: FileSystemDirectoryHandle,
  path = '',
): Promise<FileTreeNode[]> {
  const children: FileTreeNode[] = []

  for await (const [name, handle] of directory.entries()) {
    if (handle.kind === 'directory' && IGNORED_DIRECTORIES.has(name)) continue

    children.push({
      name,
      path: joinPath(path, name),
      kind: handle.kind,
      handle,
      loaded: handle.kind === 'file',
    })
  }

  return children.sort(byKindThenName)
}

export function replaceTreeChildren(
  node: FileTreeNode,
  path: string,
  children: FileTreeNode[],
): FileTreeNode {
  if (node.path === path) {
    return { ...node, children, loaded: true }
  }

  if (node.kind !== 'directory' || !node.children || !path.startsWith(node.path)) {
    return node
  }

  return {
    ...node,
    children: node.children.map((child) => replaceTreeChildren(child, path, children)),
  }
}

export interface IndexedFile {
  path: string
  handle: FileSystemFileHandle
}

/** Lists every file of the project once, so searching is instant afterwards. */
export async function indexProjectFiles(root: FileSystemDirectoryHandle): Promise<IndexedFile[]> {
  const files: IndexedFile[] = []
  const pending: [FileSystemDirectoryHandle, string][] = [[root, '']]

  while (pending.length > 0 && files.length < MAX_INDEXED_FILES) {
    const [directory, path] = pending.shift()!

    for await (const [name, handle] of directory.entries()) {
      if (handle.kind === 'file') {
        files.push({ path: joinPath(path, name), handle })
      } else if (!IGNORED_DIRECTORIES.has(name)) {
        pending.push([handle, joinPath(path, name)])
      }
    }
  }

  return files.sort((a, b) => a.path.localeCompare(b.path))
}

/** Builds a tree containing only the files whose path matches `query`. */
export function buildSearchTree(
  root: FileSystemDirectoryHandle,
  rootName: string,
  files: IndexedFile[],
  query: string,
): FileTreeNode {
  const tree: FileTreeNode = {
    name: rootName,
    path: '',
    kind: 'directory',
    handle: root,
    children: [],
    loaded: true,
  }

  const needle = query.trim().toLowerCase()

  for (const file of files) {
    if (!file.path.toLowerCase().includes(needle)) continue

    const parts = file.path.split('/')
    let parent = tree

    parts.slice(0, -1).forEach((part, index) => {
      const path = parts.slice(0, index + 1).join('/')
      let directory = parent.children!.find((child) => child.path === path)

      if (!directory) {
        directory = {
          name: part,
          path,
          kind: 'directory',
          handle: root,
          children: [],
          loaded: true,
        }
        parent.children!.push(directory)
      }

      parent = directory
    })

    parent.children!.push({
      name: parts.at(-1)!,
      path: file.path,
      kind: 'file',
      handle: file.handle,
      loaded: true,
    })
  }

  const sortTree = (node: FileTreeNode) => {
    node.children?.sort(byKindThenName).forEach(sortTree)
  }

  sortTree(tree)

  return tree
}

/** Path of a picked file relative to the project, or null if it is outside it. */
export async function getRelativePath(
  root: FileSystemDirectoryHandle,
  handle: FileSystemHandle,
): Promise<string | null> {
  const parts = await root.resolve(handle)

  return parts && parts.length > 0 ? parts.join('/') : null
}

export async function getFileHandle(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<FileSystemFileHandle> {
  const parts = path.split('/').filter(Boolean)
  const fileName = parts.pop()

  if (!fileName) {
    throw new Error(`Empty file path: "${path}"`)
  }

  let directory = root

  for (const part of parts) {
    directory = await directory.getDirectoryHandle(part)
  }

  return directory.getFileHandle(fileName)
}

export async function getFileInfo(root: FileSystemDirectoryHandle, path: string) {
  const file = await (await getFileHandle(root, path)).getFile()

  return {
    name: file.name,
    path,
    size: file.size,
    lastModified: file.lastModified,
    type: file.type || 'application/octet-stream',
  }
}

const TEXT_EXTENSIONS =
  /\.(ts|tsx|js|jsx|mjs|cjs|json|md|mdx|txt|css|scss|html|yml|yaml|toml|sql|sh|ps1|py|rs|go|java|kt|swift|c|h|cpp|cs|php|rb|env|gitignore|xml|svg|csv|log)$/i

/**
 * Opens a project file in a new browser tab. Source code is served as plain
 * text so the browser shows it instead of downloading it.
 */
export async function openProjectFile(root: FileSystemDirectoryHandle, path: string) {
  const file = await (await getFileHandle(root, path)).getFile()
  const blob = TEXT_EXTENSIONS.test(file.name)
    ? new Blob([await file.text()], { type: 'text/plain;charset=utf-8' })
    : file

  const url = URL.createObjectURL(blob)
  const opened = window.open(url, '_blank')

  // Give the new tab time to load before releasing the file.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)

  if (!opened) {
    throw new Error('popup-blocked')
  }
}

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

export const isImageFile = (file: Blob) => file.type in IMAGE_EXTENSIONS

/** Stores an image inside `.bruto/images` and returns its project-relative path. */
export async function saveNoteImage(
  root: FileSystemDirectoryHandle,
  noteId: string,
  image: Blob,
): Promise<string> {
  const directory = await (
    await getBrutoDirectory(root)
  ).getDirectoryHandle('images', {
    create: true,
  })

  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
  const random = Math.random().toString(36).slice(2, 6)
  const name = `${noteId.slice(0, 6)}-${stamp}-${random}.${IMAGE_EXTENSIONS[image.type] ?? 'png'}`
  const writable = await (await directory.getFileHandle(name, { create: true })).createWritable()

  await writable.write(image)
  await writable.close()

  return `${BRUTO_DIRECTORY}/images/${name}`
}

/** Code files larger than this are skipped when reading sources: generated or minified. */
const MAX_SOURCE_BYTES = 512 * 1024
/** Safety net for huge projects: at most this many files are read for one lens. */
const MAX_SOURCE_FILES = 4000

export interface SourceFile {
  path: string
  text: string
}

/** Reads the text of the indexed files `wanted` accepts, skipping huge ones. */
export async function readSources(
  files: IndexedFile[],
  wanted: (path: string) => boolean,
): Promise<SourceFile[]> {
  const sources: SourceFile[] = []

  for (const file of files) {
    if (sources.length >= MAX_SOURCE_FILES) break
    if (!wanted(file.path)) continue

    try {
      const blob = await file.handle.getFile()

      if (blob.size <= MAX_SOURCE_BYTES) sources.push({ path: file.path, text: await blob.text() })
    } catch {
      // Deleted or locked since indexing: leave it out.
    }
  }

  return sources
}
