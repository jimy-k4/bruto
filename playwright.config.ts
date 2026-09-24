import { defineConfig } from '@playwright/test'

const port = 5288

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  timeout: 30_000,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    // Uses the Chrome already installed: the File System Access API is Chromium-only.
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
    locale: 'es-ES',
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  webServer: {
    command: `npx vite --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
  },
})
