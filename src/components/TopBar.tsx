import type { ReactNode } from 'react'
import type { AppTheme, Language } from '../types'
import type { Translator } from '../i18n/translations'

interface TopBarSharedProps {
  theme: AppTheme
  language: Language
  t: Translator
  onLanguageChange: (
    language: Language,
  ) => void
  onToggleTheme: () => void
  onOpenHelp: () => void
}

const languageOptions: {
  value: Language
  label: string
}[] = [
  {
    value: 'es',
    label: 'ES',
  },
  {
    value: 'en',
    label: 'EN',
  },
  {
    value: 'ja',
    label: '日本語',
  },
  {
    value: 'ru',
    label: 'RU',
  },
  {
    value: 'zh',
    label: '中文',
  },
  {
    value: 'ca',
    label: 'CA',
  },
  {
    value: 'fr',
    label: 'FR',
  },
  {
    value: 'de',
    label: 'DE',
  },
  {
    value: 'pt-BR',
    label: 'PT-BR',
  },
]

export function LandingTopBar({
  theme,
  language,
  t,
  onLanguageChange,
  onToggleTheme,
  onOpenHelp,
}: TopBarSharedProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">
          B
        </div>

        <div className="brand-name">
          BRUTO
        </div>
      </div>

      <div className="topbar-actions">
        <button
          type="button"
          className="theme-toggle"
          onClick={
            onOpenHelp
          }
        >
          {t(
            'help',
          )}
        </button>

        <select
          className="language-select"
          value={
            language
          }
          onChange={(
            event,
          ) =>
            onLanguageChange(
              event.target
                .value as Language,
            )
          }
          aria-label={
            t(
              'language',
            )
          }
        >
          {languageOptions.map(
            (
              option,
            ) => (
              <option
                key={
                  option.value
                }
                value={
                  option.value
                }
              >
                {
                  option.label
                }
              </option>
            ),
          )}
        </select>

        <button
          type="button"
          className="theme-toggle"
          onClick={
            onToggleTheme
          }
        >
          {theme ===
          'dark'
            ? t(
                'lightMode',
              )
            : t(
                'darkMode',
              )}
        </button>

        <div className="topbar-status">
          <span>
            {t(
              'local',
            )}
          </span>

          <span>
            {t(
              'offline',
            )}
          </span>
        </div>
      </div>
    </header>
  )
}

interface WorkspaceTopBarProps
  extends TopBarSharedProps {
  projectName: string | null
  /** Header project switcher
   * (replaces the plain project
   * name when projects are open). */
  projectSwitcher?: ReactNode
  onOpenDirectory: () => void
  onOpenStatusStyles: () => void
}

export function WorkspaceTopBar({
  theme,
  language,
  t,
  onLanguageChange,
  onToggleTheme,
  onOpenHelp,
  projectName,
  projectSwitcher,
  onOpenDirectory,
  onOpenStatusStyles,
}: WorkspaceTopBarProps) {
  return (
    <header className="topbar workspace-topbar">
      <div className="brand">
        <div className="brand-mark">
          B
        </div>

        <div className="brand-name">
          BRUTO
        </div>

        {projectSwitcher ? (
          projectSwitcher
        ) : (
          projectName && (
            <div className="project-name">
              /{' '}
              {projectName.toUpperCase()}
            </div>
          )
        )}
      </div>

      <div className="topbar-actions">
        <button
          type="button"
          className="theme-toggle"
          onClick={
            onOpenStatusStyles
          }
        >
          {t(
            'statusStyles',
          )}
        </button>

        <button
          type="button"
          className="theme-toggle"
          onClick={
            onOpenDirectory
          }
        >
          {t(
            'directory',
          )}
        </button>

        <button
          type="button"
          className="theme-toggle"
          onClick={
            onOpenHelp
          }
        >
          {t(
            'help',
          )}
        </button>

        <select
          className="language-select"
          value={
            language
          }
          onChange={(
            event,
          ) =>
            onLanguageChange(
              event.target
                .value as Language,
            )
          }
          aria-label={
            t(
              'language',
            )
          }
        >
          {languageOptions.map(
            (
              option,
            ) => (
              <option
                key={
                  option.value
                }
                value={
                  option.value
                }
              >
                {
                  option.label
                }
              </option>
            ),
          )}
        </select>

        <button
          type="button"
          className="theme-toggle"
          onClick={
            onToggleTheme
          }
        >
          {theme ===
          'dark'
            ? t(
                'lightMode',
              )
            : t(
                'darkMode',
              )}
        </button>

        <div className="topbar-status">
          <span>
            {t(
              'local',
            )}
          </span>

          <span>
            {t(
              'offline',
            )}
          </span>
        </div>
      </div>
    </header>
  )
}
