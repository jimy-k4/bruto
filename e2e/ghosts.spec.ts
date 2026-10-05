import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { noteCard, waitForSaved } from './helpers'

const note = (id: string, title: string, x: number, extra: Record<string, unknown> = {}) => ({
  id,
  title,
  x,
  y: 300,
  status: 'todo',
  ...extra,
})
const arrow = (from: string, to: string) => ({ id: `${from}>${to}`, from, to })
const link = (kind: string, project: string, noteId: string) => ({ kind, project, noteId })

// Front: A → B → C (C blocks D); API: D → E → F → G (G blocks H); database: H → I → J.
const BOARDS = {
  front: {
    title: 'FRONT',
    notes: [
      note('front-a', 'A', 0),
      note('front-b', 'B', 380),
      note('front-c', 'C', 760, { crossLinks: [link('blocks', 'api', 'api-d')] }),
    ],
    connections: [arrow('front-a', 'front-b'), arrow('front-b', 'front-c')],
  },
  api: {
    title: 'API',
    notes: [
      note('api-d', 'D', 0, { crossLinks: [link('blocked-by', 'front', 'front-c')] }),
      note('api-e', 'E', 380),
      note('api-f', 'F', 760),
      note('api-g', 'G', 1140, { crossLinks: [link('blocks', 'db', 'db-h')] }),
    ],
    connections: [arrow('api-d', 'api-e'), arrow('api-e', 'api-f'), arrow('api-f', 'api-g')],
  },
  db: {
    title: 'DB',
    notes: [
      note('db-h', 'H', 0, { crossLinks: [link('blocked-by', 'api', 'api-g')] }),
      note('db-i', 'I', 380),
      note('db-j', 'J', 760),
    ],
    connections: [arrow('db-h', 'db-i'), arrow('db-i', 'db-j')],
  },
}

/** Writes the three boards and opens them in order, so all are recent and the database is in front. */
async function openThree(page: Page) {
  await page.goto('/')
  await page.evaluate(async (boards) => {
    const root = await navigator.storage.getDirectory()

    for await (const name of (root as unknown as { keys(): AsyncIterable<string> }).keys()) {
      await root.removeEntry(name, { recursive: true })
    }

    for (const [name, workspace] of Object.entries(boards)) {
      const folder = await root.getDirectoryHandle(name, { create: true })
      const bruto = await folder.getDirectoryHandle('.bruto', { create: true })
      const file = await (
        await bruto.getFileHandle('workspace.json', { create: true })
      ).createWritable()

      await file.write(JSON.stringify({ version: 4, ...workspace }))
      await file.close()
    }
  }, BOARDS)

  for (const [index, name] of ['front', 'api', 'db'].entries()) {
    await page.evaluate(async (name) => {
      const folder = await (await navigator.storage.getDirectory()).getDirectoryHandle(name)

      Object.assign(window, { showDirectoryPicker: async () => folder })
    }, name)

    if (index === 0) {
      await page
        .getByRole('button', { name: /abrir carpeta de proyecto/i })
        .first()
        .click()
    } else {
      await page.locator('.project-switcher__trigger').click()
      await page.getByRole('button', { name: '+ Abrir proyecto' }).click()
    }

    await expect(page.locator('.project-switcher__trigger')).toContainText(name.toUpperCase())
  }
}

/** A project's board on disk. A read that lands while Bruto swaps the file in is tried again. */
const readBoard = (page: Page, name: string) =>
  page.evaluate(async (name) => {
    const folder = await (await navigator.storage.getDirectory()).getDirectoryHandle(name)
    const bruto = await folder.getDirectoryHandle('.bruto')

    for (let attempt = 0; ; attempt++) {
      try {
        const file = await (await bruto.getFileHandle('workspace.json')).getFile()

        return JSON.parse(await file.text())
      } catch (error) {
        if (attempt === 5) throw error
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }
  }, name)

/** Zooms out from the right edge, so zones placed left of the notes come into view. */
async function zoomOut(page: Page) {
  for (let step = 0; step < 10; step++) {
    await page.mouse.move(1380, 420)
    await page.mouse.wheel(0, 100)
  }
}

const ghost = (page: Page, id: string) => page.locator(`[data-ghost-id="${id}"]`)

test('linked projects show as ghost zones down the chain, for people and for the AI', async ({
  page,
}) => {
  await openThree(page)

  // The database sees the API's chain and, through it, the front's.
  await expect(page.locator('.ghost-zone__name')).toHaveText([
    /Fantasma · api/i,
    /Fantasma · front/i,
  ])
  await expect(page.locator('.ghost-zone__via')).toHaveText(/vía api/i)
  await expect(page.locator('.note--ghost')).toHaveCount(7)
  await expect(noteCard(page, 'H')).toContainText('Bloqueada')

  // A zone moves as a whole, and stays where it was put. Zoomed out, everything is in view.
  await zoomOut(page)
  await expect(page.locator('.zoom-controls')).toContainText('39%')
  const before = (await ghost(page, 'api-e').boundingBox())!
  await expect.poll(async () => (await readBoard(page, 'db')).ghosts?.length).toBe(2)
  const offset = (await readBoard(page, 'db')).ghosts[0].offset

  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2)
  await page.mouse.down()
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2 + 39, {
    steps: 6,
  })
  await page.mouse.up()
  await expect
    .poll(async () => {
      const moved = (await readBoard(page, 'db')).ghosts[0].offset

      return moved.x === offset.x && Math.abs(moved.y - offset.y - 100) <= 2
    })
    .toBe(true)

  // The AI reads them too, read only, and where they come from.
  await page.keyboard.press('a')
  const output = page.getByRole('dialog').locator('.ai-dialog__output')

  await expect(output).toContainText('## GHOST ZONES')
  await expect(output).toContainText('### From project "front" (through project "api"')
  await expect(output).toContainText('in "api" blocks [db-h] H here')
  await page.keyboard.press('Escape')

  // In the API, an arrow from the front's C to E links them on both boards.
  await page.keyboard.press('Alt+2')
  await expect(ghost(page, 'front-c')).toBeVisible()
  await zoomOut(page)
  await ghost(page, 'front-c').click({ button: 'middle' })
  await noteCard(page, 'E').click()
  await expect(page.getByText('Vinculada con FRONT')).toBeVisible()
  await expect
    .poll(async () => (await readBoard(page, 'api')).notes[1].crossLinks)
    .toEqual([expect.objectContaining({ kind: 'blocked-by', project: 'front', noteId: 'front-c' })])
  expect((await readBoard(page, 'front')).notes[2].crossLinks).toContainEqual(
    expect.objectContaining({ kind: 'blocks', project: 'api', noteId: 'api-e' }),
  )

  // Renaming C in the front reaches the API's ghost of it on its own.
  await page.keyboard.press('Alt+1')
  await noteCard(page, 'C').click()
  await page.getByLabel('Título', { exact: true }).fill('C RENAMED')
  await waitForSaved(page)
  await expect
    .poll(
      async () =>
        (await readBoard(page, 'api')).ghosts[0].notes.find(
          (item: { id: string }) => item.id === 'front-c',
        )?.title,
      { timeout: 10_000 },
    )
    .toBe('C RENAMED')

  // From a zone, the original is one click away.
  await page.keyboard.press('Escape')
  await page.keyboard.press('Alt+2')
  await ghost(page, 'front-a').hover()
  await page.getByRole('button', { name: /Abrir front/i }).click()
  await expect(page.locator('.project-switcher__trigger')).toContainText('FRONT')
})
