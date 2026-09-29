// Starts the built server as a real MCP client would (npx bruto-mcp) and
// walks the loop on a throwaway board: list, read, answer, create, connect.
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import assert from 'node:assert/strict'
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

  const answered = await text('answer_note', {
    id: 'a1b2c3',
    response: 'Fixed the redirect.',
    files: ['src/login.ts'],
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

  console.log('bruto-mcp smoke test passed')
} finally {
  await client.close()
  rmSync(project, { recursive: true, force: true })
}
