import { describe, expect, it } from 'vitest'
import type { Note, Workspace } from '../types'
import {
  WorkspaceFormatError,
  addConnection,
  createEmptyWorkspace,
  createNote,
  deleteNotes,
  duplicateNotes,
  getConnectedNoteIds,
  parseWorkspace,
  raiseNotes,
  replaceStatusStyles,
  serializeWorkspace,
  setStatusStyle,
  updateNotes,
  isStandingRule,
} from './workspace'

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

const workspaceWith = (notes: Note[], extra: Partial<Workspace> = {}): Workspace => ({
  ...createEmptyWorkspace('TEST'),
  notes,
  ...extra,
})

describe('parseWorkspace', () => {
  it('rejects invalid JSON with a readable error instead of returning an empty workspace', () => {
    expect(() => parseWorkspace('{ "notes": [ }')).toThrow(WorkspaceFormatError)
  })

  it('rejects notes that are not a list', () => {
    expect(() => parseWorkspace('{ "notes": {} }')).toThrow('"notes" must be a list.')
  })

  it('fills defaults for notes written by hand', () => {
    const workspace = parseWorkspace('{ "notes": [{ "id": "a", "title": "Hi" }] }', 'PROJECT')

    expect(workspace.title).toBe('PROJECT')
    expect(workspace.notes[0]).toMatchObject({
      id: 'a',
      title: 'Hi',
      filePaths: [],
      images: [],
      colorTheme: 'concrete',
      pattern: 'raw',
    })
  })

  it('gives an id to notes without one and maps common status words', () => {
    const workspace = parseWorkspace('{ "notes": [{ "title": "x", "status": "pending" }] }')

    expect(workspace.notes[0].id).toMatch(/[0-9a-f-]{36}/)
    expect(workspace.notes[0].status).toBe('todo')
  })

  it('reads the older single webUrl as the first link, without blanks or repeats', () => {
    const workspace = parseWorkspace(
      JSON.stringify({
        notes: [
          { id: 'old', webUrl: 'https://a.dev' },
          { id: 'new', webUrls: ['https://a.dev', '', ' https://b.dev ', 'https://a.dev'] },
        ],
      }),
    )

    expect(workspace.notes.map((item) => item.webUrls)).toEqual([
      ['https://a.dev'],
      ['https://a.dev', 'https://b.dev'],
    ])
    expect(workspace.notes[0]).not.toHaveProperty('webUrl')
  })

  it('keeps fields it does not know about', () => {
    const workspace = parseWorkspace('{ "custom": 1, "notes": [{ "id": "a", "tag": "x" }] }')

    expect(workspace).toMatchObject({ custom: 1 })
    expect(workspace.notes[0]).toMatchObject({ tag: 'x' })
  })

  it('drops connections to missing notes and duplicates', () => {
    const workspace = parseWorkspace(
      JSON.stringify({
        notes: [{ id: 'a' }, { id: 'b' }],
        connections: [
          { id: '1', from: 'a', to: 'b' },
          { id: '2', from: 'a', to: 'b' },
          { id: '3', from: 'a', to: 'zzz' },
        ],
      }),
    )

    expect(workspace.connections.map((connection) => connection.id)).toEqual(['1'])
  })

  it('bakes v2 status styles into notes so they keep their look', () => {
    const workspace = parseWorkspace(
      JSON.stringify({
        version: 2,
        notes: [{ id: 'a', status: 'done', colorTheme: 'sand', pattern: 'grid' }],
        statusStyles: { done: { color: 'moss', pattern: 'bands' } },
      }),
    )

    expect(workspace.version).toBe(4)
    expect(workspace.notes[0]).toMatchObject({ colorTheme: 'moss', pattern: 'bands' })
  })

  it('turns the old "issue" status into "changes-requested", style included', () => {
    const workspace = parseWorkspace(
      JSON.stringify({
        version: 3,
        notes: [{ id: 'a', status: 'issue' }],
        statusStyles: { issue: { color: 'oxide' } },
      }),
    )

    expect(workspace.notes[0].status).toBe('changes-requested')
    expect(workspace.statusStyles).toEqual({ 'changes-requested': { color: 'oxide' } })
  })

  it('keeps the files the AI touched apart, and drops an empty list', () => {
    const workspace = parseWorkspace(
      JSON.stringify({
        version: 3,
        notes: [
          { id: 'a', filePaths: ['ref.png'], aiFilePaths: ['src/a.ts', 3] },
          { id: 'b', aiFilePaths: [] },
        ],
      }),
    )

    expect(workspace.notes[0]).toMatchObject({ filePaths: ['ref.png'], aiFilePaths: ['src/a.ts'] })
    expect(workspace.notes[1]).not.toHaveProperty('aiFilePaths')
    expect(updateNotes(workspace, ['a'], { aiFilePaths: [] }).notes[0]).not.toHaveProperty(
      'aiFilePaths',
    )
  })

  it('reads who changed a note over MCP and whether agents may only read it', () => {
    const at = '2026-09-30T09:14:00.000Z'
    const workspace = parseWorkspace(
      JSON.stringify({
        version: 4,
        notes: [
          {
            id: 'a',
            agentAccess: 'read',
            agent: {
              client: 'claude-code',
              version: '2.1.0',
              id: 'reviewer',
              action: 'answer',
              at,
            },
          },
          { id: 'b', agentAccess: 'write', agent: { client: 'x', action: 'delete', at } },
          { id: 'c', agent: { client: '', action: 'answer', at } },
        ],
      }),
    )

    expect(workspace.notes[0]).toMatchObject({
      agentAccess: 'read',
      agent: { client: 'claude-code', version: '2.1.0', id: 'reviewer', action: 'answer', at },
    })
    // Only "read" limits agents; a stamp Bruto doesn't understand is dropped, not guessed.
    expect(workspace.notes[1]).not.toHaveProperty('agentAccess')
    expect(workspace.notes[1]).not.toHaveProperty('agent')
    expect(workspace.notes[2]).not.toHaveProperty('agent')
    expect(updateNotes(workspace, ['a'], { agentAccess: undefined }).notes[0]).not.toHaveProperty(
      'agentAccess',
    )
  })

  it('turns the v3 "bug" and "loop" statuses into kinds, rules without a status', () => {
    const workspace = parseWorkspace(
      JSON.stringify({
        version: 3,
        notes: [
          { id: 'a', status: 'bug', colorTheme: 'wine', pattern: 'cross' },
          { id: 'b', status: 'loop' },
          { id: 'c', status: 'Bucle' },
          { id: 'd', status: 'always' },
          { id: 'e', status: 'in-progress', kind: 'Regla' },
          { id: 'f', status: 'todo', kind: 'something else' },
        ],
        statusStyles: {
          todo: { color: 'sand' },
          bug: { color: 'wine', pattern: 'cross' },
          loop: { color: 'bark', pattern: 'pinstripe' },
        },
      }),
    )

    expect(workspace.version).toBe(4)
    expect(workspace.notes.map((item) => [item.kind, item.status])).toEqual([
      ['bug', 'todo'],
      ['rule', undefined],
      ['rule', undefined],
      ['rule', undefined],
      ['rule', 'in-progress'],
      [undefined, 'todo'],
    ])
    // A bug keeps the look of its kind even though "todo" has another one.
    expect(workspace.notes[0]).toMatchObject({ colorTheme: 'wine', pattern: 'cross' })
    // The kinds' looks stay under the keys they had as statuses.
    expect(workspace.statusStyles).toMatchObject({
      bug: { color: 'wine', pattern: 'cross' },
      loop: { color: 'bark', pattern: 'pinstripe' },
    })
  })

  it('tells a standing rule from a retired one', () => {
    const [active, retired, task] = workspaceWith([
      note('a', { kind: 'rule' }),
      note('b', { kind: 'rule', status: 'done' }),
      note('c', { status: 'todo' }),
    ]).notes

    expect([active, retired, task].map(isStandingRule)).toEqual([true, false, false])
  })

  it('restyles notes whose status changed while Bruto was closed', () => {
    const styles = {
      todo: { color: 'sand', pattern: 'grid' },
      review: { color: 'plum', pattern: 'dots' },
    }
    const workspace = parseWorkspace(
      JSON.stringify({
        version: 3,
        statusStyles: styles,
        notes: [
          // An AI moved it from todo to review: it still wears the todo look.
          { id: 'stale', status: 'review', colorTheme: 'sand', pattern: 'grid' },
          // Created by a tool without any look.
          { id: 'plain', status: 'review' },
          // Chosen by hand: kept.
          { id: 'custom', status: 'review', colorTheme: 'wine', pattern: 'waves' },
        ],
      }),
    )

    expect(workspace.notes.map((note) => [note.colorTheme, note.pattern])).toEqual([
      ['plum', 'dots'],
      ['plum', 'dots'],
      ['wine', 'waves'],
    ])
  })

  it('does not re-apply status styles to v3 notes', () => {
    const workspace = parseWorkspace(
      JSON.stringify({
        version: 3,
        notes: [{ id: 'a', status: 'done', colorTheme: 'sand' }],
        statusStyles: { done: { color: 'moss' } },
      }),
    )

    expect(workspace.notes[0].colorTheme).toBe('sand')
  })

  it('round-trips through serialize', () => {
    const workspace = workspaceWith([note('a', { status: 'todo', aiResponse: 'ok' })])

    expect(parseWorkspace(serializeWorkspace(workspace))).toEqual(workspace)
  })
})

