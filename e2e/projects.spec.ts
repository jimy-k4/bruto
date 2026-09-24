import { expect, test } from './fixtures'
import { note, noteCard, openProject, workspaceWith } from './helpers'

test('reopens a recent project from the landing page', async ({ page }) => {
  await openProject(page, workspaceWith([note('kept')]))
  await expect(noteCard(page, 'KEPT')).toBeVisible()

  await page.getByRole('button', { name: 'DEMO', exact: true }).click()
  await page.getByRole('button', { name: 'Cerrar DEMO' }).click()

  await expect(page.getByRole('heading', { name: 'Recientes' })).toBeVisible()
  await page.getByRole('button', { name: /^DEMO/ }).click()

  await expect(noteCard(page, 'KEPT')).toBeVisible()
})

test('switches between open projects with the menu and Alt+number', async ({ page }) => {
  await openProject(page, workspaceWith([note('first')]))

  // A second project folder, picked next.
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory()
    const other = await root.getDirectoryHandle('other', { create: true })
    const bruto = await other.getDirectoryHandle('.bruto', { create: true })
    const file = await (
      await bruto.getFileHandle('workspace.json', { create: true })
    ).createWritable()

    await file.write(
      JSON.stringify({
        notes: [{ id: 'second', title: 'SECOND', x: 100, y: 100 }],
        connections: [],
      }),
    )
    await file.close()
    Object.assign(window, { showDirectoryPicker: async () => other })
  })

  await page.getByRole('button', { name: 'DEMO', exact: true }).click()
  await page.getByRole('button', { name: '+ Abrir proyecto' }).click()
  await expect(noteCard(page, 'SECOND')).toBeVisible()

  await page.keyboard.press('Alt+1')
  await expect(noteCard(page, 'FIRST')).toBeVisible()

  await page.keyboard.press('Alt+2')
  await expect(noteCard(page, 'SECOND')).toBeVisible()
})

test('the AI context window previews exactly what gets copied', async ({ page }) => {
  await openProject(page, workspaceWith([note('abc123-x', { title: 'Login', status: 'todo' })]))

  await page.keyboard.press('a')
  const dialog = page.getByRole('dialog')

  await dialog.getByLabel('Contexto global').fill('Stack: Vite')
  await expect(dialog.locator('.ai-dialog__output')).toContainText('## GLOBAL AI CONTEXT')
  await expect(dialog.locator('.ai-dialog__output')).toContainText('Stack: Vite')

  await dialog.getByRole('button', { name: 'Copiar', exact: true }).click()
  const text = await page.evaluate(() => navigator.clipboard.readText())

  expect(text).toContain('Stack: Vite')
  expect(text).toContain('### [abc123] Login')

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})
