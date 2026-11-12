import type { Connection, GhostNote, GhostZone, Note, Point, Size } from '../types'
import { NOTE_MIN_SIZE, NOTE_WIDTH_MAX, NOTE_WIDTH_MIN } from '../domain/constants'
import { ghostKey } from '../domain/ghosts'

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

/** Room around a zone's notes inside its dotted frame. */
export const FRAME_PADDING = 28
/** Room the zone's label takes above its frame. */
export const ZONE_LABEL_ROOM = 36

/** A ghost card where it sits on this board. */
export const ghostRect = (zone: GhostZone, ghost: GhostNote, sizes: NoteSizes): Rect => ({
  x: ghost.x + zone.offset.x,
  y: ghost.y + zone.offset.y,
  // Ghost cards are measured like notes, under a key no note id can take.
  ...(sizes.get(ghostKey(zone, ghost.id)) ?? NOTE_MIN_SIZE),
})

/** A zone's dotted frame, around its notes. */
export function zoneFrame(zone: GhostZone, sizes: NoteSizes): Rect {
  const notes = boundingRect(zone.notes.map((ghost) => ghostRect(zone, ghost, sizes)))!

  return {
    x: notes.x - FRAME_PADDING,
    y: notes.y - FRAME_PADDING,
    width: notes.width + FRAME_PADDING * 2,
    height: notes.height + FRAME_PADDING * 2,
  }
}

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
 * The inline width of a card with its own width: as wide as its text needs, up
 * to the width the user gave it, so the text can't leave it half empty.
 */
export const noteWidthStyle = (width?: number): React.CSSProperties =>
  width ? { width: 'max-content', minWidth: NOTE_WIDTH_MIN, maxWidth: width } : {}

/** The width a drag asks for, within the limits and no wider than the card's text needs. */
export const resizedWidth = (wanted: number, textWidth: number) =>
  Math.max(NOTE_WIDTH_MIN, Math.min(wanted, textWidth, NOTE_WIDTH_MAX))

/** Space between two ranges; negative when they overlap. */
const spaceBetween = (a0: number, a1: number, b0: number, b1: number) => Math.max(b0 - a1, a0 - b1)

/**
 * Where a connection leaves one note and enters the other: the middle of the
 * sides that face each other, 1px outside the frame so the arrow head lands on
 * it, not under it.
 *
 * The sides face each other across the widest gap between the notes, not
 * between their centres: a big note next to a small one would otherwise send
 * the arrow through one of them.
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

    return {
      start: { x: right ? from.x + from.width + gap : from.x - gap, y: fromCenter.y },
      end: { x: right ? to.x - gap : to.x + to.width + gap, y: toCenter.y },
    }
  }

  const down = toCenter.y > fromCenter.y

  return {
    start: { x: fromCenter.x, y: down ? from.y + from.height + gap : from.y - gap },
    end: { x: toCenter.x, y: down ? to.y - gap : to.y + to.height + gap },
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