describe('status styles', () => {
  it('applies the configured look when the status changes', () => {
    const workspace = workspaceWith([note('a', { status: 'todo' })], {
      statusStyles: { done: { color: 'moss', pattern: 'bands' } },
    })

    const next = updateNotes(workspace, ['a'], { status: 'done' })

    expect(next.notes[0]).toMatchObject({ status: 'done', colorTheme: 'moss', pattern: 'bands' })
  })

  it('lets the user change the look afterwards', () => {
    const workspace = workspaceWith([note('a', { status: 'done', colorTheme: 'moss' })], {
      statusStyles: { done: { color: 'moss' } },
    })

    const next = updateNotes(workspace, ['a'], { pattern: 'dots', colorTheme: 'wine' })

    expect(next.notes[0]).toMatchObject({ colorTheme: 'wine', pattern: 'dots' })
  })

  it('re-colors notes that still follow the automatic look, not customised ones', () => {
    const workspace = workspaceWith(
      [
        note('auto', { status: 'done', colorTheme: 'moss' }),
        note('custom', { status: 'done', colorTheme: 'wine' }),
      ],
      { statusStyles: { done: { color: 'moss' } } },
    )

    const next = setStatusStyle(workspace, 'done', { color: 'teal' })

    expect(next.notes.map((item) => item.colorTheme)).toEqual(['teal', 'wine'])
    expect(next.statusStyles).toEqual({ done: { color: 'teal' } })
  })

  it('takes every status look from another project, clearing the ones it lacks', () => {
    const workspace = workspaceWith(
      [
        note('auto', { status: 'done', colorTheme: 'moss' }),
        note('custom', { status: 'done', colorTheme: 'wine' }),
      ],
      { statusStyles: { done: { color: 'moss' }, todo: { color: 'sand' } } },
    )

    const next = replaceStatusStyles(workspace, { done: { color: 'teal', pattern: 'dots' } })

    expect(next.statusStyles).toEqual({ done: { color: 'teal', pattern: 'dots' } })
    expect(next.notes.map((item) => [item.colorTheme, item.pattern])).toEqual([
      ['teal', 'dots'],
      ['wine', 'dots'],
    ])
  })

  it('applies the look of a kind when a note becomes a bug or a rule', () => {
    const workspace = workspaceWith(
      [note('a', { status: 'todo' }), note('b', { kind: 'rule', colorTheme: 'bark' })],
      {
        statusStyles: { bug: { color: 'wine', pattern: 'cross' }, loop: { color: 'bark' } },
      },
    )

    const next = updateNotes(workspace, ['a'], { kind: 'bug' })

    expect(next.notes[0]).toMatchObject({ kind: 'bug', colorTheme: 'wine', pattern: 'cross' })
    // Restyling rules reaches the notes of that kind.
    expect(setStatusStyle(next, 'loop', { color: 'teal' }).notes[1].colorTheme).toBe('teal')
  })

  it('removes the configuration when cleared', () => {
    const workspace = workspaceWith([], { statusStyles: { done: { color: 'moss' } } })

    expect(setStatusStyle(workspace, 'done', undefined).statusStyles).toBeUndefined()
  })
})

