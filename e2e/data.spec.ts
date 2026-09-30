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

test('creates the workspace file on first open', async ({ page }) => {
  await openProject(page)

  await expect(page.getByRole('heading', { name: /nada por aquí todavía/i })).toBeVisible()
  expect((await readDisk(page)).notes).toEqual([])
})

test('saves a new note to disk', async ({ page }) => {
  await openProject(page, workspaceWith([]))

  await page.keyboard.press('n')
  await page.getByLabel('Título').fill('Arreglar login')
  await page.keyboard.press('Control+Enter')
  await waitForSaved(page)

  const disk = await readDisk(page)

  expect(disk.notes).toHaveLength(1)
  expect(disk.notes[0]).toMatchObject({ title: 'Arreglar login', status: 'idea' })
})

test('merges what an AI writes into the file while the app is open', async ({ page }) => {
  await openProject(page, workspaceWith([note('a', { status: 'todo' }), note('b', { x: 500 })]))
  await expect(noteCard(page, 'A')).toBeVisible()

  const disk = await readDisk(page)
  disk.notes[0] = { ...disk.notes[0], status: 'review', aiResponse: 'Hecho por la IA' }
  await writeDisk(page, JSON.stringify(disk, null, 2))

  await expect(page.getByText(/cambios hechos fuera de bruto/i)).toBeVisible()
  await expect(noteCard(page, 'A').getByText('Por revisar')).toBeVisible()

  // A local edit afterwards keeps the AI's work.
  await noteCard(page, 'B').click()
  await page.getByLabel('Descripción').fill('Escrito por mí')
  await waitForSaved(page)

  const saved = await readDisk(page)

  expect(saved.notes[0]).toMatchObject({ status: 'review', aiResponse: 'Hecho por la IA' })
  expect(saved.notes[1]).toMatchObject({ description: 'Escrito por mí' })
})

test('shows which agent answered a note, and locks a note for agents', async ({ page }) => {
  await openProject(
    page,
    workspaceWith([
      note('a', {
        status: 'review',
        aiResponse: 'Hecho.',
        agent: {
          client: 'claude-code',
          id: 'reviewer',
          action: 'answer',
          at: '2026-09-30T09:14:00.000Z',
        },
      }),
      note('b', { x: 500, agentAccess: 'read' }),
    ]),
  )

  // A locked note wears a lock by its id.
  await expect(noteCard(page, 'B').locator('.note__lock')).toBeVisible()
  await expect(noteCard(page, 'A').locator('.note__lock')).toHaveCount(0)

  // The editor says which agent answered, and when.
  await noteCard(page, 'A').click()
  await expect(page.getByText(/Agente: claude-code · reviewer la contestó el/)).toBeVisible()

  // Locking it for agents is saved in the file.
  const toggle = page.getByRole('button', { name: 'Solo lectura para agentes' })

  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await waitForSaved(page)
  expect((await readDisk(page)).notes[0]).toMatchObject({ agentAccess: 'read' })
  await expect(noteCard(page, 'A').locator('.note__lock')).toBeVisible()
})

test('when an agent changes what the user is changing, the user’s value stays and both are told', async ({
  page,
}) => {
  await openProject(page, workspaceWith([note('a', { status: 'todo' })]))
  await noteCard(page, 'A').click()

  // The user moves the note on; before it is saved, an agent sends it to review.
  await page.getByLabel('Estado').selectOption('in-progress')

  const disk = await readDisk(page)

  disk.notes[0] = {
    ...disk.notes[0],
    status: 'review',
    agent: { client: 'claude-code', action: 'status', at: new Date().toISOString() },
  }
  await writeDisk(page, JSON.stringify(disk, null, 2))

  await expect(page.getByText(/Tú y claude-code cambiasteis «A» a la vez \(Estado\)/)).toBeVisible()
  await waitForSaved(page)

  // The file keeps the user's value and tells the agent its change was undone.
  expect((await readDisk(page)).notes[0]).toMatchObject({
    status: 'in-progress',
    agent: { reverted: [{ field: 'status', value: 'review' }] },
  })
  await expect(page.getByText(/Se deshizo su cambio \(Estado\)/)).toBeVisible()

  // The user can take the agent's value after all.
  await page.getByRole('button', { name: 'Usar el suyo' }).click()
  await waitForSaved(page)
  expect((await readDisk(page)).notes[0].status).toBe('review')
})

