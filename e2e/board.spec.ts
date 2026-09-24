import { expect, test } from './fixtures'
import { note, noteCard, openProject, readDisk, waitForSaved, workspaceWith } from './helpers'

const threeNotes = () =>
  workspaceWith([
    note('alpha', { x: 80, y: 80, status: 'todo' }),
    note('beta', { x: 480, y: 80 }),
    note('gamma', { x: 880, y: 80 }),
  ])

test('clicking a note selects it and opens the editor without stealing focus', async ({ page }) => {
  await openProject(page, threeNotes())

  await noteCard(page, 'ALPHA').click()

  await expect(noteCard(page, 'ALPHA')).toHaveClass(/is-selected/)
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('alpha'.toUpperCase())
  await expect(page.getByLabel('Título', { exact: true })).not.toBeFocused()
})

test('shortcuts never fire while typing', async ({ page }) => {
  await openProject(page, threeNotes())
  await noteCard(page, 'ALPHA').click()

  await page.getByLabel('Título', { exact: true }).fill('')
  await page.getByLabel('Título', { exact: true }).pressSequentially('nqwe')

  await expect(page.locator('.note')).toHaveCount(3)
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('nqwe')
})

test('keyboard only: tab to a note, open it, move it, close it', async ({ page }) => {
  await openProject(page, threeNotes())

  await noteCard(page, 'BETA').focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Shift+ArrowDown')
  await waitForSaved(page)

  expect((await readDisk(page)).notes[1]).toMatchObject({ x: 490, y: 130 })

  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Título', { exact: true })).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(page.locator('.side-panel')).toHaveCount(0)
})

test('delete, then undo from the toast', async ({ page }) => {
  await openProject(page, threeNotes())

  await noteCard(page, 'GAMMA').click()
  await page.locator('.board').click({ position: { x: 700, y: 600 } })
  await noteCard(page, 'GAMMA').focus()
  await page.keyboard.press('Delete')

  await expect(noteCard(page, 'GAMMA')).toHaveCount(0)

  await page.getByRole('button', { name: 'Deshacer' }).click()
  await expect(noteCard(page, 'GAMMA')).toBeVisible()
})

test('drag moves a note and Ctrl+Z puts it back', async ({ page }) => {
  await openProject(page, threeNotes())

  const box = (await noteCard(page, 'ALPHA').boundingBox())!

  await page.mouse.move(box.x + 100, box.y + 100)
  await page.mouse.down()
  await page.mouse.move(box.x + 200, box.y + 180, { steps: 5 })
  await page.mouse.up()
  await waitForSaved(page)

  expect((await readDisk(page)).notes[0]).toMatchObject({ x: 180, y: 160 })

  await page.locator('.board').click({ position: { x: 700, y: 700 } })
  await page.keyboard.press('Control+z')
  await waitForSaved(page)

  expect((await readDisk(page)).notes[0]).toMatchObject({ x: 80, y: 80 })
})

test('area selection, then bulk status change for every selected note', async ({ page }) => {
  await openProject(page, threeNotes())

  const board = (await page.locator('.board').boundingBox())!

  await page.mouse.move(board.x + 20, board.y + 20)
  await page.mouse.down()
  await page.mouse.move(board.x + 900, board.y + 300, { steps: 5 })
  await page.mouse.up()

  await expect(page.locator('.note.is-selected')).toHaveCount(3)

  await page.getByRole('toolbar').getByRole('button', { name: 'Editar' }).click()
  await page.getByLabel('Estado', { exact: true }).selectOption('blocked')
  await waitForSaved(page)

  expect((await readDisk(page)).notes.map((item) => item.status)).toEqual([
    'blocked',
    'blocked',
    'blocked',
  ])
})

test('connect two notes with C and click, then delete the connection', async ({ page }) => {
  await openProject(page, threeNotes())

  await noteCard(page, 'ALPHA').focus()
  await page.keyboard.press('c')
  await expect(page.getByText(/haz clic en la nota de destino/i)).toBeVisible()
  await noteCard(page, 'BETA').click()
  await waitForSaved(page)

  expect((await readDisk(page)).connections).toHaveLength(1)

  await page.getByRole('button', { name: /conexión de ALPHA a BETA/i }).focus()
  await page.keyboard.press('Delete')
  await waitForSaved(page)

  expect((await readDisk(page)).connections).toHaveLength(0)
})

