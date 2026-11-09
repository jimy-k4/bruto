import { describe, expect, it } from 'vitest'
import type { Note, Workspace } from '../types'
import { normalizeGhostZones, zonesFrom } from './ghosts'
import { mergeWorkspaces, type MergeConflict } from './merge'
import { createEmptyWorkspace, duplicateNotes, parseWorkspace, resizeNote } from './workspace'

const note = (id: string, patch: Partial<Note> = {}): Note => ({
  id,
  title: id.toUpperCase(),
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

const workspaceWith = (notes: Note[]): Workspace => ({ ...createEmptyWorkspace('TEST'), notes })

const widthRead = (width: unknown) =>
  parseWorkspace(JSON.stringify(workspaceWith([note('a', { width } as Partial<Note>)]))).notes[0]
    .width

describe('a note’s width', () => {
  it('is left out when the note has none', () => {
    expect(parseWorkspace(JSON.stringify(workspaceWith([note('a')]))).notes[0]).not.toHaveProperty(
      'width',
    )
  })

  it('comes from the file within the limits, or not at all', () => {
    expect(widthRead(220)).toBe(220)
    expect(widthRead(20)).toBe(180)
    expect(widthRead(9000)).toBe(480)
    expect(widthRead('220')).toBeUndefined()
    expect(widthRead(null)).toBeUndefined()
  })

  it('stays within the limits when dragged, in whole pixels', () => {
    const resized = (width: number) =>
      resizeNote(workspaceWith([note('a')]), 'a', width).notes[0].width

    expect(resized(233.6)).toBe(234)
    expect(resized(10)).toBe(180)
    expect(resized(900)).toBe(480)
  })

  it('goes with a copy of the note', () => {
    const { workspace, ids } = duplicateNotes(workspaceWith([note('a', { width: 220 })]), ['a'], '')

    expect(workspace.notes.find((item) => item.id === ids[0])?.width).toBe(220)
  })

  it('merges quietly, like a note’s place on the board', () => {
    const conflicts: MergeConflict[] = []
    const merged = mergeWorkspaces(
      workspaceWith([note('a', { width: 200 })]),
      workspaceWith([note('a', { width: 220 })]),
      workspaceWith([note('a', { width: 240 })]),
      conflicts,
    )

    expect(merged.notes[0].width).toBe(220)
    expect(conflicts).toEqual([])
  })

  it('reaches the ghost of the note on a linked board, and survives the file', () => {
    const origin = workspaceWith([
      note('a', {
        width: 220,
        crossLinks: [{ kind: 'blocks', project: 'here', noteId: 'b' }],
      }),
    ])
    const zones = zonesFrom({ project: 'there', workspace: origin }, { project: 'here' }, 'now')

    expect(zones[0].notes[0].width).toBe(220)
    expect(normalizeGhostZones(JSON.parse(JSON.stringify(zones)))?.[0].notes[0].width).toBe(220)
  })
})
