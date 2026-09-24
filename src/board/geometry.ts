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

/** How far down a side an arrow may land: the head of a note, which doesn't move as it grows. */
const SIDE_REACH = NOTE_MIN_SIZE.height

/** Space between two ranges; negative when they overlap. */
const spaceBetween = (a0: number, a1: number, b0: number, b1: number) => Math.max(b0 - a1, a0 - b1)

/**
 * Where a connection leaves one note and enters the other, 1px outside the
 * frame so the arrow head lands on it, not under it.
 *
 * The sides face each other across the widest gap between the notes, not
 * between their centres: a big note next to a small one would otherwise send
 * the arrow through one of them. Arrows run straight where the notes line up.
 * On the left and right sides they land within the head of the note, so
 * opening a section that makes a note taller doesn't move them.
 */
export function anchorPoints(from: Rect, to: Rect): { start: Point; end: Point } {
  const gap = 1
  const spaceX = spaceBetween(from.x, from.x + from.width, to.x, to.x + to.width)
  const spaceY = spaceBetween(from.y, from.y + from.height, to.y, to.y + to.height)
  const fromCenter = { x: from.x + from.width / 2, y: from.y + from.height / 2 }
  const toCenter = { x: to.x + to.width / 2, y: to.y + to.height / 2 }
  const sideways =
    spaceX > 0 || spaceY > 0
      ? spaceX >= spaceY
      : Math.abs(toCenter.x - fromCenter.x) > Math.abs(toCenter.y - fromCenter.y)

  if (sideways) {
    const right = toCenter.x > fromCenter.x
    const headEnd = (rect: Rect) => rect.y + Math.min(rect.height, SIDE_REACH)
    const top = Math.max(from.y, to.y)
    const bottom = Math.min(headEnd(from), headEnd(to))
    const shared = bottom > top ? (top + bottom) / 2 : null
    const headMiddle = (rect: Rect) => (rect.y + headEnd(rect)) / 2

    return {
      start: {
        x: right ? from.x + from.width + gap : from.x - gap,
        y: shared ?? headMiddle(from),
      },
      end: { x: right ? to.x - gap : to.x + to.width + gap, y: shared ?? headMiddle(to) },
    }
  }

  const down = toCenter.y > fromCenter.y
  const left = Math.max(from.x, to.x)
  const right = Math.min(from.x + from.width, to.x + to.width)
  const shared = right > left ? (left + right) / 2 : null

  return {
    start: {
      x: shared ?? fromCenter.x,
      y: down ? from.y + from.height + gap : from.y - gap,
    },
    end: { x: shared ?? toCenter.x, y: down ? to.y - gap : to.y + to.height + gap },
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
