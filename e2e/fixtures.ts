import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Chrome crashes when it reads folder handles back from IndexedDB inside the
 * throwaway (off-the-record) contexts Playwright creates by default. Real
 * users run a normal profile, so tests do too: one temporary profile per test.
 */
export const test = base.extend<{ context: BrowserContext; page: Page }>({
  context: async ({ baseURL, locale, viewport, permissions }, use) => {
    const profile = mkdtempSync(join(tmpdir(), 'bruto-e2e-'))
    const context = await chromium.launchPersistentContext(profile, {
      channel: 'chrome',
      headless: true,
      baseURL,
      locale,
      viewport,
      permissions,
    })

    await use(context)
    await context.close()
    rmSync(profile, { recursive: true, force: true })
  },
  page: async ({ context }, use) => {
    await use(context.pages()[0] ?? (await context.newPage()))
  },
})

export { expect } from '@playwright/test'
