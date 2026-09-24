import { useState } from 'react'
import { useI18n } from '../i18n'
import { useNewVersion } from './useNewVersion'

/**
 * Says so when a newer Bruto is published while this one is open. Reloading
 * is the user's call: they may be in the middle of something.
 */
export function UpdateNotice({ onReload }: { onReload: () => void }) {
  const { t } = useI18n()
  const available = useNewVersion()
  const [dismissed, setDismissed] = useState(false)

  if (!available || dismissed) return null

  return (
    <div className="update-notice" role="status">
      <span>{t('newVersionAvailable')}</span>
      <button type="button" className="update-notice__button" onClick={onReload}>
        {t('reloadApp')}
      </button>
      <button
        type="button"
        className="update-notice__button"
        onClick={() => setDismissed(true)}
        aria-label={t('close')}
        title={t('close')}
      >
        ×
      </button>
    </div>
  )
}
