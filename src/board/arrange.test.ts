import { describe, expect, it } from 'vitest'
import { ARRANGE_GAP, arrangeNotes, type ArrangeItem } from './arrange'
import { anchorPoints } from './geometry'

const item = (id: string, x: number, y: number, width = 280, height = 160): ArrangeItem => ({
  id,
  x,
  y,
  width,
  height,
})

const link = (from: string, to: string) => ({ from, to })

/** The notes where they were sent. */
const applied = (items: ArrangeItem[], links: ReturnType<typeof link>[] = []) => {
  const positions = arrangeNotes(items, links)

  return items.map((one) => ({ ...one, ...positions.get(one.id) }))
}

const byId = (items: ArrangeItem[]) => new Map(items.map((one) => [one.id, one]))

/** Whether the straight arrow between two notes goes over a third. */
function passesOver(from: ArrangeItem, to: ArrangeItem, other: ArrangeItem) {
  const { start, end } = anchorPoints(from, to)

  for (let step = 1; step < 200; step++) {
    const x = start.x + ((end.x - start.x) * step) / 200
    const y = start.y + ((end.y - start.y) * step) / 200

    if (x > other.x && x < other.x + other.width && y > other.y && y < other.y + other.height) {
      return true
    }
  }

  return false
}

describe('arrangeNotes without arrows', () => {
  it('has nothing to do for a single note', () => {
    expect(arrangeNotes([item('a', 10, 10)], []).size).toBe(0)
  })

  it('leaves the same gap across and down, whatever size each note is', () => {
    const [a, b, c] = applied([
      item('a', 100, 100, 200, 300),
      item('b', 500, 130, 400),
      item('c', 150, 700),
    ])

    expect(a).toMatchObject({ x: 100, y: 100 })
    expect(b.x).toBe(a.x + a.width + ARRANGE_GAP)
    expect(b.y).toBe(a.y)
    expect(c).toMatchObject({ x: 100, y: a.y + a.height + ARRANGE_GAP })
  })

  it('keeps the rows and the order the notes already have', () => {
    const notes = applied([
      item('right', 900, 20),
      item('left', 80, 0),
      item('middle', 400, 60),
      item('under', 500, 500),
    ])
    const { left, middle, right, under } = Object.fromEntries(notes.map((one) => [one.id, one]))

    expect(left.x).toBeLessThan(middle.x)
    expect(middle.x).toBeLessThan(right.x)
    expect(new Set([left.y, middle.y, right.y]).size).toBe(1)
    expect(under.y).toBeGreaterThan(left.y)
  })

  it('stays where it is when arranged again', () => {
    const once = applied([
      item('a', 0, 0, 180, 500),
      item('b', 300, 40),
      item('c', 10, 620),
      item('d', 400, 700, 480, 90),
    ])

    expect(applied(once)).toEqual(once)
  })

  it('ignores arrows to notes outside the selection', () => {
    const [a, b] = applied([item('a', 0, 0), item('b', 400, 300)], [link('a', 'elsewhere')])

    expect(b.y).toBe(a.y + a.height + ARRANGE_GAP)
    expect(b.x).toBe(a.x)
  })
})

