export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface Placed<T> {
  item: T
  box: Box
}

/** How far a row of areas, laid along a side of length `side`, is from squares. */
function worstRatio(areas: number[], side: number): number {
  const sum = areas.reduce((total, area) => total + area, 0)
  const max = Math.max(...areas)
  const min = Math.min(...areas)

  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min))
}

/**
 * Squarified treemap (Bruls, Huizing, van Wijk): splits `bounds` into one box
 * per item, with areas proportional to their weights and shapes as close to
 * squares as the weights allow. Items with no weight get no box.
 */
export function squarify<T>(items: { item: T; weight: number }[], bounds: Box): Placed<T>[] {
  const total = items.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0)

  if (total <= 0 || bounds.width <= 0 || bounds.height <= 0) return []

  const scale = (bounds.width * bounds.height) / total
  const queue = items
    .filter((entry) => entry.weight > 0)
    .map((entry) => ({ item: entry.item, area: entry.weight * scale }))
    .sort((a, b) => b.area - a.area)

  const placed: Placed<T>[] = []
  const free = { ...bounds }
  let row: typeof queue = []

  const layRow = () => {
    const sum = row.reduce((total, entry) => total + entry.area, 0)

    if (free.width >= free.height) {
      // A column along the left side.
      const width = sum / free.height
      let y = free.y

      for (const entry of row) {
        const height = entry.area / width
        placed.push({ item: entry.item, box: { x: free.x, y, width, height } })
        y += height
      }

      free.x += width
      free.width -= width
    } else {
      // A row along the top.
      const height = sum / free.width
      let x = free.x

      for (const entry of row) {
        const width = entry.area / height
        placed.push({ item: entry.item, box: { x, y: free.y, width, height } })
        x += width
      }

      free.y += height
      free.height -= height
    }

    row = []
  }

  while (queue.length > 0) {
    const side = Math.min(free.width, free.height)
    const next = queue[0]
    const current = row.map((entry) => entry.area)

    if (
      row.length === 0 ||
      worstRatio([...current, next.area], side) <= worstRatio(current, side)
    ) {
      row.push(next)
      queue.shift()
    } else {
      layRow()
    }
  }

  if (row.length > 0) layRow()

  return placed
}
