import { defineConfig } from '@playwright/test'
import base from './playwright.config'

/** `npm run shots`: the screenshots of the landing page and the README. */
export default defineConfig({
  ...base,
  testDir: 'scripts',
  testMatch: 'shots.spec.ts',
  use: { ...base.use, viewport: { width: 1440, height: 900 } },
})
