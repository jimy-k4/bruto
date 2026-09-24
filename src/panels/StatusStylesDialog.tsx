import type { NoteStatus, StatusStyleConfig, StatusStyles } from '../types'
import { NOTE_STATUSES } from '../domain/constants'
import { statusLabel, useI18n } from '../i18n'
import { Dialog } from '../ui/Dialog'
import { ColorPicker, PatternPicker } from '../ui/StylePicker'

interface StatusStylesDialogProps {
  styles: StatusStyles | undefined
  onChange: (status: NoteStatus, config: StatusStyleConfig | undefined) => void
  onClose: () => void
}

/** The look a note takes when it changes to each status. */
export function StatusStylesDialog({ styles, onChange, onClose }: StatusStylesDialogProps) {
  const { t } = useI18n()

  return (
    <Dialog
      size="large"
      eyebrow={t('styles')}
      title={t('statusStylesTitle')}
      description={t('statusStylesDescription')}
      onClose={onClose}
    >
      <ul className="status-styles">
        {NOTE_STATUSES.map((status) => {
          const config = styles?.[status] ?? {}
          const preview = { color: config.color ?? 'concrete', pattern: config.pattern ?? 'raw' }

          return (
            <li key={status} className="status-styles__row">
              <div className="status-styles__head">
                <span
                  className={`status-styles__preview note-color-${preview.color} note-pattern-${preview.pattern}`}
                  aria-hidden="true"
                />
                <h3 className={`status-badge status-badge--${status}`}>{statusLabel(t, status)}</h3>

                {(config.color || config.pattern) && (
                  <button
                    type="button"
                    className="button button--small"
                    onClick={() => onChange(status, undefined)}
                  >
                    {t('clearStyle')}
                  </button>
                )}
              </div>

              <ColorPicker
                label={t('color')}
                value={config.color}
                preview={preview}
                onChange={(color) => onChange(status, { ...config, color })}
              />

              <PatternPicker
                label={t('pattern')}
                value={config.pattern}
                preview={preview}
                onChange={(pattern) => onChange(status, { ...config, pattern })}
              />
            </li>
          )
        })}
      </ul>
    </Dialog>
  )
}
