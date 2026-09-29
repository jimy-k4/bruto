import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BOARD_FILE, findProject } from './board'
import { answerNote, connectNotes, createNoteTool, getContext, getNote, listNotes } from './tools'

let root: string

const note = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: id.toUpperCase(),
  x: 60,
  y: 60,
  ...extra,
})

function board(workspace: Record<string, unknown>) {
  mkdirSync(join(root, '.bruto'), { recursive: true })
  writeFileSync(join(root, BOARD_FILE), JSON.stringify({ version: 3, title: 'TEST', ...workspace }))
}

const saved = () => JSON.parse(readFileSync(join(root, BOARD_FILE), 'utf8'))

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'bruto-mcp-test-'))
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('reading the board', () => {
  it('finds the project from a folder inside it', () => {
    board({ notes: [] })
    mkdirSync(join(root, 'src', 'app'), { recursive: true })

    expect(findProject(join(root, 'src', 'app'))).toBe(root)
  })

  it('lists open notes in reading order, or the statuses asked for', () => {
    board({
      notes: [
        note('bbbbbb-1', { status: 'todo', y: 400 }),
        note('aaaaaa-1', { status: 'review' }),
        note('cccccc-1', { status: 'done' }),
      ],
    })

    expect(listNotes(root)).toMatch(/\[aaaaaa\].*review\n- \[bbbbbb\].*todo/)
    expect(listNotes(root)).not.toContain('cccccc')
    expect(listNotes(root, { statuses: ['todo'] })).not.toContain('aaaaaa')
  })

  it('reads a note by the start of its id and refuses to guess', () => {
    board({
      notes: [note('abc111', { description: 'Fix login' }), note('abc222'), note('def333')],
      connections: [{ id: 'c', from: 'abc111', to: 'def333' }],
    })

    expect(getNote(root, '[abc1]')).toContain('Fix login')
    expect(getNote(root, 'abc1')).toContain('Points to: [def333] DEF333')
    expect(() => getNote(root, 'abc')).toThrow(/matches 2 notes/)
    expect(() => getNote(root, 'zzz')).toThrow(/No note/)
  })

  it('gives the same context as the app, for some notes or all', () => {
    board({ notes: [note('aaaaaa-1', { status: 'todo' }), note('bbbbbb-1', { status: 'loop' })] })

    expect(getContext(root)).toContain('## HOW TO USE THIS CONTEXT')
    expect(getContext(root, { ids: ['aaaaaa'] })).toContain('### [aaaaaa] AAAAAA-1')
    expect(getContext(root, { ids: ['aaaaaa'] })).toContain('## STANDING RULES')
  })

  it('never touches a broken board', () => {
    mkdirSync(join(root, '.bruto'))
    writeFileSync(join(root, BOARD_FILE), '{ "notes": [')

    expect(() => answerNote(root, { id: 'x', response: 'y' })).toThrow(/not valid/)
    expect(readFileSync(join(root, BOARD_FILE), 'utf8')).toBe('{ "notes": [')
  })
})

describe('answering', () => {
  it('writes the answer, adds the files once and sends the note to review with its look', () => {
    board({
      notes: [note('aaaaaa-1', { status: 'todo', aiFilePaths: ['src/a.ts'] })],
      statusStyles: { review: { color: 'plum', pattern: 'dots' } },
    })

    answerNote(root, {
      id: 'aaaaaa',
      response: 'Done.',
      files: ['src\\a.ts', join(root, 'src', 'b.ts'), './src/c.ts'],
    })

    expect(saved().notes[0]).toMatchObject({
      aiResponse: 'Done.',
      aiFilePaths: ['src/a.ts', 'src/b.ts', 'src/c.ts'],
      status: 'review',
      colorTheme: 'plum',
      pattern: 'dots',
    })
  })

  it('clears the feedback of a note sent back, and can add to the previous answer', () => {
    board({
      notes: [
        note('aaaaaa-1', { status: 'changes-requested', aiResponse: 'First.', feedback: 'Wrong' }),
      ],
    })

    answerNote(root, { id: 'aaaaaa', response: 'Fixed.', append: true })

    expect(saved().notes[0]).toMatchObject({ aiResponse: 'First.\n\nFixed.', status: 'review' })
    expect(saved().notes[0]).not.toHaveProperty('feedback')
  })

  it('refuses to answer a standing rule', () => {
    board({ notes: [note('aaaaaa-1', { status: 'loop' })] })

    expect(() => answerNote(root, { id: 'aaaaaa', response: 'x' })).toThrow(/standing rule/)
    expect(saved().notes[0].status).toBe('loop')
  })
})

describe('adding to the board', () => {
  it('starts a board in a project without one, with the note as an idea', () => {
    expect(createNoteTool(root, { title: 'Rate limit', links: ['https://x.dev'] })).toMatch(
      /Created \[\w{6}\] Rate limit as "idea"/,
    )
    expect(saved().notes[0]).toMatchObject({
      title: 'Rate limit',
      status: 'idea',
      webUrls: ['https://x.dev'],
    })
  })

  it('places a follow-up next to its note, connected, and never on top of another', () => {
    board({ notes: [note('aaaaaa-1'), note('bbbbbb-1', { x: 420, y: 60 })] })

    createNoteTool(root, { title: 'Next', after: 'aaaaaa' })
    createNoteTool(root, { title: 'Later' })

    const [, , next, later] = saved().notes

    expect(next).toMatchObject({ x: 420 })
    expect(next.y).toBeGreaterThan(60)
    expect(later.y).toBeGreaterThan(60)
    expect(saved().connections).toMatchObject([{ from: 'aaaaaa-1', to: next.id }])
  })

  it('connects two notes, once', () => {
    board({ notes: [note('aaaaaa-1'), note('bbbbbb-1')] })

    connectNotes(root, { from: 'aaaaaa', to: 'bbbbbb' })
    connectNotes(root, { from: 'aaaaaa', to: 'bbbbbb' })

    expect(saved().connections).toHaveLength(1)
    expect(() => connectNotes(root, { from: 'aaaaaa', to: 'aaaaaa' })).toThrow(/itself/)
  })
})
