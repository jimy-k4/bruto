import type { Translator } from '../i18n/translations'

interface CanvasEmptyStateProps {
  t: Translator
  creatingNote: boolean
  onCreateNote: () => void
}

export function CanvasEmptyState({ t, creatingNote, onCreateNote }: CanvasEmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-mark">+</div>

      <h2>{t('workspaceEmpty')}</h2>

      <p>{t('workspaceEmptyDescription')}</p>

      <button className="create-button" onClick={onCreateNote} disabled={creatingNote}>
        {creatingNote ? t('creating') : t('createFirstNote')}
      </button>
    </div>
  )
}
