import { expect, test } from './fixtures'
import {
  note,
  noteCard,
  openProject,
  readDisk,
  waitForSaved,
  workspaceWith,
  writeDisk,
} from './helpers'

test('a note an agent puts in progress shows it at work, until the user moves it', async ({
  page,
}) => {
  await openProject(page, workspaceWith([note('task', { title: 'TAREA', status: 'todo' })]))

  // What the MCP server's set_status writes when an agent starts on the note.
  const disk = await readDisk(page)
  disk.notes[0].status = 'in-progress'
  disk.notes[0].agent = {
    client: 'claude-code',
    id: 'reviewer',
    action: 'status',
    at: new Date().toISOString(),
  }
  await writeDisk(page, JSON.stringify(disk, null, 2))

  const card = noteCard(page, 'TAREA')
  const tape = card.locator('.note__tape--working')

  await expect(tape).toHaveText('claude-code · reviewer trabajando')
  await expect(card).toHaveClass(/is-agent-working/)
  await expect(card).toHaveAccessibleName(/claude-code · reviewer trabajando/)

  // Opened meanwhile, the note says so before anything is changed.
  await card.click()
  await expect(page.getByRole('status').filter({ hasText: 'está trabajando' })).toHaveText(
    /^claude-code · reviewer está trabajando en esta nota\./,
  )

  // The user takes it back: the tape goes, and doesn't return when they set it in progress.
  const status = page.getByLabel('Estado', { exact: true })
  await status.selectOption('todo')
  await expect(tape).toBeHidden()
  await status.selectOption('in-progress')
  await waitForSaved(page)
  await expect(card).not.toHaveClass(/is-agent-working/)
  expect((await readDisk(page)).notes[0]).not.toHaveProperty('agent')
})
