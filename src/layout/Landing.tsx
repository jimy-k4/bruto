import type { AppTheme } from '../types'
import { useI18n } from '../i18n'
import type { RecentProject } from '../storage/recentProjects'
import { formatDate } from '../ui/format'
import { TopBar } from './TopBar'

interface LandingProps {
  theme: AppTheme
  onToggleTheme: () => void
  onOpenHelp: () => void
  supported: boolean
  loading: boolean
  recents: RecentProject[]
  onOpenFolder: () => void
  onOpenRecent: (project: RecentProject) => void
  onForgetRecent: (project: RecentProject) => void
}

export function Landing({
  theme,
  onToggleTheme,
  onOpenHelp,
  supported,
  loading,
  recents,
  onOpenFolder,
  onOpenRecent,
  onForgetRecent,
}: LandingProps) {
  const { t, language } = useI18n()

  const steps = [
    { title: t('landingStep1Title'), text: t('landingStep1Text') },
    { title: t('landingStep2Title'), text: t('landingStep2Text') },
    { title: t('landingStep3Title'), text: t('landingStep3Text') },
  ]

  return (
    <div className="screen">
      <TopBar theme={theme} onToggleTheme={onToggleTheme} onOpenHelp={onOpenHelp} />

      <main className="landing">
        <section className="landing__hero">
          <div className="landing__intro">
            <p className="eyebrow">{t('landingEyebrow')}</p>
            <h1 className="landing__title">BRUTO</h1>
            <p className="landing__lead">{t('landingDescription')}</p>

            {supported ? (
              <button
                type="button"
                className="button button--primary button--large"
                onClick={onOpenFolder}
                disabled={loading}
              >
                {loading ? t('opening') : t('openProjectFolder')}
              </button>
            ) : (
              <p className="notice" role="alert">
                {t('browserUnsupported')}
              </p>
            )}
          </div>

          <div className="landing__slabs" aria-hidden="true">
            <span className="slab slab--tall note-color-concrete note-pattern-pinstripe" />
            <span className="slab slab--wide note-color-slate note-pattern-grid" />
            <span className="slab slab--small note-color-oxide note-pattern-raw" />
          </div>
        </section>

        {recents.length > 0 && (
          <section className="landing__section" aria-labelledby="recents-title">
            <h2 id="recents-title" className="section-title">
              {t('recentProjects')}
            </h2>

            <ul className="recent-list">
              {recents.map((project) => (
                <li key={project.id} className="recent-list__item">
                  <button
                    type="button"
                    className="recent-list__open"
                    onClick={() => onOpenRecent(project)}
                    disabled={loading || !supported}
                  >
                    <strong>{project.name.toUpperCase()}</strong>
                    <span>{formatDate(language, project.openedAt, true)}</span>
                  </button>

                  <button
                    type="button"
                    className="icon-button icon-button--small"
                    onClick={() => onForgetRecent(project)}
                    aria-label={t('forgetProject', { name: project.name })}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="landing__section" aria-labelledby="how-title">
          <h2 id="how-title" className="section-title">
            {t('howItWorks')}
          </h2>

          <ol className="steps">
            {steps.map((step, index) => (
              <li key={step.title} className="steps__item">
                <span className="steps__number" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="statusbar">
        <span>BRUTO / {t('localFirst')}</span>
        <span>{t('noCloud')}</span>
      </footer>
    </div>
  )
}
