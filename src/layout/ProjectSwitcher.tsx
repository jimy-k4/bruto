import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import type { ProjectTab } from '../state/useProjects'
import type { RecentProject } from '../storage/recentProjects'
import { formatDate } from '../ui/format'

interface ProjectSwitcherProps {
  current: ProjectTab
  tabs: ProjectTab[]
  onSwitch: (id: string) => void
  onOpen: () => void
  onClose: (id: string) => void
  recents: RecentProject[]
  onOpenRecent: (recent: RecentProject) => void
}

/** Recent projects listed in the menu; the landing page keeps the full list. */
const MAX_RECENTS = 8

/** Header menu with every open project (Alt+1…9 jumps straight to one) and the recent ones. */
export function ProjectSwitcher({
  current,
  tabs,
  onSwitch,
  onOpen,
  onClose,
  recents,
  onOpenRecent,
}: ProjectSwitcherProps) {
  const { t, language } = useI18n()
  const [open, setOpen] = useState(false)
  // Projects opened before and not open now: the ones worth offering again.
  const closedRecents = recents
    .filter((recent) => !tabs.some((tab) => tab.id === recent.id))
    .slice(0, MAX_RECENTS)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)

    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div
      className="project-switcher"
      ref={rootRef}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation()
          close()
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="project-switcher__trigger"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true">/</span> {current.name}
        <span className="project-switcher__caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className="project-switcher__menu">
          <p className="eyebrow">{t('openProjects')}</p>

          <ul>
            {tabs.map((tab, index) => (
              <li key={tab.id} className="project-switcher__row">
                <button
                  type="button"
                  className="project-switcher__project"
                  aria-current={tab.id === current.id ? 'true' : undefined}
                  onClick={() => {
                    setOpen(false)
                    onSwitch(tab.id)
                  }}
                >
                  <span>{tab.name}</span>
                  {index < 9 && <kbd>Alt {index + 1}</kbd>}
                </button>

                <button
                  type="button"
                  className="icon-button icon-button--small"
                  aria-label={t('closeProjectNamed', { name: tab.name })}
                  onClick={() => {
                    setOpen(false)
                    onClose(tab.id)
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          {closedRecents.length > 0 && (
            <>
              <p className="eyebrow">{t('recentProjects')}</p>

              <ul>
                {closedRecents.map((recent) => (
                  <li key={recent.id}>
                    <button
                      type="button"
                      className="project-switcher__project project-switcher__project--recent"
                      onClick={() => {
                        setOpen(false)
                        onOpenRecent(recent)
                      }}
                    >
                      <span>{recent.name}</span>
                      <time dateTime={new Date(recent.openedAt).toISOString()}>
                        {formatDate(language, recent.openedAt)}
                      </time>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          <button
            type="button"
            className="button button--block"
            onClick={() => {
              setOpen(false)
              onOpen()
            }}
          >
            + {t('openProject')}
          </button>
        </div>
      )}
    </div>
  )
}
