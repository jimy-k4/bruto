import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import { isNumberBetween, usePreference } from '../preferences'

interface SidePanelProps {
  title: ReactNode
  eyebrow?: ReactNode
  /** Extra classes for the header, e.g. to paint it like the note being edited. */
  headerClassName?: string
  headerAside?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** Focus this panel's first field when it opens. */
  autoFocus?: boolean
}

const MIN_WIDTH = 320
const MAX_WIDTH = 760

/**
 * Resizable editor docked on the right. Not modal: the board stays usable, so
 * notes can be dragged or selected while a note is open.
 */
export function SidePanel({
  title,
  eyebrow,
  headerClassName = '',
  headerAside,
  onClose,
  children,
  footer,
  autoFocus = true,
}: SidePanelProps) {
  const { t } = useI18n()
  const titleId = useId()
  const panelRef = useRef<HTMLElement>(null)
  const [width, setWidth] = usePreference(
    'bruto-editor-width',
    400,
    isNumberBetween(MIN_WIDTH, MAX_WIDTH),
  )

  useEffect(() => {
    if (!autoFocus) return

    const panel = panelRef.current!
    const target =
      panel.querySelector<HTMLElement>('[data-autofocus]') ??
      panel.querySelector<HTMLElement>('input, textarea, select')

    target?.focus()
  }, [autoFocus])

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()

    const startX = event.clientX
    const startWidth = width
    const handle = event.currentTarget

    handle.setPointerCapture(event.pointerId)

    const move = (moveEvent: PointerEvent) => {
      const next = startWidth + (startX - moveEvent.clientX)

      setWidth(Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next))))
    }

    const stop = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', stop)
      handle.removeEventListener('pointercancel', stop)
    }

    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', stop)
    handle.addEventListener('pointercancel', stop)
  }

  return (
    <aside
      ref={panelRef}
      className="side-panel"
      style={{ width }}
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <div
        className="side-panel__resize"
        role="separator"
        aria-orientation="vertical"
        aria-label={t('resizePanel')}
        onPointerDown={startResize}
      />

      <header className={`side-panel__header ${headerClassName}`}>
        <div className="side-panel__heading">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}

          <h2 id={titleId} className="side-panel__title">
            {title}
          </h2>
        </div>

        {headerAside}

        <button type="button" className="icon-button" onClick={onClose} aria-label={t('close')}>
          ×
        </button>
      </header>

      <div className="side-panel__body">{children}</div>

      {footer && <footer className="side-panel__footer">{footer}</footer>}
    </aside>
  )
}
