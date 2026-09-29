import { describe, expect, it } from 'vitest'
import type { CrossLink, Note, Workspace } from '../types'
import {
  addCrossLink,
  blockState,
  linkKey,
  normalizeCrossLinks,
  removeCrossLink,
  type LinkedNoteInfo,
} from './crossLinks'
import { duplicateNotes, normalizeWorkspace } from './workspace'

const link = (extra: Partial<CrossLink> = {}): CrossLink => ({
  kind: 'blocks',
  project: 'cms',
  noteId: 'n1',
  ...extra,
})

const workspace = (notes: Partial<Note>[]): Workspace =>
  normalizeWorkspace({ notes: notes.map((note, index) => ({ id: `a${index}`, ...note })) })

describe('normalizeCrossLinks', () => {
  it('keeps valid links, one per target, and drops the rest', () => {
    expect(
      normalizeCrossLinks([
        link({ projectId: 'p1', title: 'Login', status: 'todo' }),
        link({ kind: 'related' }),
        { kind: 'blocks', project: 'CMS', noteId: 'n1' },
        { kind: 'owns', project: 'cms', noteId: 'n2' },
        { kind: 'blocks', project: '', noteId: 'n3' },
        { kind: 'blocked-by', project: 'db', noteId: 'n4', status: 'whatever', projectId: 3 },
        'nonsense',
      ]),
    ).toEqual([
      link({ projectId: 'p1', title: 'Login', status: 'todo' }),
      { kind: 'blocked-by', project: 'db', noteId: 'n4' },
    ])
    expect(normalizeCrossLinks(undefined)).toEqual([])
  })

  it('is part of reading a workspace, and an empty list leaves no field', () => {
    const [linked, plain] = workspace([{ crossLinks: [link()] }, { crossLinks: [] }]).notes

    expect(linked.crossLinks).toEqual([link()])
    expect('crossLinks' in plain).toBe(false)
  })
})

describe('adding and removing links', () => {
  it('replaces a link to the same note and removes the field with the last link', () => {
    let current = workspace([{}])

    current = addCrossLink(current, 'a0', link())
    current = addCrossLink(current, 'a0', link({ kind: 'related', project: 'CMS' }))
    current = addCrossLink(current, 'a0', link({ noteId: 'n2' }))

    expect(current.notes[0].crossLinks).toEqual([
      link({ kind: 'related', project: 'CMS' }),
      link({ noteId: 'n2' }),
    ])

    current = removeCrossLink(current, 'a0', { project: 'cms', noteId: 'n1' })
    current = removeCrossLink(current, 'a0', { project: 'cms', noteId: 'n2' })

    expect('crossLinks' in current.notes[0]).toBe(false)
  })

  it('does not copy links when a note is duplicated', () => {
    const { workspace: next, ids } = duplicateNotes(
      workspace([{ crossLinks: [link()] }]),
      ['a0'],
      'copy',
    )

    expect(next.notes.find((note) => note.id === ids[0])!.crossLinks).toBeUndefined()
    expect(next.notes[0].crossLinks).toEqual([link()])
  })
})

describe('blockState', () => {
  const note = (status: Note['status'], links: CrossLink[]) =>
    workspace([{ status, crossLinks: links }]).notes[0]
  const none = new Map<string, LinkedNoteInfo>()

  it('is blocked while a note it waits on is open, as read now or as last seen', () => {
    const waits = link({ kind: 'blocked-by', status: 'todo' })

    expect(blockState(note('todo', [waits]), none).blockedBy).toHaveLength(1)
    expect(blockState(note('todo', [{ ...waits, status: 'done' }]), none).blockedBy).toEqual([])

    const read = (info: LinkedNoteInfo) => new Map([[linkKey(waits), info]])

    expect(
      blockState(note('todo', [waits]), read({ found: true, status: 'done' })).blockedBy,
    ).toEqual([])
    expect(blockState(note('todo', [waits]), read({ found: false })).blockedBy).toEqual([])
    expect(
      blockState(
        note('todo', [{ ...waits, status: 'done' }]),
        read({ found: true, status: 'review' }),
      ).blockedBy,
    ).toHaveLength(1)
  })

  it('is blocking while it is itself open', () => {
    expect(blockState(note('in-progress', [link()]), none).blocking).toHaveLength(1)
    expect(blockState(note('done', [link()]), none).blocking).toEqual([])
    expect(blockState(note('todo', [link({ kind: 'related' })]), none)).toEqual({
      blockedBy: [],
      blocking: [],
    })
  })
})
