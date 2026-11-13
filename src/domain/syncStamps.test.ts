import { describe, expect, it } from 'vitest'
import type { Note, Workspace } from '../types'
import {
  type StampedBoard,
  emptyStamps,
  isConflictCopyName,
  mergeCopy,
  readSyncStamps,
} from './syncStamps'
import { createEmptyWorkspace, parseWorkspace, serializeStamped } from './workspace'

const note = (id: string, patch: Partial<Note> = {}): Note => ({
  id,
  title: id,
  description: '',
  filePaths: [],
  webUrls: [],
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

const at = (minute: number) => new Date(Date.UTC(2026, 10, 13, 10, minute))

/** A board saved from `previous` at a given minute, as written to disk and read back. */
function save(next: Workspace, previous: StampedBoard | null, minute: number): StampedBoard {
  const text = serializeStamped(next, previous, at(minute))

  return { workspace: parseWorkspace(text), stamps: readSyncStamps(text) }
}

describe('stampChanges', () => {
  it('stamps new and changed items, keeps the stamp of the rest and records deletions', () => {
    const first = save(ws([note('a'), note('b')]), null, 0)
    const second = save(ws([note('a', { title: 'A!' }), note('c')]), first, 5)

    expect(second.stamps.changed['note:a']).toBe(at(5).toISOString())
    expect(second.stamps.changed['note:c']).toBe(at(5).toISOString())
    expect(second.stamps.deleted['note:b']).toBe(at(5).toISOString())

    const third = save(second.workspace, second, 9)

    expect(third.stamps).toEqual(second.stamps)
  })

  it('writes nothing extra for a board nobody changed', () => {
    const board = ws([note('a')])

    expect(serializeStamped(board, { workspace: board, stamps: emptyStamps() })).not.toContain(
      '"sync"',
    )
  })

  it('keeps the stamps through a round trip, without the app ever seeing them', () => {
    const saved = save(ws([note('a')]), null, 0)

    expect('sync' in saved.workspace).toBe(false)
    expect(saved.stamps.changed['note:a']).toBeDefined()
  })
})

describe('mergeCopy', () => {
  // Both computers start from the same board, then change it before syncing.
  const start = save(ws([note('a'), note('b'), note('c')], { aiContext: 'old' }), null, 0)

  it('keeps notes added on either computer', () => {
    const pc = save(ws([...start.workspace.notes, note('pc')]), start, 5)
    const laptop = save(ws([...start.workspace.notes, note('laptop')]), start, 6)

    const merged = mergeCopy(pc, laptop)

    expect(merged.workspace.notes.map((n) => n.id)).toEqual(['a', 'b', 'c', 'pc', 'laptop'])
    expect(
      mergeCopy(laptop, pc)
        .workspace.notes.map((n) => n.id)
        .sort(),
    ).toEqual(['a', 'b', 'c', 'laptop', 'pc'].sort())
  })

  it('takes the latest change of a note edited on both, and either change of different notes', () => {
    const pc = save(
      ws([note('a', { title: 'PC' }), note('b', { status: 'done' }), note('c')]),
      start,
      5,
    )
    const laptop = save(ws([note('a', { title: 'LAPTOP' }), note('b'), note('c')]), start, 8)

    const merged = mergeCopy(pc, laptop).workspace

    expect(merged.notes.find((n) => n.id === 'a')?.title).toBe('LAPTOP')
    expect(merged.notes.find((n) => n.id === 'b')?.status).toBe('done')
  })

  it('drops a note deleted on one computer, unless the other changed it later', () => {
    const pc = save(ws([note('a'), note('c', { title: 'kept' })]), start, 5)
    const laptop = save(ws([note('a'), note('b'), note('c')]), start, 6)

    expect(mergeCopy(pc, laptop).workspace.notes.map((n) => n.id)).toEqual(['a', 'c'])

    const edited = save(ws([note('a'), note('b', { title: 'edited' }), note('c')]), start, 9)

    expect(mergeCopy(pc, edited).workspace.notes.map((n) => n.id)).toEqual(['a', 'c', 'b'])
  })

  it('drops arrows whose notes are gone and merges board fields by their latest change', () => {
    const withArrow = save(
      ws(start.workspace.notes, { connections: [{ id: 'x', from: 'a', to: 'b' }] }),
      start,
      2,
    )
    const pc = save(ws([note('a'), note('c')], { aiContext: 'pc' }), start, 5)
    const merged = mergeCopy(pc, withArrow).workspace

    expect(merged.connections).toEqual([])
    expect(merged.aiContext).toBe('pc')
  })

  it('gives the same board whichever side is the copy', () => {
    const pc = save(ws([note('a', { title: 'PC' }), note('pc')]), start, 5)
    const laptop = save(ws([note('a'), note('b', { title: 'L' }), note('laptop')]), start, 7)

    const ids = (board: StampedBoard) =>
      board.workspace.notes.map((n) => `${n.id}:${n.title}`).sort()

    expect(ids(mergeCopy(pc, laptop))).toEqual(ids(mergeCopy(laptop, pc)))
  })
})

describe('isConflictCopyName', () => {
  it.each([
    'workspace.sync-conflict-20261113-101010-ABCDEFG.json',
    "workspace (Juan's conflicted copy 2026-11-13).json",
    'workspace (conflicted copy 2026-11-13 101010).json',
    'workspace (1).json',
    'workspace 2.json',
    'workspace-DESKTOP-PC.json',
  ])('recognises %s', (name) => expect(isConflictCopyName(name)).toBe(true))

  it.each([
    'workspace.json',
    'workspace.backup-20260923.json',
    'workspace.json.1234.tmp',
    'log.jsonl',
    'log.sync-conflict-20261113-101010-ABCDEFG.jsonl',
  ])('ignores %s', (name) => expect(isConflictCopyName(name)).toBe(false))
})
