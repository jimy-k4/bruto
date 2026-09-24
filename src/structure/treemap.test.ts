import { describe, expect, it } from 'vitest'
import { squarify, type Box } from './treemap'

const area = (box: Box) => box.width * box.height
const overlap = (a: Box, b: Box) =>
  a.x + 0.001 < b.x + b.width &&
  b.x + 0.001 < a.x + a.width &&
  a.y + 0.001 < b.y + b.height &&
  b.y + 0.001 < a.y + a.height

describe('squarify', () => {
  const bounds = { x: 0, y: 0, width: 600, height: 400 }
  const weights = [6, 6, 4, 3, 2, 2, 1]
  const placed = squarify(
    weights.map((weight, index) => ({ item: index, weight })),
    bounds,
  )

  it('gives each item an area proportional to its weight', () => {
    const total = weights.reduce((sum, weight) => sum + weight, 0)

    for (const { item, box } of placed) {
      expect(area(box)).toBeCloseTo((weights[item] / total) * area(bounds), 6)
    }
  })

  it('fills the bounds without overlapping or spilling', () => {
    for (const [index, { box }] of placed.entries()) {
      expect(box.x).toBeGreaterThanOrEqual(-0.001)
      expect(box.y).toBeGreaterThanOrEqual(-0.001)
      expect(box.x + box.width).toBeLessThanOrEqual(600.001)
      expect(box.y + box.height).toBeLessThanOrEqual(400.001)

      for (const other of placed.slice(index + 1)) expect(overlap(box, other.box)).toBe(false)
    }
  })

  it('keeps shapes close to squares', () => {
    for (const { box } of placed) {
      expect(Math.max(box.width / box.height, box.height / box.width)).toBeLessThan(3)
    }
  })

  it('skips empty items and empty bounds', () => {
    expect(squarify([{ item: 'a', weight: 0 }], bounds)).toEqual([])
    expect(squarify([{ item: 'a', weight: 1 }], { ...bounds, width: 0 })).toEqual([])
    expect(squarify([{ item: 'a', weight: 1 }], bounds)).toEqual([{ item: 'a', box: bounds }])
  })
})