test('status style is applied on change and the look can still be changed by hand', async ({
  page,
}) => {
  await openProject(
    page,
    workspaceWith([note('alpha', { status: 'todo' })], {
      statusStyles: { done: { color: 'moss', pattern: 'bands' } },
    }),
  )

  await noteCard(page, 'ALPHA').click()
  await page.getByLabel('Estado', { exact: true }).selectOption('done')
  await expect(noteCard(page, 'ALPHA')).toHaveClass(/note-color-moss/)

  // The bug from the old version: choosing a pattern did nothing.
  await page.getByRole('radio', { name: 'Puntos' }).check({ force: true })
  await expect(noteCard(page, 'ALPHA')).toHaveClass(/note-pattern-dots/)
})

test('copy and paste notes with their connection', async ({ page }) => {
  await openProject(
    page,
    workspaceWith([note('a', { x: 80 }), note('b', { x: 480 })], {
      connections: [{ id: 'c1', from: 'a', to: 'b' }],
    }),
  )

  await page.keyboard.press('Control+a')
  await page.keyboard.press('Control+c')
  await expect(page.getByText(/2 notas copiadas/i)).toBeVisible()

  await page.keyboard.press('Control+v')
  await waitForSaved(page)

  const disk = await readDisk(page)

  expect(disk.notes).toHaveLength(4)
  expect(disk.connections).toHaveLength(2)
  expect(disk.notes.slice(2).map((item) => item.title)).toEqual(['A (copia)', 'B (copia)'])
})

test('Q copies the selected note for the AI', async ({ page }) => {
  await openProject(
    page,
    workspaceWith([note('a1b2c3-x', { title: 'Login roto', status: 'todo' })]),
  )

  await noteCard(page, 'Login roto').click()
  await page.locator('.board').click({ position: { x: 300, y: 650 } })
  await noteCard(page, 'Login roto').focus()
  await page.keyboard.press('q')
  await expect(page.getByText(/contexto copiado/i)).toBeVisible()

  const text = await page.evaluate(() => navigator.clipboard.readText())

  expect(text).toContain('### [a1b2c3] Login roto')
  expect(text).toContain('## HOW TO USE THIS CONTEXT')
})

test('pasting a screenshot while editing adds it to the note', async ({ page }) => {
  await openProject(page, workspaceWith([note('a')]))
  await noteCard(page, 'A').click()

  await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 4
    canvas.height = 4
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((value) => resolve(value!), 'image/png'),
    )
    const data = new DataTransfer()
    data.items.add(new File([blob], 'shot.png', { type: 'image/png' }))
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }))
  })

  await expect(page.getByText(/imagen añadida/i)).toBeVisible()
  await waitForSaved(page)

  const images = (await readDisk(page)).notes[0].images as string[]

  expect(images).toHaveLength(1)
  expect(images[0]).toMatch(/^\.bruto\/images\/a-\d+-\w+\.png$/)
  await expect(page.locator('.note__thumbnail')).toHaveCount(1)
})

test('theme and language apply everywhere, dialogs included', async ({ page }) => {
  await openProject(page, threeNotes())

  await page.getByRole('combobox', { name: 'Idioma' }).selectOption('en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')

  await page.getByRole('button', { name: 'Help' }).click()
  const dialog = page.getByRole('dialog', { name: 'Shortcuts' })
  await expect(dialog).toBeVisible()

  const before = await dialog.evaluate((element) => getComputedStyle(element).backgroundColor)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /mode/i }).click()
  await page.getByRole('button', { name: 'Help' }).click()
  const after = await dialog.evaluate((element) => getComputedStyle(element).backgroundColor)

  expect(after).not.toBe(before)
})

test('the files window links a file to the selected note', async ({ page }) => {
  await openProject(page, threeNotes())
  await noteCard(page, 'ALPHA').click()

  await page.getByRole('button', { name: 'Ficheros', exact: true }).click()
  await page.getByPlaceholder('Buscar ficheros…').fill('app')
  await page.getByRole('button', { name: 'App.tsx' }).click()
  await page.getByRole('button', { name: /enlazar a/i }).click()
  await waitForSaved(page)

  expect((await readDisk(page)).notes[0].filePaths).toEqual(['src/App.tsx'])
})
