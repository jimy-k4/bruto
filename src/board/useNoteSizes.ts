import { useCallback, useEffect, useRef, useState } from 'react'
import type { Size } from '../types'
import type { NoteSizes } from './geometry'

/**
 * Real size of every note card. Cards grow with their content, so arrows and
 * area selection need the measured box, not the minimum size.
 */
export function useNoteSizes() {
  const [sizes, setSizes] = useState<NoteSizes>(() => new Map())
  const ids = useRef(new Map<Element, string>())
  const observer = useRef<ResizeObserver | null>(null)

  useEffect(() => {
    return () => observer.current?.disconnect()
  }, [])

  const measure = useCallback((entries: ResizeObserverEntry[]) => {
    setSizes((current) => {
      let next: Map<string, Size> | null = null

      for (const entry of entries) {
        const element = entry.target as HTMLElement
        const id = ids.current.get(element)

        if (!id) continue

        // offsetWidth/Height ignore the board's zoom transform: world units.
        const size = { width: element.offsetWidth, height: element.offsetHeight }
        const previous = current.get(id)

        if (previous?.width === size.width && previous.height === size.height) continue

        next ??= new Map(current)
        next.set(id, size)
      }

      return next ?? current
    })
  }, [])

  /** Ref callback factory: `ref={(element) => observe(note.id, element)}`. */
  const observe = useCallback(
    (id: string, element: HTMLElement) => {
      observer.current ??= new ResizeObserver(measure)
      ids.current.set(element, id)
      observer.current.observe(element)

      return () => {
        observer.current?.unobserve(element)
        ids.current.delete(element)
      }
    },
    [measure],
  )

  return { sizes, observe }
}
