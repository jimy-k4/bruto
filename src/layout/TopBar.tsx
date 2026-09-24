import type { ReactNode } from 'react'
import type { AppTheme, Language } from '../types'
import { SUPPORT_URL } from '../config'
import { LANGUAGES } from '../domain/constants'
import { useI18n } from '../i18n'
import { useInstallPrompt } from '../ui/installPrompt'

interface TopBarProps {
  theme: AppTheme
  onToggleTheme: () => void
  onOpenHelp: () => void
  /** Project switcher, next to the brand. */
  project?: ReactNode
  /** Workspace buttons, before the language and theme controls. */
  actions?: ReactNode
}

export function TopBar({ theme, onToggleTheme, onOpenHelp, project, actions }: TopBarProps) {
  const { t, language, setLanguage } = useI18n()
  const install = useInstallPrompt()

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="brand-mark" aria-hidden="true">
          B
        </span>
        <span className="brand-name">BRUTO</span>
        {project}
      </div>

      <nav className="topbar__actions" aria-label={t('mainActions')}>
        {install && (
          <button type="button" className="button button--primary" onClick={() => void install()}>
            {t('installApp')}
          </button>
        )}

        {actions}

        <button type="button" className="button" onClick={onOpenHelp}>
          {t('help')}
        </button>

        <label className="select-wrap">
          <span className="visually-hidden">{t('language')}</span>
          <select
            className="select"
            value={language}
            onChange={(event) => setLanguage(event.target.value as Language)}
          >
            {LANGUAGES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="button"
          onClick={onToggleTheme}
          aria-pressed={theme === 'light'}
        >
          {theme === 'dark' ? t('lightMode') : t('darkMode')}
        </button>

        {SUPPORT_URL && (
          <a
            className="button topbar__support"
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('supportProject')}
            title={`${t('supportProject')} (Ko-fi)`}
          >
            <PixelHeart />
          </a>
        )}
      </nav>
    </header>
  )
}

/** A heart built from square pixels, drawn row by row. */
const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...']

function PixelHeart() {
  const pixels = HEART.flatMap((row, y) =>
    [...row].flatMap((cell, x) => (cell === 'X' ? [`M${x} ${y}h1v1h-1z`] : [])),
  )

  return (
    <svg className="pixel-heart" viewBox="0 0 7 6" aria-hidden="true">
      <path d={pixels.join('')} />
    </svg>
  )
}