describe('note operations', () => {
  it('creates notes on top with the status look', () => {
    const workspace = workspaceWith([note('a', { zIndex: 7 })], {
      statusStyles: { idea: { color: 'cobalt' } },
    })

    const { workspace: next, note: created } = createNote(workspace, { x: 10.4, y: 20.6 }, 'New')

    expect(created).toMatchObject({ x: 10, y: 21, zIndex: 8, status: 'idea', colorTheme: 'cobalt' })
    expect(next.notes).toHaveLength(2)
  })

  it('removes empty AI texts instead of saving blanks', () => {
    const workspace = workspaceWith([note('a', { aiResponse: 'x' })])

    expect(updateNotes(workspace, ['a'], { aiResponse: '  ' }).notes[0]).not.toHaveProperty(
      'aiResponse',
    )
  })

  it('updates several notes at once', () => {
    const workspace = workspaceWith([note('a'), note('b'), note('c')])

    const next = updateNotes(workspace, ['a', 'c'], { status: 'blocked' })

    expect(next.notes.map((item) => item.status)).toEqual(['blocked', undefined, 'blocked'])
  })

  it('deletes notes with their connections', () => {
    const workspace = addConnection(workspaceWith([note('a'), note('b')]), 'a', 'b')

    const next = deleteNotes(workspace, ['a'])

    expect(next.notes.map((item) => item.id)).toEqual(['b'])
    expect(next.connections).toEqual([])
  })

  it('duplicates notes and the connections between them', () => {
    const workspace = addConnection(workspaceWith([note('a'), note('b')]), 'a', 'b')

    const { workspace: next, ids } = duplicateNotes(workspace, ['a', 'b'], 'copy')

    expect(ids).toHaveLength(2)
    expect(next.notes.find((item) => item.id === ids[0])).toMatchObject({
      title: 'A (copy)',
      x: 36,
      y: 36,
    })
    expect(next.connections).toHaveLength(2)
    expect(next.connections[1]).toMatchObject({ from: ids[0], to: ids[1] })
  })

  it('never connects a note to itself or twice', () => {
    const workspace = workspaceWith([note('a'), note('b')])
    const once = addConnection(workspace, 'a', 'b')

    expect(addConnection(once, 'a', 'b')).toBe(once)
    expect(addConnection(workspace, 'a', 'a')).toBe(workspace)
  })

  it('raises notes keeping their order and skips work when already on top', () => {
    const workspace = workspaceWith([
      note('a', { zIndex: 1 }),
      note('b', { zIndex: 2 }),
      note('c', { zIndex: 3 }),
    ])

    const next = raiseNotes(workspace, ['b', 'a'])

    expect(next.notes.map((item) => item.zIndex)).toEqual([4, 5, 3])
    expect(raiseNotes(next, ['a', 'b'])).toBe(next)
  })

  it('follows connections forward only', () => {
    let workspace = workspaceWith([note('a'), note('b'), note('c')])
    workspace = addConnection(workspace, 'a', 'b')
    workspace = addConnection(workspace, 'c', 'a')

    expect([...getConnectedNoteIds(workspace, 'a')]).toEqual(['a', 'b'])
  })
})
