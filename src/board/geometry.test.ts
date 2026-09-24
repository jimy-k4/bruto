import { describe, expect, it } from 'vitest'
import { anchorPoints, type Rect } from './geometry'

const rect = (x: number, y: number, width = 280, height = 160): Rect => ({ x, y, width, height })

/** Whether the straight segment start→end crosses the inside of a rectangle. */
function crosses(rect: Rect, { start, end }: ReturnType<typeof anchorPoints>) {
  for (let step = 1; step < 100; step++) {
    const x = start.x + ((end.x - start.x) * step) / 100
    const y = start.y + ((end.y - start.y) * step) / 100

    if (x > rect.x && x < rect.x + rect.width && y > rect.y && y < rect.y + rect.height) {
      return true
    }
  }

  return false
}

describe('anchorPoints', () => {
  it('runs a straight arrow between notes side by side', () => {
    expect(anchorPoints(rect(0, 0), rect(400, 0))).toEqual({
      start: { x: 281, y: 80 },
      end: { x: 399, y: 80 },
    })
  })

  it('never goes through a small note under the corner of a wide one', () => {
    const wide = rect(0, 0, 900, 300)
    const small = rect(700, 350)
    const points = anchorPoints(wide, small)

    // Out of the bottom of the wide note, into the top of the small one, straight down.
    expect(points).toEqual({ start: { x: 800, y: 301 }, end: { x: 800, y: 349 } })
    expect(crosses(small, points)).toBe(false)
    expect(crosses(wide, points)).toBe(false)
  })

  it('never goes through a tall note beside a small one', () => {
    const tall = rect(0, 0, 280, 900)
    const small = rect(420, 700)
    const points = anchorPoints(small, tall)

    expect(points.start.x).toBe(419)
    expect(points.end.x).toBe(281)
    expect(crosses(small, points)).toBe(false)
    expect(crosses(tall, points)).toBe(false)
  })

  it('stays put when a note grows taller, as when its AI response opens', () => {
    const before = anchorPoints(rect(0, 0), rect(400, 0))
    const after = anchorPoints(rect(0, 0, 280, 520), rect(400, 0))

    expect(after).toEqual(before)

    // Also when the growing note is the lower edge of what the two share.
    const offset = anchorPoints(rect(0, 0), rect(500, 100))
    const offsetGrown = anchorPoints(rect(0, 0, 280, 700), rect(500, 100))

    expect(offsetGrown).toEqual(offset)
  })
})
