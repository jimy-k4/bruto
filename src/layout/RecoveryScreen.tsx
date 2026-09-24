import { useI18n } from '../i18n'
import type { Recovery } from '../state/useProjects'

interface RecoveryScreenProps {
  recovery: Recovery
  loading: boolean
  onRetry: () => void
  onRestore: () => void
  onCancel: () => void
}

/** Shown when `workspace.json` can't be read. Nothing is overwritten until the user chooses. */
export function RecoveryScreen({
  recovery,
  loading,
  onRetry,
  onRestore,
  onCancel,
}: RecoveryScreenProps) {
  const { t } = useI18n()

  return (
    <div className="screen">
      <main className="recovery" aria-labelledby="recovery-title">
        <p className="eyebrow">{recovery.tab.name}</p>
        <h1 id="recovery-title" className="recovery__title">
          {t('recoveryTitle')}
        </h1>
        <p>{t('recoveryText')}</p>

        <pre className="recovery__error">
          .bruto/workspace.json{'\n'}
          {recovery.error}
        </pre>

        <p>{t('recoveryHint')}</p>

        <div className="recovery__actions">
          <button
            type="button"
            className="button button--primary"
            onClick={onRetry}
            disabled={loading}
          >
            {t('retry')}
          </button>

          {recovery.backup && (
            <button type="button" className="button" onClick={onRestore} disabled={loading}>
              {t('restoreBackup', { name: recovery.backup.name })}
            </button>
          )}

          <button type="button" className="button" onClick={onCancel} disabled={loading}>
            {t('back')}
          </button>
        </div>
      </main>
    </div>
  )
}
