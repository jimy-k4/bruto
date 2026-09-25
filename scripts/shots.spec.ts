/**
 * Screenshots of the example project: the landing page's, in every language
 * (public/landing/<language>/), and the README's (docs/). Run with `npm run shots`.
 */
import { mkdirSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { LANGUAGES } from '../src/domain/constants'
import { expect, test } from '../e2e/fixtures'

const CANCEL_NOTE = 'b72f10aa-0000-4000-8000-000000000002'
const CALENDAR_NOTE = 'a11c9e20-0000-4000-8000-000000000001'

async function openExample(page: Page, language: string, theme: 'dark' | 'light') {
  await page.addInitScript(
    ([language, theme]) => {
      localStorage.setItem('bruto-language', language)
      localStorage.setItem('bruto-theme', theme)
    },
    [language, theme],
  )
  await page.goto('/')
  // The example is the last of the landing page's two big buttons.
  await page.locator('.landing__hero .landing__actions button').last().click()
  await expect(page.locator('.save-status')).toBeVisible()
  await page.waitForTimeout(600)
}

const note = (page: Page, id: string) => page.locator(`.note[data-note-id="${id}"]`)

const shots = {
  /** The board with one note open in the editor. */
  async board(page: Page) {
    await note(page, CANCEL_NOTE).click()
    await page.mouse.move(1180, 880)
  },
  /** The AI context window for one selected note. */
  async aiContext(page: Page) {
    await note(page, CANCEL_NOTE).click()
    await page.keyboard.press('Escape')
    await note(page, CANCEL_NOTE).focus()
    await page.keyboard.press('a')
  },
  /** The web lens, with the checkout screen picked. */
  async lenses(page: Page) {
    await page.keyboard.press('m')
    await page.locator('.structure__lens').nth(1).click()
    await page.locator('.lens-screen', { hasText: '/checkout' }).click()
    await page.mouse.move(10, 890)
  },
  /** The file map, with the calendar note's files standing out. */
  async structure(page: Page) {
    await note(page, CALENDAR_NOTE).click()
    await page.keyboard.press('Escape')
    await page.keyboard.press('m')
    await page.locator('.structure-block', { hasText: /^DIR\s*app/i }).click()
  },
  /** Search with a content filter on. */
  async search(page: Page) {
    // An empty spot of the board, so no note is selected.
    await page.mouse.click(1300, 820)
    await page.keyboard.press('Control+f')
    await page.getByRole('searchbox').fill('booking')
    await page.locator('.board-search__trait').first().click()
    await page.getByRole('searchbox').focus()
    await page.keyboard.press('Enter')
  },
}

const LANDING: [keyof typeof shots, 'dark' | 'light', string][] = [
  ['board', 'dark', 'board'],
  ['aiContext', 'light', 'ai-context'],
  ['lenses', 'dark', 'lenses'],
]

const README: [keyof typeof shots, 'dark' | 'light', string][] = [
  ['board', 'dark', 'board-dark'],
  ['aiContext', 'light', 'ai-context-light'],
  ['lenses', 'light', 'lens-web-light'],
  ['structure', 'dark', 'structure-dark'],
  ['search', 'dark', 'search-dark'],
]

for (const { value: language } of LANGUAGES) {
  for (const [shot, theme, name] of LANDING) {
    test(`landing ${language} ${name}`, async ({ page }) => {
      await openExample(page, language, theme)
      await shots[shot](page)
      await page.waitForTimeout(500)
      mkdirSync(`public/landing/${language}`, { recursive: true })
      await page.screenshot({
        path: `public/landing/${language}/${name}.jpg`,
        type: 'jpeg',
        quality: 78,
      })
    })
  }
}

// The card a shared link shows (og:image in index.html): the landing page, 1200×630.
test('social preview', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('bruto-language', 'en')
    localStorage.setItem('bruto-theme', 'dark')
  })
  await page.setViewportSize({ width: 1200, height: 630 })
  await page.goto('/')
  await expect(page.locator('.landing__shot img').first()).toHaveJSProperty('complete', true)
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'public/og.png' })
})

for (const [shot, theme, name] of README) {
  test(`readme ${name}`, async ({ page }) => {
    await openExample(page, 'en', theme)
    await shots[shot](page)
    await page.waitForTimeout(500)
    await page.screenshot({ path: `docs/${name}.png` })
  })
}
