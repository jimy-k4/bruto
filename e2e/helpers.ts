import { expect, type Page } from '@playwright/test'

/**
 * The folder picker is a native dialog tests can't drive, so the project
 * folder lives in the browser's private file system (OPFS) instead: same API,
 * real reads and writes.
 */
export async function openProject(page: Page, workspace?: unknown, rawText?: string) {
  await page.goto('/')
  await page.evaluate(
    async ({ workspace, rawText }) => {
      const root = await navigator.storage.getDirectory()

      for await (const name of (root as unknown as { keys(): AsyncIterable<string> }).keys()) {
        await root.removeEntry(name, { recursive: true })
      }

      const project = await root.getDirectoryHandle('demo', { create: true })
      const src = await project.getDirectoryHandle('src', { create: true })

      for (const [name, text] of [
        ['App.tsx', 'export default function App() {}\n'],
        ['main.ts', 'import "./App"\n'],
      ]) {
        const file = await (await src.getFileHandle(name, { create: true })).createWritable()
        await file.write(text)
        await file.close()
      }

      if (workspace !== undefined || rawText !== undefined) {
        const bruto = await project.getDirectoryHandle('.bruto', { create: true })
        const file = await (
          await bruto.getFileHandle('workspace.json', { create: true })
        ).createWritable()
        await file.write(rawText ?? JSON.stringify(workspace, null, 2))
        await file.close()
      }

      const picker = async () => project
      Object.assign(window, { showDirectoryPicker: picker })
    },
    { workspace, rawText },
  )

  await page.getByRole('button', { name: /abrir carpeta de proyecto/i }).click()

  // Ready when the workspace (or the recovery screen) is on screen.
  await expect(page.locator('.save-status, .recovery')).toBeVisible()
}

/** Reads `.bruto/workspace.json` as another tool would. */
export async function readDisk(
  page: Page,
): Promise<{ notes: Record<string, unknown>[]; [key: string]: unknown }> {
  return page.evaluate(async () => {
    const root = await navigator.storage.getDirectory()
    const project = await root.getDirectoryHandle('demo')
    const bruto = await project.getDirectoryHandle('.bruto')
    const file = await (await bruto.getFileHandle('workspace.json')).getFile()

    return JSON.parse(await file.text())
  })
}

/** Writes `.bruto/workspace.json` as an AI editing the file would. */
export async function writeDisk(page: Page, text: string) {
  await page.evaluate(async (text) => {
    const root = await navigator.storage.getDirectory()
    const project = await root.getDirectoryHandle('demo')
    const bruto = await project.getDirectoryHandle('.bruto')
    const file = await (await bruto.getFileHandle('workspace.json')).createWritable()

    await file.write(text)
    await file.close()
  }, text)
}

export async function waitForSaved(page: Page) {
  await expect(page.locator('.save-status')).toHaveText(/guardado/i)
}

export const note = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: id.toUpperCase(),
  description: '',
  filePaths: [],
  webUrl: '',
  images: [],
  x: 100,
  y: 100,
  zIndex: 1,
  colorTheme: 'concrete',
  pattern: 'raw',
  ...extra,
})

export const workspaceWith = (notes: unknown[], extra: Record<string, unknown> = {}) => ({
  version: 3,
  title: 'DEMO',
  description: '',
  aiContext: '',
  documentation: [],
  notes,
  connections: [],
  ...extra,
})

export const noteCard = (page: Page, title: string) =>
  page.locator('.note', { has: page.getByRole('heading', { name: title, exact: true }) })
