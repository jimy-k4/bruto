import { describe, expect, it } from 'vitest'
import type { Note, Workspace } from '../types'
import { mergeWorkspaces } from './merge'
import { createEmptyWorkspace } from './workspace'

const note = (id: string, patch: Partial<Note> = {}): Note => ({
  id,
  title: id,
  description: '',
  filePaths: [],
  webUrl: '',
  images: [],
  x: 0,
  y: 0,
  zIndex: 1,
  colorTheme: 'concrete',
  pattern: 'raw',
  ...patch,
})

const ws = (notes: Note[], extra: Partial<Workspace> = {}): Workspace => ({
  ...createEmptyWorkspace('T'),
  notes,
  ...extra,
})

describe('mergeWorkspaces', () => {
  it('keeps both sides when they touched different notes', () => {
    const base = ws([note('a'), note('b')])
    const local = ws([note('a', { x: 50 }), note('b')])
    const remote = ws([note('a'), note('b', { status: 'review', aiResponse: 'done' })])

    const merged = mergeWorkspaces(base, local, remote)

    expect(merged.notes).toEqual([
      note('a', { x: 50 }),
      note('b', { status: 'review', aiResponse: 'done' }),
    ])
  })

  it('merges different fields of the same note', () => {
    const base = ws([note('a', { status: 'todo' })])
    const local = ws([note('a', { status: 'todo', description: 'typed by the user' })])
    const remote = ws([note('a', { status: 'review', aiResponse: 'fixed' })])

    expect(mergeWorkspaces(base, local, remote).notes[0]).toEqual(
      note('a', { status: 'review', description: 'typed by the user', aiResponse: 'fixed' }),
    )
  })

  it('prefers the local value when both changed the same field', () => {
    const base = ws([note('a', { title: 'old' })])
    const local = ws([note('a', { title: 'mine' })])
    const remote = ws([note('a', { title: 'theirs' })])

    expect(mergeWorkspaces(base, local, remote).notes[0].title).toBe('mine')
  })

  it('adds notes created on either side', () => {
    const base = ws([note('a')])
    const local = ws([note('a'), note('mine')])
    const remote = ws([note('a'), note('theirs')])

    expect(mergeWorkspaces(base, local, remote).notes.map((item) => item.id)).toEqual([
      'a',
      'mine',
      'theirs',
    ])
  })

  it('deletes notes removed on one side and untouched on the other', () => {
    const base = ws([note('a'), note('b')])
    const local = ws([note('a')])
    const remote = ws([note('a'), note('b')])

    expect(mergeWorkspaces(base, local, remote).notes.map((item) => item.id)).toEqual(['a'])
  })

  it('keeps a note deleted on one side but edited on the other', () => {
    const base = ws([note('a'), note('b')])
    const local = ws([note('a')])
    const remote = ws([note('a'), note('b', { aiResponse: 'worked on it' })])

    expect(mergeWorkspaces(base, local, remote).notes.map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('merges connections and drops the ones left without notes', () => {
    const base = ws([note('a'), note('b'), note('c')])
    const local = ws([note('a'), note('b')], { connections: [{ id: '1', from: 'a', to: 'b' }] })
    const remote = ws([note('a'), note('b'), note('c')], {
      connections: [
        { id: '2', from: 'b', to: 'a' },
        { id: '3', from: 'a', to: 'c' },
      ],
    })

    expect(mergeWorkspaces(base, local, remote).connections.map((item) => item.id)).toEqual([
      '1',
      '2',
    ])
  })

  it('merges workspace fields and status styles', () => {
    const base = ws([], { title: 'T', statusStyles: { done: { color: 'moss' } } })
    const local = ws([], { title: 'Mine', statusStyles: { done: { color: 'moss' } } })
    const remote = ws([], {
      title: 'T',
      aiContext: 'from disk',
      statusStyles: { done: { color: 'moss' }, todo: { pattern: 'grid' } },
    })

    expect(mergeWorkspaces(base, local, remote)).toMatchObject({
      title: 'Mine',
      aiContext: 'from disk',
      statusStyles: { done: { color: 'moss' }, todo: { pattern: 'grid' } },
    })
  })

  it('returns the remote version when nothing changed locally', () => {
    const base = ws([note('a')])
    const remote = ws([note('a', { title: 'new' }), note('b')])

    expect(mergeWorkspaces(base, base, remote)).toEqual(remote)
  })
})
