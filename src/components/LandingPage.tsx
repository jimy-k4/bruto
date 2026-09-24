import type { AppTheme, Language } from '../types'
import type { Translator } from '../i18n/translations'
import { LandingTopBar } from './TopBar'
import { HelpOverlay } from './HelpOverlay'

interface LandingPageProps {
  theme: AppTheme
  language: Language
  t: Translator
  loading: boolean
  helpOpen: boolean
  helpSearch: string
  onLanguageChange: (
    language: Language,
  ) => void
  onToggleTheme: () => void
  onOpenHelp: () => void
  onHelpSearchChange: (
    value: string,
  ) => void
  onCloseHelp: () => void
  onOpenProject: () => void
}

export function LandingPage({
  theme,
  language,
  t,
  loading,
  helpOpen,
  helpSearch,
  onLanguageChange,
  onToggleTheme,
  onOpenHelp,
  onHelpSearchChange,
  onCloseHelp,
  onOpenProject,
}: LandingPageProps) {
  return (
    <>
      <main
        className="app"
        data-theme={
          theme
        }
      >
        <LandingTopBar
          theme={
            theme
          }
          language={
            language
          }
          t={t}
          onLanguageChange={
            onLanguageChange
          }
          onToggleTheme={
            onToggleTheme
          }
          onOpenHelp={
            onOpenHelp
          }
        />

        <section className="hero">
          <div className="hero-content">
            <p className="eyebrow">
              {t(
                'landingEyebrow',
              )}
            </p>

            <h1>
              BRUTO

              <span>
                {t(
                  'landingSubtitle',
                )}
              </span>
            </h1>

            <p className="hero-description">
              {t(
                'landingDescription',
              )}
            </p>

            <button
              className="primary-button"
              onClick={
                onOpenProject
              }
              disabled={
                loading
              }
            >
              {loading
                ? t(
                    'opening',
                  )
                : t(
                    'openProject',
                  )}
            </button>
          </div>

          <div className="hero-decoration">
            <div className="concrete-block block-one" />
            <div className="concrete-block block-two" />
            <div className="concrete-block block-three" />
          </div>
        </section>

        <footer className="footer">
          <span>
            BRUTO /{' '}
            {t(
              'localFirst',
            )}
          </span>

          <span>
            {t(
              'noCloudRequired',
            )}
          </span>
        </footer>
      </main>

      {helpOpen && (
        <HelpOverlay
          t={t}
          helpSearch={
            helpSearch
          }
          onHelpSearchChange={
            onHelpSearchChange
          }
          onClose={
            onCloseHelp
          }
        />
      )}
    </>
  )
}
