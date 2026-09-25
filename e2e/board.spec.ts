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

test('Q, W and E copy for the AI and say what they copied', async ({ page }) => {
  await openProject(
    page,
    workspaceWith(
      [
        note('a1b2c3-x', { title: 'Login roto', status: 'todo' }),
        note('b', { title: 'Sesión', x: 480 }),
        note('c', { title: 'Suelta', x: 880 }),
      ],
      { connections: [{ id: 'c1', from: 'a1b2c3-x', to: 'b' }] },
    ),
  )

  await noteCard(page, 'Login roto').click()
  await page.locator('.board').click({ position: { x: 300, y: 650 } })
  await noteCard(page, 'Login roto').focus()
  await page.keyboard.press('q')
  await expect(page.getByText(/copiada para tu IA la nota «Login roto»/i)).toBeVisible()

  const text = await page.evaluate(() => navigator.clipboard.readText())

  expect(text).toContain('### [a1b2c3] Login roto')
  expect(text).toContain('## HOW TO USE THIS CONTEXT')

  await page.keyboard.press('w')
  await expect(page.getByText(/copiadas para tu IA 2 notas: la selección y/i)).toBeVisible()

  await page.keyboard.press('e')
  await expect(page.getByText(/todo el proyecto: 3 notas/i)).toBeVisible()
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

test('writing feedback suggests sending the note back to the AI', async ({ page }) => {
  await openProject(page, workspaceWith([note('a', { status: 'review' })]))
  await noteCard(page, 'A').click()

  await page.getByLabel('Qué falla').fill('Sigue fallando en móvil')
  await page.getByRole('button', { name: 'Marcar como «A corregir»' }).click()
  await waitForSaved(page)

  expect((await readDisk(page)).notes[0]).toMatchObject({
    status: 'changes-requested',
    feedback: 'Sigue fallando en móvil',
  })
  await expect(page.getByRole('button', { name: /marcar como/i })).toHaveCount(0)
})

test('search: highlight matches, walk them with Enter, keep the last one selected', async ({
  page,
}) => {
  await openProject(
    page,
    workspaceWith([
      note('alpha', { x: 80, y: 80, description: 'Revisión del login', status: 'todo' }),
      note('beta', { x: 480, y: 80, status: 'review' }),
      note('gamma', { x: 880, y: 400, filePaths: ['src/login.ts'], status: 'review' }),
    ]),
  )

  await page.locator('.board').click({ position: { x: 700, y: 700 } })
  await page.keyboard.press('Control+f')
  await expect(page.getByRole('searchbox')).toBeFocused()

  await page.getByRole('searchbox').fill('LOGIN')
  await expect(noteCard(page, 'ALPHA')).toHaveClass(/is-match/)
  await expect(noteCard(page, 'GAMMA')).toHaveClass(/is-match/)
  await expect(noteCard(page, 'BETA')).toHaveClass(/is-dimmed/)
  await expect(page.locator('.board-search__count')).toContainText('–/2')

  await page.keyboard.press('Enter')
  await expect(noteCard(page, 'ALPHA')).toHaveClass(/is-selected/)
  await page.keyboard.press('Enter')
  await expect(noteCard(page, 'GAMMA')).toHaveClass(/is-selected/)
  await expect(page.locator('.board-search__count')).toContainText('2/2')

  // Status filter narrows the matches.
  await page.getByRole('searchbox').fill('')
  await page.getByRole('group', { name: 'Filtrar por estado' }).getByText('Por revisar').click()
  await expect(page.locator('.board-search__count')).toContainText('2/2')

  // Content filters cycle with → without → any.
  const content = page.getByRole('group', { name: 'Filtrar por contenido' })
  await content.getByRole('button', { name: 'Ficheros' }).click()
  await expect(content.getByRole('button', { name: 'Con ficheros' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(noteCard(page, 'GAMMA')).toHaveClass(/is-match/)
  await expect(noteCard(page, 'BETA')).toHaveClass(/is-dimmed/)
  await content.getByRole('button', { name: 'Con ficheros' }).click()
  await expect(noteCard(page, 'BETA')).toHaveClass(/is-match/)
  await expect(noteCard(page, 'GAMMA')).toHaveClass(/is-dimmed/)
  await content.getByRole('button', { name: 'Sin ficheros' }).click()
  await expect(content.getByRole('button', { name: 'Ficheros' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )

  await page.getByRole('searchbox').focus()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('search')).toHaveCount(0)
  await expect(noteCard(page, 'GAMMA')).toHaveClass(/is-selected/)
  await expect(noteCard(page, 'GAMMA')).toBeFocused()
  await expect(noteCard(page, 'BETA')).not.toHaveClass(/is-dimmed/)
})

test('search finds a note by the short id used with the AI', async ({ page }) => {
  await openProject(
    page,
    workspaceWith([
      note('894c20ab-alpha', { title: 'ALPHA' }),
      note('07cc95cd-beta', { title: 'BETA', x: 500 }),
    ]),
  )

  await page.locator('.board').click({ position: { x: 700, y: 700 } })
  await page.keyboard.press('/')
  await page.getByRole('searchbox').fill('[07cc95]')
  await page.keyboard.press('Enter')

  await expect(noteCard(page, 'BETA')).toHaveClass(/is-selected/)
  await expect(noteCard(page, 'ALPHA')).toHaveClass(/is-dimmed/)
})

test('structure view: find where notes point, jump to a note, spot broken paths', async ({
  page,
}) => {
  await openProject(
    page,
    workspaceWith([
      note('alpha', { x: 80, y: 80, status: 'todo', filePaths: ['src/App.tsx'] }),
      note('beta', { x: 480, y: 80, aiFilePaths: ['src\\main.ts'] }),
      note('gamma', { x: 880, y: 80, filePaths: ['src/Old.tsx'] }),
    ]),
  )

  await page.locator('.board').click({ position: { x: 700, y: 700 } })
  await page.keyboard.press('m')

  const map = page.getByRole('group', { name: 'Mapa de ficheros' })
  await expect(map.getByRole('button', { name: /^src, 2 ficheros, 2 notas/ })).toBeVisible()

  // Board shortcuts are off while the board is hidden.
  await page.keyboard.press('n')
  await expect(page.locator('.note')).toHaveCount(3)

  await map.getByRole('button', { name: /^src,/ }).click()

  // Files the AI wrote down are placed too, and marked as the AI's.
  await map.getByRole('button', { name: /^main\.ts/ }).click()
  const aiPath = page.getByRole('complementary').getByRole('button', { name: /BETA/ })
  await expect(aiPath.locator('.ai-tag')).toBeVisible()

  await map.getByRole('button', { name: /^App\.tsx/ }).click()

  const side = page.getByRole('complementary', { name: 'Notas de la estructura' })
  await expect(side.getByText('src/App.tsx', { exact: true }).first()).toBeVisible()
  await expect(side.getByRole('button', { name: /ALPHA/ })).toBeVisible()
  await expect(side.getByRole('button', { name: /BETA/ })).toHaveCount(0)

  await expect(side.getByText('No encontrados (1)')).toBeVisible()
  await expect(side.getByRole('button', { name: /GAMMA/ })).toContainText('src/Old.tsx')

  await side.getByRole('button', { name: /ALPHA/ }).click()
  await expect(page.getByRole('region', { name: 'Estructura' })).toHaveCount(0)
  await expect(noteCard(page, 'ALPHA')).toHaveClass(/is-selected/)
})

test('structure view: Esc goes back to the board', async ({ page }) => {
  await openProject(page, workspaceWith([note('alpha')]))

  await page.getByRole('button', { name: 'Estructura' }).click()
  await expect(page.getByRole('region', { name: 'Estructura' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('region', { name: 'Estructura' })).toHaveCount(0)
})

test('the support link is always one click away from the board', async ({ page }) => {
  await openProject(page, workspaceWith([]))

  const support = page.getByRole('banner').getByRole('link', { name: 'Apoya el proyecto' })

  await expect(support).toHaveAttribute('href', 'https://ko-fi.com/jimy_k4')
  await expect(support).toHaveAttribute('target', '_blank')
})

test('status styles can be copied from another project', async ({ page }) => {
  await openProject(page, workspaceWith([note('alpha', { status: 'done' })]))

  // Another folder with its own board and styles, picked with the folder dialog.
  await page.evaluate(
    async (workspace) => {
      const root = await navigator.storage.getDirectory()
      const other = await root.getDirectoryHandle('other', { create: true })
      const bruto = await other.getDirectoryHandle('.bruto', { create: true })
      const file = await (
        await bruto.getFileHandle('workspace.json', { create: true })
      ).createWritable()

      await file.write(JSON.stringify(workspace))
      await file.close()
      Object.assign(window, { showDirectoryPicker: async () => other })
    },
    workspaceWith([], { statusStyles: { done: { color: 'moss', pattern: 'bands' } } }),
  )

  await page.getByRole('button', { name: 'Estilos', exact: true }).click()
  await page.getByRole('button', { name: 'Otra carpeta…' }).click()

  await expect(page.getByText('Estilos copiados de other.')).toBeVisible()
  await expect(noteCard(page, 'ALPHA')).toHaveClass(/note-color-moss/)
  await waitForSaved(page)
  expect((await readDisk(page)).statusStyles).toEqual({ done: { color: 'moss', pattern: 'bands' } })
})

test('code in an AI answer shows in a box with a copy button', async ({ page }) => {
  const command = 'git -C D:/jllinares/Personal/portfolio push origin content/textos:main'

  await openProject(
    page,
    workspaceWith([
      note('push', {
        title: 'Publicar textos',
        aiResponse: `Listo. Para subirlo:\n\n\`\`\`bash\n${command}\n\`\`\`\n\nY revisa \`content/textos\`.`,
      }),
    ]),
  )

  const card = noteCard(page, 'Publicar textos')

  await card.getByRole('button', { name: /respuesta de la ia/i }).click()
  await expect(card.locator('.code-block')).toContainText(command)
  await expect(card.locator('.rich-text p code')).toHaveText('content/textos')

  await card.getByRole('button', { name: 'Copiar código' }).click()
  await expect(card.getByRole('button', { name: 'Copiado' })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(command)

  // The editor lists the same code under the answer, ready to copy.
  await card.dblclick({ position: { x: 20, y: 60 } })
  await expect(
    page.getByRole('group', { name: 'Código de la respuesta' }).locator('.code-block'),
  ).toContainText(command)
})

test('search filters notes that contain code', async ({ page }) => {
  await openProject(
    page,
    workspaceWith([
      note('alpha', { x: 80, y: 80, description: 'Run it:\n```bash\nnpm test\n```' }),
      note('beta', { x: 480, y: 80, aiResponse: 'Renamed `useCart`.' }),
      note('gamma', { x: 880, y: 80, description: 'Only words.' }),
    ]),
  )

  await page.locator('.board').click({ position: { x: 700, y: 700 } })
  await page.keyboard.press('Control+f')

  const code = page.getByRole('button', { name: 'Código', exact: true })
  await code.click()
  await expect(page.getByRole('button', { name: 'Con código', exact: true })).toBeVisible()
  await expect(noteCard(page, 'ALPHA')).toHaveClass(/is-match/)
  await expect(noteCard(page, 'BETA')).toHaveClass(/is-match/)
  await expect(noteCard(page, 'GAMMA')).toHaveClass(/is-dimmed/)

  await page.getByRole('button', { name: 'Con código', exact: true }).click()
  await expect(noteCard(page, 'GAMMA')).toHaveClass(/is-match/)
  await expect(noteCard(page, 'ALPHA')).toHaveClass(/is-dimmed/)
})
