import type {
  NoteColorTheme,
  NotePattern,
  NoteStatus,
  StatusStyleConfig,
  Workspace,
} from '../types'
import type { Translator } from '../i18n/translations'
import { noteStatuses } from '../lib/statusLabels'
import { getNoteStatusLabel } from '../lib/statusLabels'

const colorOptions: NoteColorTheme[] = [
  'concrete',
  'sand',
  'ochre',
  'oxide',
  'wine',
  'cobalt',
  'teal',
  'moss',
  'plum',
  'slate',
  'bark',
  'indigo',
]

const patternOptions: NotePattern[] = [
  'raw',
  'grid',
  'hatch',
  'bands',
  'dots',
  'cross',
  'waves',
  'checker',
  'pinstripe',
  'diag',
  'weave',
  'triangle',
]

interface StatusStylePanelProps {
  workspace: Workspace
  t: Translator
  onConfigureStatus: (
    status: NoteStatus,
    config: StatusStyleConfig | undefined,
  ) => void
  onClose: () => void
}

/**
 * Top-bar panel where the user
 * configures how notes look per
 * status. Empty configuration
 * means notes keep their own
 * color and pattern.
 */
export function StatusStylePanel({
  workspace,
  t,
  onConfigureStatus,
  onClose,
}: StatusStylePanelProps) {
  const statusStyles =
    workspace.statusStyles ?? {}

  return (
    <div className="status-style-overlay">
      <section
        className="status-style-panel"
        role="dialog"
        aria-modal="true"
      >
        <header className="status-style-header">
          <h2>
            {t(
              'statusStyleTitle',
            )}
          </h2>

          <button
            type="button"
            className="note-editor-close"
            onClick={onClose}
            aria-label={t('cancel')}
          >
            ✕
          </button>
        </header>

        <p className="status-style-intro">
          {t(
            'statusStyleIntro',
          )}
        </p>

        <div className="status-style-rows">
          {noteStatuses.map(
            (status) => {
              const config =
                statusStyles[status]

              return (
                <div
                  key={status}
                  className="status-style-row"
                >
                  <span className="status-style-status">
                    {getNoteStatusLabel(
                      status,
                      t,
                    )}
                  </span>

                  <div className="status-style-configs">
                    <div className="status-style-field">
                      <span className="status-style-field-label">
                        {t(
                          'color',
                        )}
                      </span>

                      <div className="note-style-options">
                        {colorOptions.map(
                          (color) => (
                            <button
                              key={color}
                              type="button"
                              title={color}
                              className={`note-style-option note-style-color-${color} ${
                                config?.color ===
                                color
                                  ? 'note-style-option-selected'
                                  : ''
                              }`}
                              onClick={() =>
                                onConfigureStatus(
                                  status,
                                  {
                                    ...config,
                                    color,
                                  },
                                )
                              }
                            >
                              <span />
                            </button>
                          ),
                        )}

                        {config?.color && (
                          <button
                            type="button"
                            title={t(
                              'statusStyleClearColor',
                            )}
                            className="status-style-clear"
                            onClick={() =>
                              onConfigureStatus(
                                status,
                                {
                                  pattern:
                                    config.pattern,
                                },
                              )
                            }
                          >
                            ⌫
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="status-style-field">
                      <span className="status-style-field-label">
                        {t(
                          'pattern',
                        )}
                      </span>

                      <div className="note-style-options">
                        {patternOptions.map(
                          (pattern) => (
                            <button
                              key={pattern}
                              type="button"
                              title={pattern}
                              className={`note-style-option note-style-color-concrete note-pattern-${pattern} ${
                                config?.pattern ===
                                pattern
                                  ? 'note-style-option-selected'
                                  : ''
                              }`}
                              onClick={() =>
                                onConfigureStatus(
                                  status,
                                  {
                                    ...config,
                                    pattern,
                                  },
                                )
                              }
                            >
                              <span />
                            </button>
                          ),
                        )}

                        {config?.pattern && (
                          <button
                            type="button"
                            title={t(
                              'statusStyleClearPattern',
                            )}
                            className="status-style-clear"
                            onClick={() =>
                              onConfigureStatus(
                                status,
                                {
                                  color: config.color,
                                },
                              )
                            }
                          >
                            ⌫
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            },
          )}
        </div>
      </section>
    </div>
  )
}
