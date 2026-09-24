import type { Note, Workspace, ContextScope } from '../types'
import type { Translator } from '../i18n/translations'
import { ContextStrips, type ContextStrip } from './ContextStrips'

interface AiContextPanelProps {
  t: Translator
  workspace: Workspace
  selectedNote: Note | null
  selectedNoteId: string | null
  /** Size of the multi-selection
   * on the board, when one exists.
   * Lets the panel say how many
   * notes a copy will include. */
  selectedNoteCount: number
  /** Backgrounds for CCuN/CCoN,
   * derived from the selected note
   * and its connected notes. */
  aiContextStyles: {
    current: ContextStrip[]
    connected: ContextStrip[]
  }
  copiedContext: ContextScope | null
  aiContextDraft: string
  savingAiContext: boolean
  onAiContextDraftChange: (value: string) => void
  onCopyContext: (scope: ContextScope) => void
  onClose: () => void
  onSave: () => void
}

export function AiContextPanel({
  t,
  workspace,
  selectedNote,
  selectedNoteId,
  selectedNoteCount,
  aiContextStyles,
  copiedContext,
  aiContextDraft,
  savingAiContext,
  onAiContextDraftChange,
  onCopyContext,
  onClose,
  onSave,
}: AiContextPanelProps) {
  return (
    <div
      className="ai-context-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section className="ai-context-window">
        <header className="ai-context-window-header">
          <div>
            <p className="sidebar-label">{t('aiContextWindow')}</p>

            <h2 className="ai-context-window-title">{workspace.title.toUpperCase()}</h2>

            <p>{t('aiContextWindowDescription')}</p>
          </div>

          <button className="note-editor-close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="ai-context-window-actions">
          <div className="ai-context-scope-card">
            <span>{t('selectedNote')}</span>

            <strong>
              {selectedNoteCount > 1
                ? `${selectedNoteCount} × ${t('notes')}`
                : selectedNote
                  ? selectedNote.title.trim() || t('untitled')
                  : t('notSelected')}
            </strong>
          </div>

          <button
            type="button"
            className="ai-context-action"
            onClick={() => onCopyContext('entire')}
          >
            <span>{t('entireContextLabel')}</span>

            <strong>
              {copiedContext === 'entire' ? t('copiedContext') : t('copyEntireContext')}
            </strong>
          </button>

          <button
            type="button"
            className="ai-context-action context-painted"
            disabled={!selectedNoteId}
            onClick={() => onCopyContext('current')}
          >
            <ContextStrips strips={aiContextStyles.current} />

            <span>{t('currentContext')}</span>

            <strong>
              {copiedContext === 'current' ? t('copiedContext') : t('copyCurrentNote')}
            </strong>
          </button>

          <button
            type="button"
            className="ai-context-action context-painted"
            disabled={!selectedNoteId}
            onClick={() => onCopyContext('connected')}
          >
            <ContextStrips strips={aiContextStyles.connected} />

            <span>{t('connectedContextLabel')}</span>

            <strong>
              {copiedContext === 'connected' ? t('copiedContext') : t('copyConnectedContext')}
            </strong>
          </button>
        </div>

        <div className="ai-context-window-content">
          <div className="ai-context-window-editor">
            <label>
              <span>{t('globalProjectContext')}</span>

              <textarea
                className="ai-context-window-textarea"
                value={aiContextDraft}
                onChange={(event) => onAiContextDraftChange(event.target.value)}
                spellCheck={false}
                placeholder={t('aiContextPlaceholder')}
              />
            </label>
          </div>

          <div className="ai-context-window-info">
            <div>
              <span>{t('documentation')}</span>

              <strong>{workspace.documentation.length}</strong>
            </div>

            <div>
              <span>{t('notes')}</span>

              <strong>{workspace.notes.length}</strong>
            </div>

            <div>
              <span>{t('connections')}</span>

              <strong>{workspace.connections.length}</strong>
            </div>
          </div>
        </div>

        <footer className="ai-context-window-footer">
          <button className="secondary-button" onClick={onClose} disabled={savingAiContext}>
            {t('close')}
          </button>

          <button className="primary-button" onClick={onSave} disabled={savingAiContext}>
            {savingAiContext ? t('saving') : t('saveGlobalContext')}
          </button>
        </footer>
      </section>
    </div>
  )
}
