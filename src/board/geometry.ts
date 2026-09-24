import type { Connection, Note, Point, Size } from '../types'
import { NOTE_MIN_SIZE } from '../domain/constants'

export type NoteSizes = ReadonlyMap<string, Size>

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export const noteRect = (note: Note, sizes: NoteSizes): Rect => ({
  x: note.x,
  y: note.y,
  ...(sizes.get(note.id) ?? NOTE_MIN_SIZE),
})

export function boundingRect(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null

  const left = Math.min(...rects.map((rect) => rect.x))
  const top = Math.min(...rects.map((rect) => rect.y))
  const right = Math.max(...rects.map((rect) => rect.x + rect.width))
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height))

  return { x: left, y: top, width: right - left, height: bottom - top }
}

export const rectsOverlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y

/**
 * Where a connection leaves one note and enters the other: the middle of the
 * facing borders, 1px outside so the arrow lands on the frame, not inside.
 */
function anchorPoints(from: Rect, to: Rect): { start: Point; end: Point } {
  const fromCenter = { x: from.x + from.width / 2, y: from.y + from.height / 2 }
  const toCenter = { x: to.x + to.width / 2, y: to.y + to.height / 2 }
  const dx = toCenter.x - fromCenter.x
  const dy = toCenter.y - fromCenter.y
  const gap = 1

  if (Math.abs(dx) > Math.abs(dy)) {
    const direction = dx > 0 ? 1 : -1

    return {
      start: { x: fromCenter.x + direction * (from.width / 2 + gap), y: fromCenter.y },
      end: { x: toCenter.x - direction * (to.width / 2 + gap), y: toCenter.y },
    }
  }

  const direction = dy > 0 ? 1 : -1

  return {
    start: { x: fromCenter.x, y: fromCenter.y + direction * (from.height / 2 + gap) },
    end: { x: toCenter.x, y: toCenter.y - direction * (to.height / 2 + gap) },
  }
}

/** SVG path of a connection. Two-way pairs curve apart so both arrows stay visible. */
export function connectionPath(from: Rect, to: Rect, curved: boolean, bend = 40): string {
  const { start, end } = anchorPoints(from, to)

  if (!curved) {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`
  }

  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy) || 1
  const control = {
    x: (start.x + end.x) / 2 - (dy / length) * bend,
    y: (start.y + end.y) / 2 + (dx / length) * bend,
  }

  return `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`
}

export function hasReverse(connection: Connection, all: Connection[]): boolean {
  return all.some((other) => other.from === connection.to && other.to === connection.from)
}
