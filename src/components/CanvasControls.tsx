import type { MouseEvent } from 'react'
import type { Translator } from '../i18n/translations'

interface CanvasControlsProps {
  t: Translator
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}

export function CanvasControls({
  t,
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: CanvasControlsProps) {
  return (
    <div
      className="canvas-controls"
      onMouseDown={(
        event: MouseEvent<HTMLDivElement>,
      ) => {
        event.stopPropagation()
      }}
    >
      <button
        type="button"
        onClick={
          onZoomOut
        }
        disabled={
          zoom <= 0.25
        }
        aria-label={t(
          'zoomOut',
        )}
      >
        −
      </button>

      <button
        type="button"
        className="canvas-zoom-value"
        onClick={
          onReset
        }
      >
        {Math.round(
          zoom * 100,
        )}
        %
      </button>

      <button
        type="button"
        onClick={
          onZoomIn
        }
        disabled={
          zoom >= 2
        }
        aria-label={t(
          'zoomIn',
        )}
      >
        +
      </button>

      <button
        type="button"
        className="canvas-reset"
        onClick={
          onReset
        }
      >
        {t(
          'reset',
        )}
      </button>
    </div>
  )
}
