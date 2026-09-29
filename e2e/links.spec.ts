import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { note, noteCard, openProject, waitForSaved, workspaceWith } from './helpers'

/** A second project folder, `cms`, opened once so it is among the recent projects. */
async function openCmsOnce(page: Page) {
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory()
    const cms = await root.getDirectoryHandle('cms', { create: true })
    const bruto = await cms.getDirectoryHandle('.bruto', { create: true })
    const file = await (
      await bruto.getFileHandle('workspace.json', { create: true })
    ).createWritable()

    await file.write(
      JSON.stringify({
        notes: [
          { id: 'api-login-0001', title: 'LOGIN API', status: 'in-progress', x: 900, y: 500 },
          { id: 'api-other-0002', title: 'OTRA', x: 80, y: 80 },
        ],
      }),
    )
    await file.close()
    Object.assign(window, { showDirectoryPicker: async () => cms })
  })

  await page.getByRole('button', { name: 'DEMO', exact: true }).click()
  await page.getByRole('button', { name: '+ Abrir proyecto' }).click()
  await expect(noteCard(page, 'LOGIN API')).toBeVisible()
  await page.keyboard.press('Alt+1')
  await expect(noteCard(page, 'PANTALLA LOGIN')).toBeVisible()
}

/** The CMS board on disk. A read that lands while Bruto swaps the file in is tried again. */
const readCms = (page: Page) =>
  page.evaluate(async () => {
    const root = await navigator.storage.getDirectory()
    const bruto = await (await root.getDirectoryHandle('cms')).getDirectoryHandle('.bruto')

    for (let attempt = 0; ; attempt++) {
      try {
        const file = await (await bruto.getFileHandle('workspace.json')).getFile()

        return JSON.parse(await file.text()) as { notes: Record<string, unknown>[] }
      } catch (error) {
        if (attempt === 5) throw error
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }
  })

test('a note is linked to one in another project, both show it and follow it', async ({ page }) => {
  await openProject(page, workspaceWith([note('screen-0001', { title: 'PANTALLA LOGIN' })]))
  await openCmsOnce(page)

  // Link: this screen is blocked by the API in the CMS.
  await noteCard(page, 'PANTALLA LOGIN').click()
  await page.getByRole('button', { name: '+ Vincular con otro proyecto' }).click()

  const dialog = page.getByRole('dialog', { name: 'Vincular con otro proyecto' })
  await dialog.getByRole('radio', { name: 'Bloqueada por' }).check()
  await dialog.getByLabel('Proyecto').selectOption({ label: 'CMS' })
  await dialog.getByPlaceholder('Buscar nota…').fill('login')
  await expect(dialog.getByText('OTRA')).toBeHidden()
  await dialog.getByText('LOGIN API').click()
  await dialog.getByRole('button', { name: 'Vincular', exact: true }).click()
  await expect(page.getByText('Vinculada con CMS.')).toBeVisible()

  // Here: taped as blocked, with the link on the card.
  const screen = noteCard(page, 'PANTALLA LOGIN')
  await expect(screen).toHaveClass(/is-blocked/)
  await expect(screen.locator('.note__tape')).toHaveText('Bloqueada')
  await expect(screen.locator('.note__cross-link')).toContainText('CMS · LOGIN API · En curso')
  await waitForSaved(page)

  // There: the other side of the link was written too.
  expect((await readCms(page)).notes[0].crossLinks).toEqual([
    expect.objectContaining({ kind: 'blocks', project: 'demo', noteId: 'screen-0001' }),
  ])

  // Following the link opens the CMS with the API note selected, taped as blocking.
  await page.keyboard.press('Escape')
  await screen.locator('.note__cross-link').click()
  const api = noteCard(page, 'LOGIN API')
  await expect(api).toHaveClass(/is-selected/)
  await expect(api).toHaveClass(/is-blocking/)
  await expect(api).toBeInViewport()

  // Done there: back here the screen is no longer blocked.
  await api.click()
  await page.getByLabel('Estado').selectOption({ label: 'Hecha' })
  await expect(api).not.toHaveClass(/is-blocking/)
  await expect
    .poll(async () => (await readCms(page)).notes[0].status, { timeout: 5000 })
    .toBe('done')

  await page.keyboard.press('Alt+1')
  await expect(noteCard(page, 'PANTALLA LOGIN')).not.toHaveClass(/is-blocked/)
  await expect(noteCard(page, 'PANTALLA LOGIN').locator('.note__cross-link')).toContainText('Hecha')
})

test('removing a link removes it on both sides', async ({ page }) => {
  await openProject(page, workspaceWith([note('screen-0001', { title: 'PANTALLA LOGIN' })]))
  await openCmsOnce(page)

  await noteCard(page, 'PANTALLA LOGIN').click()
  await page.getByRole('button', { name: '+ Vincular con otro proyecto' }).click()
  const dialog = page.getByRole('dialog', { name: 'Vincular con otro proyecto' })
  await dialog.getByLabel('Proyecto').selectOption({ label: 'CMS' })
  await dialog.getByText('OTRA').click()
  await dialog.getByRole('button', { name: 'Vincular', exact: true }).click()

  // "Bloquea a" is the default: this note now holds the other up.
  await expect(noteCard(page, 'PANTALLA LOGIN')).toHaveClass(/is-blocking/)

  await page.getByRole('button', { name: 'Quitar OTRA' }).click()
  await expect(noteCard(page, 'PANTALLA LOGIN')).not.toHaveClass(/is-blocking/)
  await expect.poll(async () => (await readCms(page)).notes[1].crossLinks).toBeUndefined()
})
