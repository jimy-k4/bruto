import type { Connection, Point } from '../types'
import { anchorPoints, type Rect } from './geometry'

export interface ArrangeItem extends Rect {
  id: string
}

type Link = Pick<Connection, 'from' | 'to'>
type Rects = Map<string, Rect>

/** Space between arranged notes, across and down. */
export const ARRANGE_GAP = 60
/** How many times the notes of each level are reordered around their neighbours. */
const SWEEPS = 4
/** Room left between an arrow and a note it passes by. */
const LINE_CLEARANCE = 16

const byPlace = (a: ArrangeItem, b: ArrangeItem) =>
  a.y - b.y || a.x - b.x || a.id.localeCompare(b.id)

/**
 * Where notes go to be tidy: on levels when arrows join them, each note below
 * those that point to it; otherwise in the rows they already roughly form, with
 * the same space between them. The group keeps its top left corner.
 */
export function arrangeNotes(items: ArrangeItem[], connections: Link[]): Map<string, Point> {
  if (items.length < 2) return new Map()

  const ids = new Set(items.map((item) => item.id))
  const links = connections.filter(({ from, to }) => from !== to && ids.has(from) && ids.has(to))
  const placed = links.length > 0 ? onLevels(items, links) : layOut(intoRows(items), false)
  const rects = [...placed.values()]
  const dx = Math.min(...items.map((item) => item.x)) - Math.min(...rects.map((rect) => rect.x))
  const dy = Math.min(...items.map((item) => item.y)) - Math.min(...rects.map((rect) => rect.y))

  return new Map(
    [...placed].map(([id, rect]) => [
      id,
      { x: Math.round(rect.x + dx), y: Math.round(rect.y + dy) },
    ]),
  )
}

/** Whether two notes sit side by side: they share at least half of the shorter one's height. */
function sameRow(a: Rect, b: Rect) {
  const shared = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)

  return shared >= Math.min(a.height, b.height) / 2
}

/** The rows notes already roughly form, top to bottom and each left to right. */
function intoRows(items: ArrangeItem[]): ArrangeItem[][] {
  const rows: ArrangeItem[][] = []

  for (const item of [...items].sort(byPlace)) {
    const row = rows.find(([first]) => sameRow(first, item))

    if (row) row.push(item)
    else rows.push([item])
  }

  return rows.map((row) => row.sort((a, b) => a.x - b.x || a.id.localeCompare(b.id)))
}

const rowWidth = (row: ArrangeItem[]) =>
  row.reduce((sum, item) => sum + item.width, 0) + ARRANGE_GAP * (row.length - 1)

/** Rows one under another, the same gap everywhere; each row's notes level at the top. */
function layOut(rows: ArrangeItem[][], centred: boolean): Rects {
  const widest = Math.max(...rows.map(rowWidth))
  const placed: Rects = new Map()
  let y = 0

  for (const row of rows) {
    let x = centred ? (widest - rowWidth(row)) / 2 : 0

    for (const { id, width, height } of row) {
      placed.set(id, { x, y, width, height })
      x += width + ARRANGE_GAP
    }

    y += Math.max(...row.map((item) => item.height)) + ARRANGE_GAP
  }

  return placed
}

// ---------------------------------------------------------------------------
// Levels

function onLevels(items: ArrangeItem[], links: Link[]): Rects {
  const joined = new Set(links.flatMap(({ from, to }) => [from, to]))
  const loose = items.filter((item) => !joined.has(item.id))
  const levels = levelsOf(
    items.filter((item) => joined.has(item.id)),
    links,
  )
  const ordered = bestOrder(levels, links)
  // Notes no arrow touches have no level: a row of their own, under the rest.
  const placed = layOut(loose.length > 0 ? [...ordered, intoRows(loose).flat()] : ordered, true)

  clearLines(ordered, placed, links)

  return placed
}

/**
 * The arrows that leave no loop: a depth-first walk from the notes nothing
 * points to, then from the highest left, drops any arrow back to a note it is
 * still walking from. So in a loop the note highest on the board stays on top.
 */
