/**
 * Writes the landing page, as the app draws it in English, into dist/index.html,
 * so search engines and AI assistants that don't run JavaScript still read what
 * Bruto is. Visitors never see this copy: index.html hides it as soon as a script
 * runs, and the app draws its own landing page in their language.
 *
 * Run after `vite build`, with the same BASE_PATH, in Chrome: `npm run prerender`.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { preview } from 'vite'

const INDEX = 'dist/index.html'
const ROOT = '<div id="root"></div>'

const server = await preview({ preview: { port: 4174, strictPort: true, open: false } })
const browser = await chromium.launch({ channel: 'chrome' })

try {
  const page = await browser.newPage({ locale: 'en-US', colorScheme: 'dark' })

  await page.goto(server.resolvedUrls!.local[0])

  const landing = await page.evaluate(
    () =>
      document.querySelector('.landing')!.outerHTML +
      document.querySelector('.statusbar')!.outerHTML,
  )
  const html = readFileSync(INDEX, 'utf8')

  if (!html.includes(ROOT)) throw new Error(`${INDEX} has no empty ${ROOT}`)

  writeFileSync(
    INDEX,
    html.replace(ROOT, `<div id="root"><div class="prerendered">${landing}</div></div>`),
  )
  console.log(`Landing page written into ${INDEX} (${Math.round(landing.length / 1024)} kB)`)
} finally {
  await browser.close()
  await new Promise((resolve) => server.httpServer.close(resolve))
}
