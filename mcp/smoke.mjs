// Starts the built server as a real MCP client would (npx bruto-mcp) and
// walks the loop on a throwaway board: list, read, answer, create, connect.
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const project = mkdtempSync(join(tmpdir(), 'bruto-mcp-'))
const board = join(project, '.bruto', 'workspace.json')

mkdirSync(join(project, '.bruto'))
writeFileSync(
  board,
  JSON.stringify({
    version: 3,
    title: 'SMOKE',
    notes: [
      { id: 'a1b2c3d4-0000', title: 'Fix login', status: 'todo', x: 60, y: 60 },
      { id: 'e5f6a7b8-0000', title: 'Tests first', status: 'loop', x: 420, y: 60 },
    ],
    connections: [],
  }),
)

const client = new Client({ name: 'smoke', version: '1.0.0' })

await client.connect(
  new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('./dist/index.js', import.meta.url)), '--project', project],
  }),
)

const text = async (name, args = {}) => {
  const result = await client.callTool({ name, arguments: args })

  return { text: result.content[0].text, isError: Boolean(result.isError) }
}

try {
  const { tools } = await client.listTools()

  assert.deepEqual(tools.map((tool) => tool.name).sort(), [
    'answer_note',
    'connect_notes',
    'create_note',
    'get_context',
    'get_note',
    'list_notes',
    'search_notes',
    'set_status',
  ])

  // Reads are marked as such, so clients can run them without asking.
  assert.equal(tools.find((tool) => tool.name === 'get_context').annotations.readOnlyHint, true)

  assert.match((await text('list_notes')).text, /\[a1b2c3\] Fix login — todo/)
  assert.match((await text('get_context')).text, /## STANDING RULES/)
  assert.match((await text('search_notes', { query: 'login' })).text, /\[a1b2c3\]/)
  assert.match(
    (await text('set_status', { id: 'a1b2c3', status: 'in-progress' })).text,
    /in-progress/,
  )

  mkdirSync(join(project, 'src'))
  writeFileSync(join(project, 'src', 'login.ts'), 'export const login = true\n')

  const answered = await text('answer_note', {
    id: 'a1b2c3',
    response: 'Fixed the redirect.',
    files: ['src/login.ts'],
    agent: 'fixer',
  })
  assert.equal(answered.isError, false, answered.text)

  const rule = await text('answer_note', { id: 'e5f6a7', response: 'x' })
  assert.equal(rule.isError, true)

  assert.match(
    (await text('create_note', { title: 'Add rate limit', after: 'a1b2c3' })).text,
    /Created/,
  )

  const saved = JSON.parse(readFileSync(board, 'utf8'))
  const login = saved.notes.find((note) => note.id.startsWith('a1b2c3'))

  assert.equal(login.status, 'review')
  assert.deepEqual(login.aiFilePaths, ['src/login.ts'])
  assert.equal(saved.notes.length, 3)
  assert.equal(saved.connections.length, 1)

  // The note says who answered it: the client from the handshake and the agent id it gave.
  assert.deepEqual(
    { client: login.agent.client, version: login.agent.version, id: login.agent.id },
    { client: 'smoke', version: '1.0.0', id: 'fixer' },
  )

  // Every write is in the log, the refused one too, with the answered file's fingerprint.
  const log = readFileSync(join(project, '.bruto', 'log.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))

  assert.deepEqual(
    log.map((entry) => [entry.tool, entry.ok]),
    [
      ['set_status', true],
      ['answer_note', true],
      ['answer_note', false],
      ['create_note', true],
    ],
  )
  assert.equal(log[1].note, login.id)
  assert.equal(log[1].agent, 'fixer')
  assert.match(log[1].files['src/login.ts'], /^sha256:[0-9a-f]{64}$/)

  await worktreeAnswersOnMainBoard()

  console.log('bruto-mcp smoke test passed')
} finally {
  await client.close()
  rmSync(project, { recursive: true, force: true })
}

/**
 * The board is committed, an agent starts in a linked worktree and answers a
 * note: the answer lands on the main checkout's board, not the worktree's copy.
 */
async function worktreeAnswersOnMainBoard() {
  const root = mkdtempSync(join(tmpdir(), 'bruto-mcp-wt-'))
  const main = join(root, 'main')
  const worktree = join(root, 'wt')
  const git = (cwd, ...args) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
      cwd,
      stdio: 'ignore',
    })
  const boardOf = (folder) =>
    JSON.parse(readFileSync(join(folder, '.bruto', 'workspace.json'), 'utf8'))

  mkdirSync(join(main, '.bruto'), { recursive: true })
  writeFileSync(
    join(main, '.bruto', 'workspace.json'),
    JSON.stringify({
      version: 4,
      title: 'WT',
      notes: [{ id: 'f00baa11-0000', title: 'From a worktree', status: 'todo', x: 60, y: 60 }],
      connections: [],
    }),
  )
  git(main, 'init', '-q')
  // Forced: a global gitignore often leaves .bruto/ out.
  git(main, 'add', '-f', '.')
  git(main, 'commit', '-q', '-m', 'board')
  git(main, 'worktree', 'add', '-q', worktree)

  // Started where the agent works, as a client does: no --project.
  const agent = new Client({ name: 'smoke-worktree', version: '1.0.0' })

  await agent.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [fileURLToPath(new URL('./dist/index.js', import.meta.url))],
      cwd: worktree,
    }),
  )

  try {
    const result = await agent.callTool({
      name: 'answer_note',
      arguments: { id: 'f00baa', response: 'Done in the worktree.' },
    })

    assert.equal(result.isError, undefined, result.content[0].text)
    assert.equal(boardOf(main).notes[0].status, 'review')
    assert.equal(boardOf(worktree).notes[0].status, 'todo')
  } finally {
    await agent.close()
    rmSync(root, { recursive: true, force: true })
  }
}
