import { expect, test } from './fixtures'
import { openProject, workspaceWith } from './helpers'

test('the noticeboard shows what is new and remembers what was read', async ({ page }) => {
  await openProject(page, workspaceWith([]))

  const button = page.getByRole('button', { name: /^Novedades, \d+ novedades sin leer$/ })
  await expect(button).toBeVisible()
  await button.click()

  const dialog = page.getByRole('dialog', { name: 'Lo nuevo en Bruto' })
  await expect(
    dialog.getByRole('heading', { name: 'Cada proyecto recuerda su vista' }),
  ).toBeVisible()
  await expect(dialog.locator('.news-item.is-unread').first()).toContainText('Nuevo')
  // Bodies are Markdown, like notes.
  await expect(dialog.locator('.news-item__body strong').first()).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Novedades', exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('button', { name: 'Novedades', exact: true })).toBeVisible()
})
