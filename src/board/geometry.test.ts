import { describe, expect, it } from 'vitest'
import { anchorPoints, resizedWidth, type Rect } from './geometry'

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

    // Out of the middle of the wide note's bottom, into the middle of the small one's top.
    expect(points).toEqual({ start: { x: 450, y: 301 }, end: { x: 840, y: 349 } })
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

  it('lands in the middle of each side, whatever size each note has', () => {
    expect(anchorPoints(rect(0, 0, 280, 520), rect(400, 0))).toEqual({
      start: { x: 281, y: 260 },
      end: { x: 399, y: 80 },
    })
    expect(anchorPoints(rect(0, 0, 180), rect(0, 300, 400))).toEqual({
      start: { x: 90, y: 161 },
      end: { x: 200, y: 299 },
    })
  })

  it('follows a note as its width changes', () => {
    const below = rect(0, 300)

    expect(anchorPoints(rect(0, 0, 280), below).start.x).toBe(140)
    expect(anchorPoints(rect(0, 0, 200), below).start.x).toBe(100)
    expect(anchorPoints(rect(0, 0, 200), rect(400, 0)).start.x).toBe(201)
  })
})

describe('resizedWidth', () => {
  it('follows the drag between the limits', () => {
    expect(resizedWidth(250, 400)).toBe(250)
  })

  it('never goes wider than the text needs', () => {
    expect(resizedWidth(500, 212)).toBe(212)
  })

  it('never goes wider than the top limit, however long the text', () => {
    expect(resizedWidth(900, 2000)).toBe(480)
  })

  it('never goes narrower than the minimum, however short the text', () => {
    expect(resizedWidth(40, 400)).toBe(180)
    expect(resizedWidth(300, 60)).toBe(180)
  })
})
