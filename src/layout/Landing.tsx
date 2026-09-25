import type { AppTheme } from '../types'
import { useI18n, type TranslationKey } from '../i18n'
import type { RecentProject } from '../storage/recentProjects'
import { REPOSITORY_URL, SUPPORT_URL } from '../config'
import { formatDate } from '../ui/format'
import { TopBar } from './TopBar'

interface LandingProps {
  theme: AppTheme
  onToggleTheme: () => void
  onOpenHelp: () => void
  supported: boolean
  /** The example project can be tried in this browser. */
  demoSupported: boolean
  loading: boolean
  recents: RecentProject[]
  onOpenFolder: () => void
  onTryDemo: () => void
  onOpenRecent: (project: RecentProject) => void
  onForgetRecent: (project: RecentProject) => void
}

const STEPS: [TranslationKey, TranslationKey][] = [
  ['landingStep1Title', 'landingStep1Text'],
  ['landingStep2Title', 'landingStep2Text'],
  ['landingStep3Title', 'landingStep3Text'],
  ['landingStep4Title', 'landingStep4Text'],
]

const FEATURES: [TranslationKey, TranslationKey][] = [
  ['featureBoardTitle', 'featureBoardText'],
  ['featureSearchTitle', 'featureSearchText'],
  ['featureSafeTitle', 'featureSafeText'],
  ['featureKeyboardTitle', 'featureKeyboardText'],
  ['featureEverywhereTitle', 'featureEverywhereText'],
  ['featureLocalTitle', 'featureLocalText'],
]

/** What the lenses can read. Product names, the same in every language. */
const STACKS: [TranslationKey, string][] = [
  ['lensWeb', 'React · Vue · Svelte · Next.js · Nuxt · SvelteKit · Astro · Angular'],
  ['lensApi', '.NET · NestJS · Express · Fastify · FastAPI · Flask · Spring'],
  ['lensDb', 'Oracle PL/SQL · PostgreSQL · Supabase · SQL · Prisma'],
]

const AGENTS_LINE =
  'Tasks for this project are in `.bruto/workspace.json`. Work on notes whose status is "todo".'

/** Screenshots of the example project, taken in every language (`npm run shots`). */
const shot = (language: string, name: string) =>
  `${import.meta.env.BASE_URL}landing/${language}/${name}.jpg`

/**
 * The front door: open a project, pick up a recent one, or try the example.
 * Below, what Bruto does, shown with the app itself.
 */
export function Landing({
  theme,
  onToggleTheme,
  onOpenHelp,
  supported,
  demoSupported,
  loading,
  recents,
  onOpenFolder,
  onTryDemo,
  onOpenRecent,
  onForgetRecent,
}: LandingProps) {
  const { t, language } = useI18n()

  const actions = (
    <div className="landing__actions">
      {supported && (
        <button
          type="button"
          className="button button--primary button--large"
          onClick={onOpenFolder}
          disabled={loading}
        >
          {loading ? t('opening') : t('openProjectFolder')}
        </button>
      )}

      {demoSupported && (
        <button
          type="button"
          className="button button--large"
          onClick={onTryDemo}
          disabled={loading}
        >
          {t('tryDemo')}
        </button>
      )}
    </div>
  )

  return (
    <div className="screen">
      <TopBar theme={theme} onToggleTheme={onToggleTheme} onOpenHelp={onOpenHelp} />

      <main className="landing">
        <section className="landing__hero">
          <div className="landing__intro">
            <p className="eyebrow">{t('landingEyebrow')}</p>
            <h1 className="landing__title">BRUTO</h1>
            <p className="landing__lead">{t('landingDescription')}</p>

            {actions}

            {demoSupported && <p className="landing__hint">{t('tryDemoHint')}</p>}

            {!supported && (
              <p className="notice" role="alert">
                {t('browserUnsupported')}
              </p>
            )}
          </div>

          <figure className="landing__shot">
            <img
              src={shot(language, 'board')}
              alt={t('landingShotBoard')}
              width={1440}
              height={900}
            />
          </figure>
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
            {STEPS.map(([title, text], index) => (
              <li key={title} className="steps__item">
                <span className="steps__number" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3>{t(title)}</h3>
                <p>{t(text)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing__feature" aria-labelledby="context-title">
          <div className="landing__feature-text">
            <h2 id="context-title" className="landing__feature-title">
              {t('landingContextTitle')}
            </h2>
            <p>{t('landingContextText')}</p>
          </div>

          <figure className="landing__shot">
            <img
              src={shot(language, 'ai-context')}
              alt={t('landingShotContext')}
              width={1440}
              height={900}
              loading="lazy"
            />
          </figure>
        </section>

        <section className="landing__feature landing__feature--flip" aria-labelledby="lenses-title">
          <div className="landing__feature-text">
            <h2 id="lenses-title" className="landing__feature-title">
              {t('landingLensesTitle')}
            </h2>
            <p>{t('landingLensesText')}</p>

            <dl className="landing__stacks">
              {STACKS.map(([label, names]) => (
                <div key={label}>
                  <dt>{t(label)}</dt>
                  <dd>{names}</dd>
                </div>
              ))}
            </dl>
          </div>

          <figure className="landing__shot">
            <img
              src={shot(language, 'lenses')}
              alt={t('landingShotLenses')}
              width={1440}
              height={900}
              loading="lazy"
            />
          </figure>
        </section>

        <section className="landing__section" aria-labelledby="features-title">
          <h2 id="features-title" className="section-title">
            {t('landingFeaturesTitle')}
          </h2>

          <ul className="landing__features">
            {FEATURES.map(([title, text]) => (
              <li key={title} className="landing__card">
                <h3>{t(title)}</h3>
                <p>{t(text)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="landing__feature" aria-labelledby="any-ai-title">
          <div className="landing__feature-text">
            <h2 id="any-ai-title" className="landing__feature-title">
              {t('landingAnyAiTitle')}
            </h2>
            <p>{t('landingAnyAiText')}</p>
          </div>

          <pre className="landing__code">
            <span className="landing__code-file">AGENTS.md</span>
            <code>{AGENTS_LINE}</code>
          </pre>
        </section>

        <section className="landing__cta" aria-labelledby="cta-title">
          <h2 id="cta-title" className="landing__feature-title">
            {t('landingCtaTitle')}
          </h2>
          <p>{t('landingCtaText')}</p>
          {actions}
        </section>
      </main>

      <footer className="statusbar">
        <span>BRUTO / {t('localFirst')}</span>
        <span className="statusbar__links">
          {t('noCloud')}
          <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
            {t('sourceCode')}
          </a>
          {SUPPORT_URL && (
            <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
              {t('supportProject')}
            </a>
          )}
        </span>
      </footer>
    </div>
  )
}
