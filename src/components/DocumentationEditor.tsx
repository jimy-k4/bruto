import type { CSSProperties } from 'react'
import type { WorkspaceDocumentation } from '../types'
import type { Translator } from '../i18n/translations'

interface DocumentationEditorProps {
  t: Translator
  editorStyle: CSSProperties
  documentationDraft: WorkspaceDocumentation
  documentationExists: boolean
  savingDocumentation: boolean
  onDraftChange: (draft: WorkspaceDocumentation) => void
  onClose: () => void
  onSave: () => void
  onDelete: () => void
  onStartResize: (event: React.MouseEvent<HTMLDivElement>) => void
}

export function DocumentationEditor({
  t,
  editorStyle,
  documentationDraft,
  documentationExists,
  savingDocumentation,
  onDraftChange,
  onClose,
  onSave,
  onDelete,
  onStartResize,
}: DocumentationEditorProps) {
  return (
    <aside className="note-editor documentation-editor" style={editorStyle}>
      <div className="editor-resize-handle" onMouseDown={onStartResize} />

      <div className="note-editor-header">
        <div>
          <p className="sidebar-label">{t('documentation')}</p>

          <span className="note-editor-id">{t('documentationReference')}</span>
        </div>

        <button className="note-editor-close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="note-editor-content">
        <label>
          <span>{t('name')}</span>

          <input
            type="text"
            value={documentationDraft.name}
            onChange={(event) =>
              onDraftChange({
                ...documentationDraft,
                name: event.target.value,
              })
            }
            autoFocus
          />
        </label>

        <label>
          <span>{t('type')}</span>

          <select
            value={documentationDraft.type}
            onChange={(event) =>
              onDraftChange({
                ...documentationDraft,
                type: event.target.value as WorkspaceDocumentation['type'],
              })
            }
          >
            <option value="obsidian">{t('documentationTypeObsidian')}</option>

            <option value="notion">{t('documentationTypeNotion')}</option>

            <option value="web">{t('documentationTypeWeb')}</option>

            <option value="other">{t('documentationTypeOther')}</option>
          </select>
        </label>

        <label>
          <span>{t('link')}</span>

          <input
            type="text"
            value={documentationDraft.url}
            onChange={(event) =>
              onDraftChange({
                ...documentationDraft,
                url: event.target.value,
              })
            }
            placeholder="https://... / obsidian://..."
          />
        </label>

        <div className="editor-placeholder">
          <span>{t('reference')}</span>

          <p>{t('referenceHelp')}</p>
        </div>
      </div>

      <div className="note-editor-actions">
        <button className="secondary-button" onClick={onClose} disabled={savingDocumentation}>
          {t('cancel')}
        </button>

        <button
          className="primary-button editor-save"
          onClick={onSave}
          disabled={savingDocumentation}
        >
          {savingDocumentation ? t('saving') : t('saveDocumentation')}
        </button>
      </div>

      {documentationExists && (
        <div className="note-editor-danger">
          <button className="delete-button" onClick={onDelete}>
            {t('deleteReference')}
          </button>
        </div>
      )}
    </aside>
  )
}
