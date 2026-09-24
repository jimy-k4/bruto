import type { ReactNode } from 'react'
import type { AppTheme, Language } from '../types'
import { LANGUAGES } from '../domain/constants'
import { useI18n } from '../i18n'

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
      </nav>
    </header>
  )
}
