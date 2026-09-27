import { REPOSITORY_URL } from '../config'
import { useI18n, type TranslationKey } from '../i18n'
import { Dialog } from '../ui/Dialog'

/** What the published site measures, and what it never does: the promise the landing makes. */
const SECTIONS: [TranslationKey, TranslationKey][] = [
  ['privacyMeasureTitle', 'privacyMeasureText'],
  ['privacyNotTitle', 'privacyNotText'],
  ['privacyWhereTitle', 'privacyWhereText'],
  ['privacyRightsTitle', 'privacyRightsText'],
]

export function PrivacyDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()

  return (
    <Dialog
      eyebrow="BRUTO"
      title={t('privacyTitle')}
      description={t('privacyIntro')}
      onClose={onClose}
    >
      <div className="privacy">
        {SECTIONS.map(([title, text]) => (
          <section key={title} className="privacy__section">
            <h3 className="eyebrow">{t(title)}</h3>
            <p>{t(text)}</p>
          </section>
        ))}

        <a
          className="button button--small"
          href={`${REPOSITORY_URL}/issues`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('privacyContact')}
        </a>
      </div>
    </Dialog>
  )
}
