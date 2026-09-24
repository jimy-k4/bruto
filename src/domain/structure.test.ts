import { describe, expect, it } from 'vitest'
import type { Note } from '../types'
import { ancestry, buildStructure, findNode, keepNoted, normalizeLinkedPath } from './structure'

const note = (id: string, filePaths: string[]): Note => ({
  id,
  title: id,
  description: '',
  filePaths,
  webUrl: '',
  images: [],
  x: 0,
  y: 0,
  zIndex: 1,
  colorTheme: 'concrete',
  pattern: 'raw',
})

const FILES = [
  'README.md',
  'package.json',
  'src/App.tsx',
  'src/main.ts',
  'src/board/Board.tsx',
  'src/board/NoteCard.tsx',
  'src/board/geometry.ts',
]

describe('buildStructure', () => {
  it('counts files per folder and puts the biggest first', () => {
    const { root } = buildStructure('demo', FILES, [])

    expect(root.fileCount).toBe(7)
    expect(root.children.map((node) => [node.name, node.fileCount])).toEqual([
      ['src', 5],
      ['package.json', 1],
      ['README.md', 1],
    ])
    expect(findNode(root, 'src').children[0]).toMatchObject({ name: 'board', fileCount: 3 })
  })

  it('places a note on its file and on every folder around it', () => {
    const { root } = buildStructure('demo', FILES, [note('a', ['src/board/Board.tsx'])])

    expect(root.noteIds).toEqual(new Set(['a']))
    expect(findNode(root, 'src').noteIds).toEqual(new Set(['a']))
    expect(findNode(root, 'src/board/Board.tsx').noteIds).toEqual(new Set(['a']))
    expect(findNode(root, 'src/board/NoteCard.tsx').noteIds.size).toBe(0)
    expect(findNode(root, 'src/App.tsx').noteIds.size).toBe(0)
  })

  it('lets a note linked to a folder cover everything in it', () => {
    const { root } = buildStructure('demo', FILES, [note('a', ['src/board'])])

    expect(findNode(root, 'src/board/geometry.ts').noteIds).toEqual(new Set(['a']))
    expect(findNode(root, 'src/App.tsx').noteIds.size).toBe(0)
  })

  it('accepts paths written by hand on Windows or with ./', () => {
    const { root, broken } = buildStructure('demo', FILES, [
      note('a', ['src\\board\\Board.tsx']),
      note('b', ['./README.md']),
    ])

    expect(broken).toEqual([])
    expect(findNode(root, 'src/board/Board.tsx').noteIds).toEqual(new Set(['a']))
    expect(findNode(root, 'README.md').noteIds).toEqual(new Set(['b']))
  })

  it('reports links to files that no longer exist', () => {
    const { broken } = buildStructure('demo', FILES, [
      note('a', ['src/old.ts', 'src/App.tsx']),
      note('b', ['docs/gone']),
    ])

    expect(broken).toEqual([
      { noteId: 'a', path: 'src/old.ts', byAi: false },
      { noteId: 'b', path: 'docs/gone', byAi: false },
    ])
  })

  it('places the files the AI touched too, and tells whose a missing one was', () => {
    const { root, broken } = buildStructure('demo', FILES, [
      { ...note('a', ['README.md']), aiFilePaths: ['src/board/NoteCard.tsx', 'src/Deleted.ts'] },
    ])

    expect(findNode(root, 'README.md').noteIds).toEqual(new Set(['a']))
    expect(findNode(root, 'src/board/NoteCard.tsx').noteIds).toEqual(new Set(['a']))
    expect(broken).toEqual([{ noteId: 'a', path: 'src/Deleted.ts', byAi: true }])
  })
})

describe('navigation helpers', () => {
  const { root } = buildStructure('demo', FILES, [])

  it('falls back to the closest existing folder', () => {
    expect(findNode(root, 'src/board/Gone.tsx').path).toBe('src/board')
    expect(findNode(root, '').path).toBe('')
  })

  it('lists the folders from the root down', () => {
    expect(ancestry(root, 'src/board').map((node) => node.name)).toEqual(['demo', 'src', 'board'])
  })
})

describe('normalizeLinkedPath', () => {
  it('keeps only what notes point at, recounting files', () => {
    const { root } = buildStructure('demo', FILES, [note('a', ['src/board/Board.tsx'])])
    const noted = keepNoted(root)

    expect(noted.fileCount).toBe(1)
    expect(noted.children.map((node) => node.name)).toEqual(['src'])
    expect(findNode(noted, 'src').children.map((node) => node.name)).toEqual(['board'])
    expect(findNode(noted, 'src/board').children.map((node) => node.name)).toEqual(['Board.tsx'])
    // The full tree is left as it was.
    expect(root.fileCount).toBe(7)
  })

  it('cleans separators and leading or trailing slashes', () => {
    expect(normalizeLinkedPath(' .\\src\\app.ts ')).toBe('src/app.ts')
    expect(normalizeLinkedPath('/src/board/')).toBe('src/board')
  })
})
