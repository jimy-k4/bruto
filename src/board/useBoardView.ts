import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Point } from '../types'
import { ZOOM_MAX, ZOOM_MIN } from '../domain/constants'
import type { Rect } from './geometry'

export interface BoardView {
  pan: Point
  zoom: number
}

const clampZoom = (zoom: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))

const HOME: BoardView = { pan: { x: 0, y: 0 }, zoom: 1 }

/** Each project's camera lives in this browser, not in `workspace.json`: panning isn't a change to the project. */
const storageKey = (projectId: string) => `bruto-view:${projectId}`

/** Where a project's board was left, or the start when it was never opened here. */
export function savedView(projectId: string | undefined): BoardView {
  if (!projectId) return HOME

  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey(projectId)) ?? 'null')
    const { x, y, zoom } = (saved ?? {}) as Record<string, unknown>

    if ([x, y, zoom].every((value) => typeof value === 'number' && Number.isFinite(value)))
      return { pan: { x: x as number, y: y as number }, zoom: clampZoom(zoom as number) }
  } catch {
    // Unreadable or blocked storage: start at the beginning.
  }

  return HOME
}

function saveView(projectId: string, { pan, zoom }: BoardView) {
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify({ x: pan.x, y: pan.y, zoom }))
  } catch {
    // Without storage the camera only lasts while the project is open.
  }
}

/** Panning fires on every pointer move: the camera is written once it settles. */
const SAVE_DELAY = 400

/**
 * Pan and zoom of the board. Attach `canvasRef` to the visible board area;
 * world coordinates are the notes' own x/y. With a `projectId`, the camera is
 * remembered per project: switching back finds the board where it was left.
 */
export function useBoardView(projectId?: string) {
  const [view, setView] = useState<BoardView>(() => savedView(projectId))
  const viewRef = useRef(view)
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!projectId) return

    const timer = window.setTimeout(() => saveView(projectId, view), SAVE_DELAY)

    return () => window.clearTimeout(timer)
  }, [projectId, view])

  // Leaving the project (or the page) before the delay still keeps the last position.
  useEffect(() => {
    if (!projectId) return

    const flush = () => saveView(projectId, viewRef.current)

    window.addEventListener('pagehide', flush)

    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [projectId])

  const apply = useCallback((next: BoardView) => {
    viewRef.current = next
    setView(next)
  }, [])

  const api = useMemo(() => {
    const canvasRect = () => canvasRef.current?.getBoundingClientRect() ?? new DOMRect(0, 0, 0, 0)

    const screenToWorld = (clientX: number, clientY: number): Point => {
      const rect = canvasRect()
      const { pan, zoom } = viewRef.current

      return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - pan.y) / zoom }
    }

    /** Zooms keeping the world point under `anchor` (canvas coordinates) still. */
    const zoomAround = (factor: number, anchor?: Point) => {
      const { pan, zoom } = viewRef.current
      const nextZoom = clampZoom(zoom * factor)

      if (nextZoom === zoom) return

      const rect = canvasRect()
      const point = anchor ?? { x: rect.width / 2, y: rect.height / 2 }
      const world = { x: (point.x - pan.x) / zoom, y: (point.y - pan.y) / zoom }

      apply({
        zoom: nextZoom,
        pan: { x: point.x - world.x * nextZoom, y: point.y - world.y * nextZoom },
      })
    }

    return {
      screenToWorld,
      zoomAround,
      zoomIn: () => zoomAround(1.15),
      zoomOut: () => zoomAround(1 / 1.15),
      reset: () => apply(HOME),
      panBy: (dx: number, dy: number) => {
        const { pan, zoom } = viewRef.current

        apply({ zoom, pan: { x: pan.x + dx, y: pan.y + dy } })
      },
      /** Centre of the visible area, in world coordinates. */
      visibleCenter: (): Point => {
        const rect = canvasRect()

        return screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2)
      },
      /** Brings a world rectangle to the middle of the screen, keeping the zoom. */
      centerOn: (target: Rect) => {
        const rect = canvasRect()
        const { zoom } = viewRef.current

        apply({
          zoom,
          pan: {
            x: rect.width / 2 - (target.x + target.width / 2) * zoom,
            y: rect.height / 2 - (target.y + target.height / 2) * zoom,
          },
        })
      },
    }
  }, [apply])

  return { canvasRef, view: { ...view, ...api } }
}

export type BoardViewApi = ReturnType<typeof useBoardView>['view']
