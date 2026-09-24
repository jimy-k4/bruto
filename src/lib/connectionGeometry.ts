import type { Connection, Note } from '../types'

export const NOTE_BASE_WIDTH = 280
export const NOTE_BASE_HEIGHT = 160

/**
 * Measures the rendered size of a note card by locating its DOM element.
 * Notes can grow beyond the 280x160 base size when their content wraps,
 * so connection endpoints must use the real layout box, not the base size.
 * offsetWidth/offsetHeight are unaffected by ancestor transforms, so the
 * result is already in canvas-world coordinates.
 */
export function getNoteRenderedSize(note: Note): { width: number; height: number } {
  if (typeof document === 'undefined') {
    return {
      width: NOTE_BASE_WIDTH,
      height: NOTE_BASE_HEIGHT,
    }
  }

  const element = document.querySelector<HTMLElement>(
    `.note-card[data-note-id="${cssEscape(note.id)}"]`,
  )

  if (!element) {
    return {
      width: NOTE_BASE_WIDTH,
      height: NOTE_BASE_HEIGHT,
    }
  }

  return {
    width: element.offsetWidth || NOTE_BASE_WIDTH,
    height: element.offsetHeight || NOTE_BASE_HEIGHT,
  }
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) {
    return CSS.escape(value)
  }

  return value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`)
}

/**
 * Edge anchor points where a connection line should leave/enter a note:
 * the middle of the facing border, nudged 1px outside the border so the
 * line starts on the note frame itself and never inside it. The 8px
 * drop shadow is intentionally excluded — the arrow must land on the
 * actual note card.
 */
export function getConnectionPoints(
  fromNote: Note,
  toNote: Note,
  sizes: {
    from: {
      width: number
      height: number
    }
    to: {
      width: number
      height: number
    }
  },
) {
  const fromCenterX = fromNote.x + sizes.from.width / 2
  const fromCenterY = fromNote.y + sizes.from.height / 2
  const toCenterX = toNote.x + sizes.to.width / 2
  const toCenterY = toNote.y + sizes.to.height / 2

  const dx = toCenterX - fromCenterX
  const dy = toCenterY - fromCenterY
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  const gap = 1

  let fromX: number
  let fromY: number
  let toX: number
  let toY: number

  if (absDx > absDy) {
    const direction = dx > 0 ? 1 : -1

    fromX = fromCenterX + direction * (sizes.from.width / 2 + gap)
    fromY = fromCenterY

    toX = toCenterX - direction * (sizes.to.width / 2 + gap)
    toY = toCenterY
  } else {
    const direction = dy > 0 ? 1 : -1

    fromX = fromCenterX
    fromY = fromCenterY + direction * (sizes.from.height / 2 + gap)

    toX = toCenterX
    toY = toCenterY - direction * (sizes.to.height / 2 + gap)
  }

  return {
    fromX,
    fromY,
    toX,
    toY,
  }
}

export function getConnectionPath(
  connection: Connection,
  fromNote: Note,
  toNote: Note,
  sizes: {
    from: {
      width: number
      height: number
    }
    to: {
      width: number
      height: number
    }
  },
  curveOffset: number,
  allConnections: Connection[],
) {
  const { fromX, fromY, toX, toY } = getConnectionPoints(fromNote, toNote, sizes)

  const reverseExists = allConnections.some(
    (otherConnection) =>
      otherConnection.from === connection.to && otherConnection.to === connection.from,
  )

  if (!reverseExists) {
    return `M ${fromX} ${fromY} L ${toX} ${toY}`
  }

  const dx = toX - fromX
  const dy = toY - fromY

  const length = Math.sqrt(dx * dx + dy * dy)

  if (length === 0) {
    return `M ${fromX} ${fromY} L ${toX} ${toY}`
  }

  const perpendicularX = -dy / length

  const perpendicularY = dx / length

  const offsetX = perpendicularX * curveOffset

  const offsetY = perpendicularY * curveOffset

  const controlX = (fromX + toX) / 2 + offsetX

  const controlY = (fromY + toY) / 2 + offsetY

  return `M ${fromX} ${fromY}\n      Q ${controlX} ${controlY}\n        ${toX} ${toY}`
}
