import { useI18n } from '../i18n'
import type { SaveStatus } from '../state/workspaceSync'

interface StatusBarProps {
  projectName: string
  status: SaveStatus
  noteCount: number
  onRetry: () => void
  onOverwrite: () => void
}

/** Footer with the save state, always visible so it's clear whether work is on disk. */
export function StatusBar({
  projectName,
  status,
  noteCount,
  onRetry,
  onOverwrite,
}: StatusBarProps) {
  const { t } = useI18n()

  const label = {
    saved: t('saveStatusSaved'),
    saving: t('saveStatusSaving'),
    unsaved: t('saveStatusUnsaved'),
    error: t('saveStatusError'),
    'disk-invalid': t('saveStatusDiskInvalid'),
  }[status.kind]

  return (
    <footer className="statusbar">
      <span>
        BRUTO / {projectName} · {t('notesCount', { count: noteCount })}
      </span>

      <span className={`save-status save-status--${status.kind}`} role="status">
        <span className="save-status__dot" aria-hidden="true" />
        {label}

        {(status.kind === 'error' || status.kind === 'disk-invalid') && (
          <span className="save-status__detail" title={status.message}>
            {status.message}
          </span>
        )}

        {status.kind === 'error' && (
          <button type="button" className="button button--small" onClick={onRetry}>
            {t('retry')}
          </button>
        )}

        {status.kind === 'disk-invalid' && (
          <button
            type="button"
            className="button button--small button--danger"
            onClick={onOverwrite}
          >
            {t('overwriteWithMine')}
          </button>
        )}
      </span>
    </footer>
  )
}
