import { ZOOM_MAX, ZOOM_MIN } from '../domain/constants'
import { useI18n } from '../i18n'

const stop = (event: React.PointerEvent) => event.stopPropagation()

export function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}) {
  const { t } = useI18n()

  return (
    <div className="zoom-controls" role="group" aria-label={t('zoom')} onPointerDown={stop}>
      <button
        type="button"
        onClick={onZoomOut}
        disabled={zoom <= ZOOM_MIN}
        aria-label={t('zoomOut')}
      >
        −
      </button>
      <button type="button" onClick={onReset} aria-label={t('resetView')} title={t('resetView')}>
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" onClick={onZoomIn} disabled={zoom >= ZOOM_MAX} aria-label={t('zoomIn')}>
        +
      </button>
    </div>
  )
}

export function EmptyBoard({ onCreate }: { onCreate: () => void }) {
  const { t } = useI18n()

  return (
    <div className="empty-board">
      <p className="eyebrow">{t('emptyBoardEyebrow')}</p>
      <h2 className="empty-board__title">{t('emptyBoardTitle')}</h2>
      <p>{t('emptyBoardText')}</p>
      <button
        type="button"
        className="button button--primary"
        onClick={onCreate}
        onPointerDown={stop}
      >
        {t('createFirstNote')} <kbd>N</kbd>
      </button>
    </div>
  )
}

export function NewNoteButton({ onCreate }: { onCreate: () => void }) {
  const { t } = useI18n()

  return (
    <button
      type="button"
      className="new-note-button"
      onClick={onCreate}
      onPointerDown={stop}
      aria-label={t('newNote')}
      title={`${t('newNote')} (N)`}
    >
      +
    </button>
  )
}

/** Actions for several selected notes, so they're discoverable without shortcuts. */
export function SelectionBar({
  count,
  onEdit,
  onCopyContext,
  onDuplicate,
  onDelete,
  onClear,
}: {
  count: number
  onEdit: () => void
  onCopyContext: () => void
  onDuplicate: () => void
  onDelete: () => void
  onClear: () => void
}) {
  const { t } = useI18n()

  return (
    <div
      className="selection-bar"
      role="toolbar"
      aria-label={t('selectionActions')}
      onPointerDown={stop}
    >
      <strong>{t('notesCount', { count })}</strong>
      <button type="button" className="button button--small" onClick={onEdit}>
        {t('edit')}
      </button>
      <button type="button" className="button button--small" onClick={onCopyContext}>
        {t('copyCurrent')} <kbd>Q</kbd>
      </button>
      <button type="button" className="button button--small" onClick={onDuplicate}>
        {t('duplicate')}
      </button>
      <button type="button" className="button button--small button--danger" onClick={onDelete}>
        {t('delete')}
      </button>
      <button
        type="button"
        className="icon-button icon-button--small"
        onClick={onClear}
        aria-label={t('clearSelection')}
      >
        ×
      </button>
    </div>
  )
}
