import { defineConfig } from '@playwright/test'
import base from './playwright.config'

/** `npm run video`: the launch video, driven over the example project. */
export default defineConfig({
  ...base,
  testDir: 'scripts',
  testMatch: 'video.spec.ts',
  retries: 0,
})
