/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Tells builds apart: the commit on GitHub Actions, the build time elsewhere.
const buildId = process.env.GITHUB_SHA?.slice(0, 12) ?? Date.now().toString(36)

/** Writes `version.json`, which an open app polls to find out a newer version is published. */
const versionFile = (): Plugin => ({
  name: 'bruto-version-file',
  apply: 'build',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ build: buildId }),
    })
  },
})

/**
 * Anonymous visits and usage events (Superveil: no cookies, no personal data)
 * for the published site only: production builds carry the script, it skips
 * localhost and automated browsers, and Superveil drops hits from any domain
 * but jimy-k4.github.io, so development, previews and tests never count.
 * Notes and projects never leave the browser.
 */
const visitCounter = (): Plugin => ({
  name: 'bruto-visit-counter',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'script',
      attrs: {
        defer: true,
        src: 'https://jimy-superveil.vercel.app/p.js',
        'data-site': 'bruto',
      },
      injectTo: 'head',
    },
  ],
})

// GitHub Pages serves the app from /<repository>/; locally it lives at /.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), versionFile(), visitCounter()],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  test: {
    // Browser tests in e2e/ run with Playwright, not here.
    include: ['src/**/*.test.ts'],
  },
})
