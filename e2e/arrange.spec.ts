import { expect, test, type Page } from '@playwright/test'
import { note, noteCard, openProject, readDisk, waitForSaved, workspaceWith } from './helpers'

const GAP = 60

const box = async (page: Page, title: string) =>
  noteCard(page, title).evaluate((element) => {
    const card = element as HTMLElement

    return {
      left: card.offsetLeft,
      top: card.offsetTop,
      right: card.offsetLeft + card.offsetWidth,
      bottom: card.offsetTop + card.offsetHeight,
    }
  })

test('O spaces scattered notes evenly, in the rows they formed, in one undo step', async ({
  page,
}) => {
  await openProject(
    page,
    workspaceWith([
      note('a', { title: 'UNO', x: 100, y: 100, description: 'Una nota\ncon\nvarias\nlíneas' }),
      note('b', { title: 'DOS', x: 700, y: 130 }),
      note('c', { title: 'TRES', x: 180, y: 600 }),
    ]),
  )

  await page.keyboard.press('Control+a')
  await page.keyboard.press('o')

  await expect.poll(async () => (await box(page, 'DOS')).left).toBe(100 + 280 + GAP)

  const one = await box(page, 'UNO')
  const two = await box(page, 'DOS')
  const three = await box(page, 'TRES')

  expect(one).toMatchObject({ left: 100, top: 100 })
  expect(two.top).toBe(100)
  expect(three.left).toBe(100)
  expect(three.top).toBe(Math.max(one.bottom, two.bottom) + GAP)

  await waitForSaved(page)
  expect((await readDisk(page)).notes[1]).toMatchObject({ x: 100 + 280 + GAP, y: 100 })

  await page.keyboard.press('Control+z')
  await expect.poll(async () => (await box(page, 'DOS')).left).toBe(700)
  expect((await box(page, 'TRES')).top).toBe(600)
})

test('O puts notes joined by arrows on levels, each below what points to it', async ({ page }) => {
  await openProject(
    page,
    workspaceWith(
      [
        note('c', { title: 'FIN', x: 100, y: 100 }),
        note('a', { title: 'INICIO', x: 500, y: 100 }),
        note('b', { title: 'MEDIO', x: 900, y: 100 }),
        note('x', { title: 'SUELTA', x: 1300, y: 100 }),
      ],
      {
        connections: [
          { id: 'c1', from: 'a', to: 'b' },
          { id: 'c2', from: 'b', to: 'c' },
        ],
      },
    ),
  )

  await page.keyboard.press('Control+a')
  await page.keyboard.press('o')

  await expect
    .poll(async () => (await box(page, 'MEDIO')).top)
    .toBe((await box(page, 'INICIO')).bottom + GAP)

  const start = await box(page, 'INICIO')
  const middle = await box(page, 'MEDIO')
  const end = await box(page, 'FIN')
  const loose = await box(page, 'SUELTA')

  expect(start.top).toBe(100)
  expect(end.top).toBe(middle.bottom + GAP)
  expect(loose.top).toBe(end.bottom + GAP)
})

test('O places the ghost zones beside the notes, without spreading them', async ({ page }) => {
  await openProject(
    page,
    workspaceWith(
      [
        note('a', {
          title: 'AQUÍ',
          x: 100,
          y: 100,
          crossLinks: [{ kind: 'blocks', project: 'api', noteId: 'g' }],
        }),
      ],
      {
        ghosts: [
          {
            project: 'api',
            offset: { x: 1500, y: 900 },
            notes: [{ id: 'g', title: 'ALLÍ', colorTheme: 'concrete', pattern: 'raw', x: 0, y: 0 }],
            connections: [],
            syncedAt: '2026-11-12T08:00:00Z',
            hops: 1,
          },
        ],
      },
    ),
  )

  // One note and its zone are enough to arrange.
  await noteCard(page, 'AQUÍ').click()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Control+a')
  await page.keyboard.press('o')

  const here = await box(page, 'AQUÍ')
  const frame = page.locator('.ghost-zone__frame')
  const frameBox = () =>
    frame.evaluate((element) => {
      const label = element.querySelector('.ghost-zone__label') as HTMLElement
      const own = element as HTMLElement

      return { left: own.offsetLeft, top: own.offsetTop - label.offsetHeight }
    })

  // Right of the notes, its label level with the note it links to.
  await expect.poll(async () => (await frameBox()).left).toBe(here.right + GAP * 2)
  expect(Math.abs((await frameBox()).top - here.top)).toBeLessThan(8)
  expect(here).toMatchObject({ left: 100, top: 100 })

  await waitForSaved(page)
  expect(((await readDisk(page)).ghosts as { offset: { y: number } }[])[0].offset.y).toBeLessThan(
    900,
  )
})

test('the middle button pans the board over a ghost zone too', async ({ page }) => {
  await openProject(
    page,
    workspaceWith(
      [
        note('a', {
          title: 'AQUÍ',
          x: 100,
          y: 100,
          crossLinks: [{ kind: 'blocks', project: 'api', noteId: 'g' }],
        }),
      ],
      {
        ghosts: [
          {
            project: 'api',
            offset: { x: 0, y: 0 },
            // A zone wide enough to fill the screen.
            notes: [
              { id: 'g', title: 'ALLÍ', colorTheme: 'concrete', pattern: 'raw', x: 0, y: 400 },
              { id: 'h', title: 'LEJOS', colorTheme: 'concrete', pattern: 'raw', x: 6000, y: 4000 },
            ],
            connections: [{ id: 'c', from: 'g', to: 'h' }],
            syncedAt: '2026-11-12T08:00:00Z',
            hops: 1,
          },
        ],
      },
    ),
  )

  const world = page.locator('.board__world')
  const before = await world.evaluate((element) => (element as HTMLElement).style.transform)
  const frame = (await page.locator('.ghost-zone__frame').boundingBox())!
  const start = { x: frame.x + 600, y: frame.y + 120 }

  await page.mouse.move(start.x, start.y)
  await page.mouse.down({ button: 'middle' })
  await page.mouse.move(start.x - 200, start.y - 100, { steps: 5 })
  await page.mouse.up({ button: 'middle' })

  await expect
    .poll(() => world.evaluate((element) => (element as HTMLElement).style.transform))
    .not.toBe(before)
})

test('O moves only the selection and asks for two notes at least', async ({ page }) => {
  await openProject(
    page,
    workspaceWith([
      note('a', { title: 'UNO', x: 100, y: 100 }),
      note('b', { title: 'DOS', x: 900, y: 100 }),
      note('c', { title: 'TRES', x: 100, y: 700 }),
    ]),
  )

  await page.keyboard.press('o')
  await expect(page.getByText('Selecciona al menos dos notas')).toBeVisible()

  await noteCard(page, 'UNO').click({ modifiers: ['Shift'] })
  await noteCard(page, 'DOS').click({ modifiers: ['Shift'] })
  await page.keyboard.press('o')

  await expect.poll(async () => (await box(page, 'DOS')).left).toBe(100 + 280 + GAP)
  expect(await box(page, 'TRES')).toMatchObject({ left: 100, top: 700 })
})