test('a note keeps its age and counts each time review sends it back', async ({ page }) => {
  const createdAt = new Date(Date.now() - 6 * 86_400_000).toISOString()

  await openProject(page, workspaceWith([note('a', { status: 'review', createdAt, sentBack: 2 })]))

  // Six days old, sent back twice, whatever its status says now.
  const meta = noteCard(page, 'A').locator('.note__meta')

  await expect(meta).toContainText('6')
  await expect(meta.locator('.note__sent-back')).toHaveText('↩ 2')

  await noteCard(page, 'A').click()
  await expect(page.getByText(/Creada el .* · Devuelta 2 veces/)).toBeVisible()

  // One more round trip.
  await page.getByLabel('Estado').selectOption('changes-requested')
  await waitForSaved(page)
  await expect(meta.locator('.note__sent-back')).toHaveText('↩ 3')
  expect((await readDisk(page)).notes[0]).toMatchObject({ createdAt, sentBack: 3 })
})

test('never replaces a broken workspace file with an empty one', async ({ page }) => {
  const broken = '{ "notes": [ { "id": "a", "title": "Importante" } '

  await openProject(page, undefined, broken)

  await expect(page.getByRole('heading', { name: /no se puede leer el workspace/i })).toBeVisible()

  const text = await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory()
    const bruto = await (await root.getDirectoryHandle('demo')).getDirectoryHandle('.bruto')

    return (await (await bruto.getFileHandle('workspace.json')).getFile()).text()
  })

  expect(text).toBe(broken)
})

test('recovers after the broken file is fixed', async ({ page }) => {
  await openProject(page, undefined, '{ broken')
  await expect(page.getByRole('heading', { name: /no se puede leer/i })).toBeVisible()

  await writeDisk(page, JSON.stringify(workspaceWith([note('fixed')])))
  await page.getByRole('button', { name: 'Reintentar' }).click()

  await expect(noteCard(page, 'FIXED')).toBeVisible()
})

test('pauses saving while the file on disk is broken, then offers to overwrite', async ({
  page,
}) => {
  await openProject(page, workspaceWith([note('a')]))
  await expect(noteCard(page, 'A')).toBeVisible()

  await writeDisk(page, '{ "half written"')
  await noteCard(page, 'A').click()
  await page.getByLabel('Título').fill('Mío')

  await expect(page.locator('.save-status')).toContainText(/fichero en disco tiene un error/i)

  await page.getByRole('button', { name: /sobrescribir con mi versión/i }).click()
  await waitForSaved(page)

  expect((await readDisk(page)).notes[0]).toMatchObject({ title: 'Mío' })
})

test('keeps unknown fields other tools wrote', async ({ page }) => {
  await openProject(page, workspaceWith([note('a', { customTag: 'x' })], { customField: 1 }))
  await noteCard(page, 'A').click()
  await page.getByLabel('Título').fill('A2')
  await waitForSaved(page)

  const disk = await readDisk(page)

  expect(disk.customField).toBe(1)
  expect(disk.notes[0]).toMatchObject({ customTag: 'x', title: 'A2' })
})

test('a status changed by an AI while Bruto was closed gets its look on open', async ({ page }) => {
  await openProject(
    page,
    workspaceWith([note('a', { status: 'review', colorTheme: 'sand', pattern: 'grid' })], {
      statusStyles: {
        todo: { color: 'sand', pattern: 'grid' },
        review: { color: 'plum', pattern: 'dots' },
      },
    }),
  )

  await expect(noteCard(page, 'A')).toHaveClass(/note-color-plum/)
  await expect(noteCard(page, 'A')).toHaveClass(/note-pattern-dots/)
  expect((await readDisk(page)).notes[0]).toMatchObject({ colorTheme: 'plum', pattern: 'dots' })
})

test('a file caught half-written by another tool is read again, not reported as broken', async ({
  page,
}) => {
  await openProject(page, workspaceWith([note('a')]))

  // Empty for a moment, then complete, like an editor saving in place.
  await writeDisk(page, '')
  await page.waitForTimeout(150)
  await writeDisk(page, JSON.stringify(workspaceWith([note('a'), note('b', { x: 500 })])))

  await expect(noteCard(page, 'B')).toBeVisible()
  await expect(page.locator('.save-status')).not.toContainText(/error/i)
})