describe('arrangeNotes on levels', () => {
  it('puts each note below the ones that point to it, the same gap apart', () => {
    const notes = byId(
      applied(
        [item('c', 0, 0), item('b', 400, 0), item('a', 800, 0)],
        [link('a', 'b'), link('b', 'c')],
      ),
    )

    expect(notes.get('a')!.y).toBe(0)
    expect(notes.get('b')!.y).toBe(160 + ARRANGE_GAP)
    expect(notes.get('c')!.y).toBe((160 + ARRANGE_GAP) * 2)
  })

  it('goes by the longest way down', () => {
    const notes = byId(
      applied(
        [item('a', 0, 0), item('b', 400, 0), item('c', 800, 0)],
        [link('a', 'c'), link('a', 'b'), link('b', 'c')],
      ),
    )

    expect(notes.get('b')!.y).toBeGreaterThan(notes.get('a')!.y)
    expect(notes.get('c')!.y).toBeGreaterThan(notes.get('b')!.y)
  })

  it('keeps an arrow that skips a level off the note in between', () => {
    const notes = byId(
      applied(
        [item('a', 0, 0), item('b', 400, 0), item('c', 800, 0)],
        [link('a', 'c'), link('a', 'b'), link('b', 'c')],
      ),
    )

    expect(passesOver(notes.get('a')!, notes.get('c')!, notes.get('b')!)).toBe(false)
  })

  it('opens a gap in a full level for an arrow that skips it', () => {
    const links = [
      link('a', 'b'),
      link('a', 'c'),
      link('b', 'd'),
      link('c', 'd'),
      link('a', 'd'),
      link('d', 'e'),
      link('c', 'f'),
    ]
    const notes = byId(
      applied(
        [
          item('e', 40, 40, 180),
          item('b', 700, 500),
          item('f', 1000, 60, 280, 218),
          item('a', 400, 800),
          item('d', 60, 420, 180),
          item('c', 1100, 700),
          item('x', 600, 60),
          item('y', 200, 1000, 180),
        ],
        links,
      ),
    )

    for (const { from, to } of links) {
      for (const other of notes.values()) {
        if (other.id === from || other.id === to) continue

        expect(passesOver(notes.get(from)!, notes.get(to)!, other)).toBe(false)
      }
    }
  })

  it('reorders a level so arrows do not cross', () => {
    const notes = byId(
      applied(
        [item('a', 0, 0), item('b', 400, 0), item('c', 0, 400), item('d', 400, 400)],
        [link('a', 'd'), link('b', 'c')],
      ),
    )
    const aFirst = notes.get('a')!.x < notes.get('b')!.x
    const dFirst = notes.get('d')!.x < notes.get('c')!.x

    expect(aFirst).toBe(dFirst)
  })

  it('leaves notes no arrow touches in a row of their own, underneath', () => {
    const notes = byId(
      applied(
        [item('a', 0, 0), item('b', 0, 300), item('x', 500, 0), item('y', 900, 0)],
        [link('a', 'b')],
      ),
    )

    expect(notes.get('x')!.y).toBe(notes.get('y')!.y)
    expect(notes.get('x')!.y).toBe(notes.get('b')!.y + 160 + ARRANGE_GAP)
  })

  it('keeps the note highest on the board on top of a two-way pair', () => {
    const notes = byId(
      applied(
        [item('low', 0, 500), item('high', 0, 0)],
        [link('low', 'high'), link('high', 'low')],
      ),
    )

    expect(notes.get('high')!.y).toBeLessThan(notes.get('low')!.y)
  })

  it('gets through a loop of any size', () => {
    const notes = applied(
      [item('a', 0, 0), item('b', 400, 0), item('c', 800, 400)],
      [link('a', 'b'), link('b', 'c'), link('c', 'a')],
    )

    expect(new Set(notes.map((one) => one.y)).size).toBe(3)
  })

  it('never leaves notes on top of each other', () => {
    const notes = applied(
      [
        item('a', 0, 0, 180, 400),
        item('b', 10, 10),
        item('c', 20, 20, 480),
        item('d', 30, 30),
        item('e', 40, 40),
        item('f', 50, 50),
      ],
      [link('a', 'b'), link('a', 'c'), link('b', 'd'), link('c', 'd'), link('a', 'e')],
    )

    for (const one of notes) {
      for (const other of notes) {
        if (one === other) continue

        const apart =
          one.x + one.width <= other.x ||
          other.x + other.width <= one.x ||
          one.y + one.height <= other.y ||
          other.y + other.height <= one.y

        expect(apart).toBe(true)
      }
    }
  })

  it('keeps the top left corner of the group', () => {
    const notes = applied([item('a', 200, 300), item('b', 700, 900)], [link('b', 'a')])

    expect(Math.min(...notes.map((one) => one.x))).toBe(200)
    expect(Math.min(...notes.map((one) => one.y))).toBe(300)
  })

  it('stays where it is when arranged again', () => {
    const links = [link('a', 'b'), link('a', 'c'), link('b', 'd'), link('c', 'd'), link('a', 'd')]
    const once = applied(
      [item('a', 0, 0), item('b', 400, 0), item('c', 800, 0), item('d', 0, 400)],
      links,
    )

    expect(applied(once, links)).toEqual(once)
  })
})
