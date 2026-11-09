import { expect, test, type Page } from '@playwright/test'
import { note, noteCard, openProject, readDisk, waitForSaved, workspaceWith } from './helpers'

/** Drags a card's right edge by that many screen pixels. */
async function dragEdge(page: Page, title: string, dx: number) {
  const card = noteCard(page, title)

  await card.hover()

  const box = (await card.locator('.note__resize').boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2

  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx / 2, y)
  await page.mouse.move(x + dx, y)
  await page.mouse.up()
}

const width = (page: Page, title: string) =>
  noteCard(page, title).evaluate((element) => (element as HTMLElement).offsetWidth)

const height = (page: Page, title: string) =>
  noteCard(page, title).evaluate((element) => (element as HTMLElement).offsetHeight)

const LONG_TEXT = 'Una descripción bastante larga para que tenga que partirse en varias líneas'

test('dragging the right edge narrows a note, which is saved and grows taller to fit', async ({
  page,
}) => {
  await openProject(page, workspaceWith([note('a', { title: 'ANCHA', description: LONG_TEXT })]))

  expect(await width(page, 'ANCHA')).toBe(280)
  const before = await height(page, 'ANCHA')

  await dragEdge(page, 'ANCHA', -60)

  await expect.poll(() => width(page, 'ANCHA')).toBe(220)
  expect(await height(page, 'ANCHA')).toBeGreaterThan(before)

  await waitForSaved(page)
  expect((await readDisk(page)).notes[0].width).toBe(220)

  // One step back, and the note is as it was.
  await page.keyboard.press('Control+z')
  await expect.poll(() => width(page, 'ANCHA')).toBe(280)
})

test('a note never gets narrower than the minimum', async ({ page }) => {
  await openProject(page, workspaceWith([note('a', { title: 'ANCHA', description: LONG_TEXT })]))

  await dragEdge(page, 'ANCHA', -250)

  await expect.poll(() => width(page, 'ANCHA')).toBe(180)
})

test('a note never gets wider than its text and its margin', async ({ page }) => {
  await openProject(
    page,
    workspaceWith([
      note('a', {
        title: 'CORTA',
        description: 'Poco texto',
        // Neither links nor files count, however long.
        webUrls: [`https://example.com/${'larga/'.repeat(30)}`],
        filePaths: [`src/${'carpeta/'.repeat(30)}fichero.ts`],
      }),
    ]),
  )

  await dragEdge(page, 'CORTA', 300)

  const limit = await width(page, 'CORTA')

  expect(limit).toBeGreaterThanOrEqual(180)
  expect(limit).toBeLessThan(280)

  // Its widest text on one line, with only the note's padding and border around it.
  const room = await noteCard(page, 'CORTA').evaluate((card) => {
    const textWidth = (selector: string) => {
      const range = document.createRange()

      range.selectNodeContents(card.querySelector(selector)!)

      return range.getBoundingClientRect().width
    }

    return (
      (card as HTMLElement).offsetWidth -
      Math.max(textWidth('.note__title'), textWidth('.note__description'))
    )
  })

  if (limit > 180) expect(room).toBeLessThan(48)
})

test('a note with a long line of text stops at the top limit', async ({ page }) => {
  await openProject(
    page,
    workspaceWith([note('a', { title: 'LARGA', description: `${LONG_TEXT} ${LONG_TEXT}` })]),
  )

  await dragEdge(page, 'LARGA', 600)

  await expect.poll(() => width(page, 'LARGA')).toBe(480)
})

test('a note with a width from the file shrinks when its text does', async ({ page }) => {
  await openProject(
    page,
    workspaceWith([note('a', { title: 'CORTA', description: 'Poco', width: 400 })]),
  )

  expect(await width(page, 'CORTA')).toBeLessThan(400)
})

test('an arrow points at the middle of the side and follows the new width', async ({ page }) => {
  await openProject(
    page,
    workspaceWith(
      [
        note('a', { title: 'ARRIBA', x: 100, y: 100, description: LONG_TEXT }),
        note('b', { title: 'ABAJO', x: 100, y: 500, description: LONG_TEXT }),
      ],
      { connections: [{ id: 'c', from: 'a', to: 'b' }] },
    ),
  )

  const line = page.locator('.connection__line')
  const start = async () => Number((await line.getAttribute('d'))!.split(' ')[1])

  await expect.poll(start).toBe(100 + 140)

  await dragEdge(page, 'ARRIBA', -80)

  await expect.poll(start).toBe(100 + 100)
})

test('pressing the edge does not move or open the note', async ({ page }) => {
  await openProject(page, workspaceWith([note('a', { title: 'QUIETA', description: LONG_TEXT })]))

  await dragEdge(page, 'QUIETA', -40)

  await expect.poll(() => width(page, 'QUIETA')).toBe(240)
  await expect(noteCard(page, 'QUIETA')).toHaveCSS('left', '100px')
  await expect(page.getByLabel('Título', { exact: true })).toHaveCount(0)
})
