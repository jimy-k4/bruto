import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LOG_FILE, appendLog, type WriteContext } from './audit'
import { BOARD_FILE, findProject } from './board'
import {
  answerNote,
  connectNotes,
  createNoteTool,
  getContext,
  getNote,
  listNotes,
  searchNotes,
  setStatus,
} from './tools'

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

describe('kinds', () => {
  it('lists and finds notes by kind, rules from old files included', () => {
    board({
      notes: [
        note('aaaaaa-1', { status: 'todo' }),
        note('bbbbbb-1', { status: 'bug' }),
        note('cccccc-1', { status: 'loop' }),
      ],
    })

    expect(listNotes(root)).toMatch(/[bbbbbb].*todo · bug/)
    expect(listNotes(root, { kinds: ['bug'] })).not.toContain('aaaaaa')
    expect(listNotes(root, { kinds: ['rule'] })).toMatch(/[cccccc].*no status · rule/)
    expect(searchNotes(root, { kinds: ['task'] })).not.toMatch(/bbbbbb|cccccc/)
  })
})

describe('searching and marking progress', () => {
  it('finds notes by words or id, like the board search', () => {
    board({
      notes: [
        note('aaaaaa-1', { title: 'Login redirect', status: 'todo' }),
        note('bbbbbb-1', { description: 'The login page is slow', status: 'done' }),
        note('cccccc-1', { title: 'Payments' }),
      ],
    })

    expect(searchNotes(root, { query: 'login' })).toMatch(/aaaaaa[\s\S]*bbbbbb/)
    expect(searchNotes(root, { query: 'login', statuses: ['todo'] })).not.toContain('bbbbbb')
    expect(searchNotes(root, { query: '[cccccc]' })).toContain('Payments')
    expect(searchNotes(root, { query: 'nothing' })).toBe('No notes match.')
  })

  it('marks a note as started with its look, but never a standing rule', () => {
    board({
      notes: [note('aaaaaa-1', { status: 'todo' }), note('bbbbbb-1', { status: 'loop' })],
      statusStyles: { 'in-progress': { color: 'ochre', pattern: 'hatch' } },
    })

    expect(setStatus(root, { id: 'aaaaaa', status: 'in-progress' })).toContain('in-progress')
    expect(saved().notes[0]).toMatchObject({ status: 'in-progress', colorTheme: 'ochre' })
    expect(() => setStatus(root, { id: 'bbbbbb', status: 'done' })).toThrow(/standing rules/i)
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

  it('files a bug as a bug, but never a standing rule', () => {
    createNoteTool(root, { title: 'Crash on save', kind: 'bug' })
    createNoteTool(root, { title: 'Plain', kind: 'task' })

    expect(saved().notes.map((item: { kind?: string }) => item.kind)).toEqual(['bug', undefined])
  })

  it('connects two notes, once', () => {
    board({ notes: [note('aaaaaa-1'), note('bbbbbb-1')] })

    connectNotes(root, { from: 'aaaaaa', to: 'bbbbbb' })
    connectNotes(root, { from: 'aaaaaa', to: 'bbbbbb' })

    expect(saved().connections).toHaveLength(1)
    expect(() => connectNotes(root, { from: 'aaaaaa', to: 'aaaaaa' })).toThrow(/itself/)
  })
})

describe('who changed what', () => {
  const by = (): WriteContext => ({
    caller: { client: 'claude-code', version: '2.1.0', agent: 'reviewer' },
  })

  it('stamps the note with the client, the agent and what it did', () => {
    board({ notes: [note('aaaaaa-1', { status: 'todo' })] })

    const context = by()

    answerNote(root, { id: 'aaaaaa', response: 'Done.' }, context)

    expect(context.note).toBe('aaaaaa-1')
    expect(saved().notes[0].agent).toMatchObject({
      client: 'claude-code',
      version: '2.1.0',
      id: 'reviewer',
      action: 'answer',
    })
    expect(Date.parse(saved().notes[0].agent.at)).not.toBeNaN()

    setStatus(root, { id: 'aaaaaa', status: 'in-progress' }, by())
    expect(saved().notes[0].agent.action).toBe('status')
    expect(getNote(root, 'aaaaaa')).toMatch(
      /Last changed by an agent: claude-code 2\.1\.0 \(reviewer\), status, \d{4}-/,
    )

    createNoteTool(root, { title: 'Found this' }, by())
    expect(saved().notes[1].agent.action).toBe('create')
  })

  it('never answers or moves a note the user made read-only for agents', () => {
    board({ notes: [note('aaaaaa-1', { status: 'todo', agentAccess: 'read' })] })

    expect(() => answerNote(root, { id: 'aaaaaa', response: 'x' }, by())).toThrow(/read-only/)
    expect(() => setStatus(root, { id: 'aaaaaa', status: 'done' }, by())).toThrow(/read-only/)
    expect(saved().notes[0]).toMatchObject({ status: 'todo', agentAccess: 'read' })
    expect(saved().notes[0].agent).toBeUndefined()
    expect(listNotes(root)).toMatch(/\[aaaaaa\] AAAAAA-1 — todo · read only/)
    expect(getContext(root)).toMatch(/Agents: read only/)
  })

  it('logs every call as a line, with the commit and what each file held', () => {
    board({ notes: [] })
    mkdirSync(join(root, 'src'))
    writeFileSync(join(root, 'src', 'login.ts'), 'export {}\n')

    const caller = by().caller

    appendLog(root, caller, {
      tool: 'answer_note',
      note: 'aaaaaa-1',
      args: { id: 'aaaaaa', response: 'Done.' },
      ok: true,
      result: 'is now "review"',
      files: ['src/login.ts', 'src/gone.ts'],
    })
    appendLog(root, caller, {
      tool: 'set_status',
      args: { id: 'zzzzzz', status: 'done' },
      ok: false,
      result: 'No note has an id starting with "zzzzzz".',
    })

    const lines = readFileSync(join(root, LOG_FILE), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))

    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({
      tool: 'answer_note',
      client: 'claude-code',
      version: '2.1.0',
      agent: 'reviewer',
      note: 'aaaaaa-1',
      ok: true,
      files: { 'src/gone.ts': null },
    })
    expect(lines[0].files['src/login.ts']).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(lines[1]).toMatchObject({ tool: 'set_status', ok: false })
    expect(lines[1].files).toBeUndefined()
  })
})
