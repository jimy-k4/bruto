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
 * Anonymous visit counter (GoatCounter: no cookies, no personal data) for the
 * published site. Only production builds carry it, and it ignores localhost,
 * so development and tests never count. Notes never leave the browser.
 */
const GOATCOUNTER = 'https://jimy-k4.goatcounter.com/count'

const visitCounter = (): Plugin => ({
  name: 'bruto-visit-counter',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'script',
      attrs: { 'data-goatcounter': GOATCOUNTER, async: true, src: 'https://gc.zgo.at/count.js' },
      injectTo: 'body',
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
