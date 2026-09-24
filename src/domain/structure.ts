import type { Note } from '../types'

/** A folder or file of the project, with the notes that point at it or inside it. */
export interface StructureNode {
  name: string
  /** Relative to the project root; `''` for the root itself. */
  path: string
  kind: 'file' | 'directory'
  /** Files inside (1 for a file). */
  fileCount: number
  /** Ids of the notes linked to this node, to something inside it, or to a folder around it. */
  noteIds: Set<string>
  children: StructureNode[]
}

export interface BrokenLink {
  noteId: string
  path: string
}

export interface ProjectStructure {
  root: StructureNode
  /** Linked paths that match no file or folder of the project. */
  broken: BrokenLink[]
}

/**
 * Linked paths as the index writes them: forward slashes, no leading `./` or
 * `/`. People and AIs on Windows often write `src\app.ts`.
 */
export const normalizeLinkedPath = (path: string) =>
  path
    .trim()
    .replace(/\\/g, '/')
    .replace(/^(\.\/|\/)+/, '')
    .replace(/\/+$/, '')

const directory = (name: string, path: string): StructureNode => ({
  name,
  path,
  kind: 'directory',
  fileCount: 0,
  noteIds: new Set(),
  children: [],
})

const byWeightThenName = (a: StructureNode, b: StructureNode) =>
  b.fileCount - a.fileCount ||
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })

function markAll(node: StructureNode, noteId: string) {
  node.noteIds.add(noteId)
  node.children.forEach((child) => markAll(child, noteId))
}

/** Builds the project tree from indexed file paths and places every note on it. */
export function buildStructure(
  rootName: string,
  filePaths: string[],
  notes: Note[],
): ProjectStructure {
  const root = directory(rootName, '')
  const nodes = new Map<string, StructureNode>([['', root]])

  for (const filePath of filePaths) {
    const parts = filePath.split('/')
    let parent = root

    parent.fileCount++

    parts.forEach((name, index) => {
      const path = parts.slice(0, index + 1).join('/')
      const isFile = index === parts.length - 1
      let node = nodes.get(path)

      if (!node) {
        node = isFile
          ? { name, path, kind: 'file', fileCount: 1, noteIds: new Set(), children: [] }
          : directory(name, path)
        nodes.set(path, node)
        parent.children.push(node)
      }

      if (!isFile) node.fileCount++
      parent = node
    })
  }

  const sortTree = (node: StructureNode) => {
    node.children.sort(byWeightThenName).forEach(sortTree)
  }

  sortTree(root)

  const broken: BrokenLink[] = []

  for (const note of notes) {
    for (const linked of note.filePaths) {
      const path = normalizeLinkedPath(linked)
      const target = path ? nodes.get(path) : undefined

      if (!target) {
        if (path) broken.push({ noteId: note.id, path: linked })
        continue
      }

      // Every folder on the way contains the linked file or folder.
      const parts = path.split('/')

      for (let index = 0; index < parts.length; index++) {
        nodes.get(parts.slice(0, index).join('/'))!.noteIds.add(note.id)
      }

      // A linked folder covers everything in it.
      markAll(target, note.id)
    }
  }

  return { root, broken }
}

/** The node at `path`, or the closest folder that still exists above it. */
export function findNode(root: StructureNode, path: string): StructureNode {
  let node = root

  for (const name of path ? path.split('/') : []) {
    const child = node.children.find((item) => item.name === name)

    if (!child) break

    node = child
  }

  return node
}

/** The folders from the root down to `node`, both included. */
export function ancestry(root: StructureNode, path: string): StructureNode[] {
  const chain = [root]
  let node = root

  for (const name of path ? path.split('/') : []) {
    const child = node.children.find((item) => item.name === name)

    if (!child) break

    chain.push(child)
    node = child
  }

  return chain
}
