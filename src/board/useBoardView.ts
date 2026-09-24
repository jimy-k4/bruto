import { useCallback, useMemo, useRef, useState } from 'react'
import type { Point } from '../types'
import { ZOOM_MAX, ZOOM_MIN } from '../domain/constants'
import type { Rect } from './geometry'

export interface BoardView {
  pan: Point
  zoom: number
}

const clampZoom = (zoom: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))

/**
 * Pan and zoom of the board. Attach `canvasRef` to the visible board area;
 * world coordinates are the notes' own x/y.
 */
export function useBoardView() {
  const [view, setView] = useState<BoardView>({ pan: { x: 0, y: 0 }, zoom: 1 })
  const viewRef = useRef(view)
  const canvasRef = useRef<HTMLDivElement>(null)

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
      reset: () => apply({ pan: { x: 0, y: 0 }, zoom: 1 }),
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