function withoutLoops(items: ArrangeItem[], links: Link[]): Link[] {
  const pointedAt = new Set(links.map((link) => link.to))
  const starts = [...items]
    .sort(byPlace)
    .sort((a, b) => Number(pointedAt.has(a.id)) - Number(pointedAt.has(b.id)))
  const state = new Map<string, 'walking' | 'done'>()
  const kept: Link[] = []

  const walk = (id: string) => {
    state.set(id, 'walking')

    for (const link of links) {
      if (link.from !== id) continue

      const next = state.get(link.to)

      if (next === 'walking') continue

      kept.push(link)
      if (!next) walk(link.to)
    }

    state.set(id, 'done')
  }

  for (const { id } of starts) if (!state.has(id)) walk(id)

  return kept
}

/** Each note one level below the lowest note that points to it; left to right as they are. */
function levelsOf(items: ArrangeItem[], links: Link[]): ArrangeItem[][] {
  const kept = withoutLoops(items, links)
  const level = new Map(items.map((item) => [item.id, 0]))

  // No loops left: at most one pass per note settles every level.
  for (let pass = 0; pass < items.length; pass++) {
    for (const { from, to } of kept) {
      level.set(to, Math.max(level.get(to)!, level.get(from)! + 1))
    }
  }

  const rows: ArrangeItem[][] = []

  for (const item of [...items].sort((a, b) => a.x - b.x || a.y - b.y)) {
    ;(rows[level.get(item.id)!] ??= []).push(item)
  }

  return rows
}

/** Sweeps the levels, each note towards the average of its neighbours; keeps the cleanest. */
function bestOrder(levels: ArrangeItem[][], links: Link[]): ArrangeItem[][] {
  let current = levels
  let best = levels
  let bestScore = untidiness(layOut(levels, true), links)

  for (let sweep = 0; sweep < SWEEPS; sweep++) {
    const indexes = current.map((_, index) => index)

    if (sweep % 2 === 1) indexes.reverse()

    for (const index of indexes) current = reordered(current, index, links)

    const score = untidiness(layOut(current, true), links)

    if (score < bestScore) {
      best = current
      bestScore = score
    }
  }

  return best
}

function reordered(levels: ArrangeItem[][], index: number, links: Link[]): ArrangeItem[][] {
  const rank = new Map<string, number>()

  // Levels are centred, so a note's place is measured from the middle of its level.
  for (const row of levels) {
    row.forEach((item, place) => rank.set(item.id, place - (row.length - 1) / 2))
  }

  const pull = (id: string) => {
    const others = links.flatMap(({ from, to }) => (from === id ? [to] : to === id ? [from] : []))

    return others.length > 0
      ? others.reduce((sum, other) => sum + rank.get(other)!, 0) / others.length
      : rank.get(id)!
  }
  const row = [...levels[index]].sort((a, b) => pull(a.id) - pull(b.id))

  return levels.map((item, at) => (at === index ? row : item))
}

/** A long arrow through a note reads worse than any number of arrows crossing. */
const untidiness = (placed: Rects, links: Link[]) =>
  linesThroughNotes(placed, links).length * 1000 + crossings(placed, links)

/**
 * Takes notes out of the way of the arrows passing over them, by the least it
 * can: the whole level sideways, which keeps its gaps, or else a wider gap
 * opened where the arrow goes through.
 */
function clearLines(levels: ArrangeItem[][], placed: Rects, links: Link[]) {
  for (let pass = 0; pass < levels.length; pass++) {
    for (const row of levels) {
      const hits = linesThroughNotes(placed, links)

      if (hits.length === 0) return

      let best: (Move & { left: number }) | null = null

      for (const hit of hits) {
        for (const move of movesClearing(hit, row)) {
          const left = linesThroughNotes(moved(placed, move.ids, move.shift), links).length

          if (
            left < (best?.left ?? hits.length) ||
            (best && left === best.left && Math.abs(move.shift) < Math.abs(best.shift))
          ) {
            best = { ...move, left }
          }
        }
      }

      if (best) {
        for (const [id, rect] of moved(placed, best.ids, best.shift)) placed.set(id, rect)
      }
    }
  }
}

interface Move {
  ids: Set<string>
  shift: number
}

