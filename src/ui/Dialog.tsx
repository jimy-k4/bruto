import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import { trapTab } from './focus'

interface DialogProps {
  title: ReactNode
  /** Small label above the title. */
  eyebrow?: ReactNode
  description?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'medium' | 'large'
  className?: string
}

/**
 * Modal window: traps focus, closes with Escape or a click on the backdrop and
 * gives focus back to whatever opened it.
 */
export function Dialog({
  title,
  eyebrow,
  description,
  onClose,
  children,
  footer,
  size = 'medium',
  className = '',
}: DialogProps) {
  const { t } = useI18n()
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const panel = panelRef.current!
    const preferred = panel.querySelector<HTMLElement>('[data-autofocus]')

    // Without a main field, focus the window itself so no button looks pressed.
    ;(preferred ?? panel).focus()

    return () => opener?.focus?.()
  }, [])

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current()
      }}
    >
      <section
        ref={panelRef}
        className={`dialog dialog--${size} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            onCloseRef.current()
            return
          }

          trapTab(event, panelRef.current!)
        }}
      >
        <header className="dialog__header">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}

            <h2 id={titleId} className="dialog__title">
              {title}
            </h2>

            {description && (
              <p id={descriptionId} className="dialog__description">
                {description}
              </p>
            )}
          </div>

          <button type="button" className="icon-button" onClick={onClose} aria-label={t('close')}>
            ×
          </button>
        </header>

        <div className="dialog__body">{children}</div>

        {footer && <footer className="dialog__footer">{footer}</footer>}
      </section>
    </div>
  )
}
