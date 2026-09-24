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