/** The notes of a level that can move to free a note it holds, and how far. */
function movesClearing(hit: Hit, row: ArrangeItem[]): Move[] {
  const place = row.findIndex((item) => item.id === hit.id)

  if (place < 0) return []

  const all = row.map((item) => item.id)
  const { right, left } = shiftsClearing(hit)

  return [
    { ids: all, shift: right },
    { ids: all, shift: left },
    // Apart from the rest: nothing it passes on the way, so nothing lands on anything.
    { ids: all.slice(place), shift: right },
    { ids: all.slice(0, place + 1), shift: left },
  ]
    .filter(({ shift }) => Number.isFinite(shift))
    .map(({ ids, shift }) => ({ ids: new Set(ids), shift }))
}

function moved(placed: Rects, ids: Set<string>, shift: number): Rects {
  return new Map(
    [...placed].map(([id, rect]) => [id, ids.has(id) ? { ...rect, x: rect.x + shift } : rect]),
  )
}

// ---------------------------------------------------------------------------
// Arrows as lines

interface Line {
  start: Point
  end: Point
}

interface Hit {
  id: string
  rect: Rect
  line: Line
}

const lineOf = (placed: Rects, { from, to }: Link): Line =>
  anchorPoints(placed.get(from)!, placed.get(to)!)

/** Whether a line goes through a rectangle: the line clipped to its two axes (Liang–Barsky). */
function lineHits({ start, end }: Line, rect: Rect) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  let enter = 0
  let leave = 1

  for (const [delta, near, far] of [
    [dx, rect.x - start.x, rect.x + rect.width - start.x],
    [dy, rect.y - start.y, rect.y + rect.height - start.y],
  ]) {
    if (delta === 0) {
      if (near > 0 || far < 0) return false
      continue
    }

    const a = near / delta
    const b = far / delta

    enter = Math.max(enter, Math.min(a, b))
    leave = Math.min(leave, Math.max(a, b))
  }

  return enter < leave
}

const withRoom = (rect: Rect): Rect => ({
  x: rect.x - LINE_CLEARANCE + 1,
  y: rect.y,
  width: rect.width + (LINE_CLEARANCE - 1) * 2,
  height: rect.height,
})

/** Every note an arrow between two others passes over. */
function linesThroughNotes(placed: Rects, links: Link[]): Hit[] {
  return links.flatMap((link) => {
    const line = lineOf(placed, link)

    return [...placed]
      .filter(([id, rect]) => id !== link.from && id !== link.to && lineHits(line, withRoom(rect)))
      .map(([id, rect]) => ({ id, rect, line }))
  })
}

/** How far a note has to go, each way, for the line to pass it by. */
function shiftsClearing({ rect, line: { start, end } }: Hit): { right: number; left: number } {
  if (start.y === end.y) return { right: NaN, left: NaN }

  const xAt = (y: number) => start.x + ((end.x - start.x) * (y - start.y)) / (end.y - start.y)
  const top = Math.max(rect.y, Math.min(start.y, end.y))
  const bottom = Math.min(rect.y + rect.height, Math.max(start.y, end.y))
  const xs = [xAt(top), xAt(bottom)]

  return {
    right: Math.max(...xs) + LINE_CLEARANCE - rect.x,
    left: Math.min(...xs) - LINE_CLEARANCE - (rect.x + rect.width),
  }
}

/** On which side of the line a → b the point c falls. */
const side = (a: Point, b: Point, c: Point) =>
  Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x))

const linesCross = (a: Line, b: Line) =>
  side(a.start, a.end, b.start) !== side(a.start, a.end, b.end) &&
  side(b.start, b.end, a.start) !== side(b.start, b.end, a.end)

/** Pairs of arrows that cross; arrows that share a note meet there, which doesn't count. */
function crossings(placed: Rects, links: Link[]) {
  let count = 0

  links.forEach((a, index) => {
    for (const b of links.slice(index + 1)) {
      const shared = [a.from, a.to].some((id) => id === b.from || id === b.to)

      if (!shared && linesCross(lineOf(placed, a), lineOf(placed, b))) count++
    }
  })

  return count
}
