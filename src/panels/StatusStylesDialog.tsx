import { useEffect, useState } from 'react'
import type { NoteStatus, StatusStyleConfig, StatusStyles } from '../types'
import { NOTE_STATUSES } from '../domain/constants'
import { statusLabel, useI18n } from '../i18n'
import { useProjectRoot } from '../state/projectRoot'
import { listRecentProjects, type RecentProject } from '../storage/recentProjects'
import { Dialog } from '../ui/Dialog'
import { ColorPicker, PatternPicker } from '../ui/StylePicker'

interface StatusStylesDialogProps {
  styles: StatusStyles | undefined
  onChange: (status: NoteStatus, config: StatusStyleConfig | undefined) => void
  /** Copies every status look from the board of another folder. */
  onCopyFrom: (source: FileSystemDirectoryHandle) => void
  onPickSource: () => void
  onClose: () => void
}

/** The look a note takes when it changes to each status. */
export function StatusStylesDialog({
  styles,
  onChange,
  onCopyFrom,
  onPickSource,
  onClose,
}: StatusStylesDialogProps) {
  const { t } = useI18n()
  const root = useProjectRoot()
  const [sources, setSources] = useState<RecentProject[]>([])

  // Other projects opened before: one click to take their look.
  useEffect(() => {
    let cancelled = false

    listRecentProjects().then(async (projects) => {
      const others: RecentProject[] = []

      for (const project of projects) {
        if (!(await project.handle.isSameEntry(root).catch(() => false))) others.push(project)
      }

      if (!cancelled) setSources(others)
    })

    return () => {
      cancelled = true
    }
  }, [root])

  return (
    <Dialog
      size="large"
      eyebrow={t('styles')}
      title={t('statusStylesTitle')}
      description={t('statusStylesDescription')}
      onClose={onClose}
    >
      <section className="styles-import" aria-labelledby="styles-import-title">
        <h3 id="styles-import-title" className="eyebrow">
          {t('copyStylesFrom')}
        </h3>
        <p className="field__hint">{t('copyStylesHint')}</p>
        <div className="styles-import__sources">
          {sources.map((source) => (
            <button
              key={source.id}
              type="button"
              className="button button--small"
              onClick={() => onCopyFrom(source.handle)}
            >
              {source.name}
            </button>
          ))}
          <button type="button" className="button button--small" onClick={onPickSource}>
            {t('otherFolder')}
          </button>
        </div>
      </section>

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
