import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { note, noteCard, openProject, workspaceWith } from './helpers'

/** How a note is drawn: its border and its shadow. */
const noteLines = (page: Page) =>
  noteCard(page, 'ANCLA').evaluate((card) => {
    const style = getComputedStyle(card)

    return { border: style.borderTopWidth, shadow: style.boxShadow }
  })

test('soft mode thins the lines and shadows over either theme, and is remembered', async ({
  page,
}) => {
  await openProject(page, workspaceWith([note('anchor', { title: 'ANCLA' })]))

  const soft = page.getByRole('button', { name: 'Modo suave' })
  const theme = page.getByRole('button', { name: /^Modo (claro|oscuro)$/ })
  const bold = await noteLines(page)

  // Bold is the default: heavy borders and a solid shadow.
  await expect(soft).toHaveAttribute('aria-pressed', 'false')
  expect(bold.border).toBe('3px')
  expect(bold.shadow).toMatch(/ 6px 6px 0px 0px$/)

  await soft.click()
  await expect(soft).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-look', 'soft')
  // Shadows ease into place: wait for where they settle.
  await expect
    .poll(() => noteLines(page))
    .toEqual({
      border: '1px',
      shadow: expect.stringMatching(/ 2\.04px 2\.04px 8px 0px$/),
    })

  // Over the other theme too.
  await theme.click()
  await expect.poll(async () => (await noteLines(page)).border).toBe('1px')

  // Back to exactly what it was.
  await theme.click()
  await soft.click()
  await expect.poll(() => noteLines(page)).toEqual(bold)

  // Remembered from the first paint after a reload.
  await soft.click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-look', 'soft')
  await expect(page.getByRole('button', { name: 'Modo suave' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('a link with ?look=soft opens in the soft look and leaves the address clean', async ({
  page,
}) => {
  await page.goto('/?demo&look=soft')

  await expect(page.locator('.save-status')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-look', 'soft')
  await expect(page.getByRole('button', { name: 'Modo suave' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(new URL(page.url()).search).toBe('')
  expect(
    await page
      .locator('.note')
      .first()
      .evaluate((card) => getComputedStyle(card).borderTopWidth),
  ).toBe('1px')
})
