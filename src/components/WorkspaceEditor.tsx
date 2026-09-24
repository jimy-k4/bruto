import type { CSSProperties } from 'react'
import type { Translator } from '../i18n/translations'

interface WorkspaceEditorProps {
  t: Translator
  editorStyle: CSSProperties
  projectName: string | null
  workspaceTitleDraft: string
  workspaceDescriptionDraft: string
  savingWorkspaceInfo: boolean
  onTitleDraftChange: (
    value: string,
  ) => void
  onDescriptionDraftChange: (
    value: string,
  ) => void
  onClose: () => void
  onSave: () => void
  onStartResize: (
    event: React.MouseEvent<HTMLDivElement>,
  ) => void
}

export function WorkspaceEditor({
  t,
  editorStyle,
  projectName,
  workspaceTitleDraft,
  workspaceDescriptionDraft,
  savingWorkspaceInfo,
  onTitleDraftChange,
  onDescriptionDraftChange,
  onClose,
  onSave,
  onStartResize,
}: WorkspaceEditorProps) {
  return (
    <aside
      className="note-editor workspace-editor"
      style={
        editorStyle
      }
    >
      <div
        className="editor-resize-handle"
        onMouseDown={
          onStartResize
        }
      />

      <div className="note-editor-header">
        <div>
          <p className="sidebar-label">
            {t(
              'editWorkspace',
            )}
          </p>

          <span className="note-editor-id">
            {t(
              'projectInformation',
            )}
          </span>
        </div>

        <button
          className="note-editor-close"
          onClick={
            onClose
          }
        >
          ×
        </button>
      </div>

      <div className="note-editor-content">
        <label>
          <span>
            {t(
              'title',
            )}
          </span>

          <input
            type="text"
            value={
              workspaceTitleDraft
            }
            onChange={(
              event,
            ) =>
              onTitleDraftChange(
                event.target.value,
              )
            }
            autoFocus
          />
        </label>

        <label>
          <span>
            {t(
              'description',
            )}
          </span>

          <textarea
            value={
              workspaceDescriptionDraft
            }
            onChange={(
              event,
            ) =>
              onDescriptionDraftChange(
                event.target.value,
              )
            }
            rows={10}
          />
        </label>

        <div className="editor-placeholder">
          <span>
            {t(
              'projectDirectory',
            )}
          </span>

          <p>
            {projectName?.toUpperCase() ||
              t(
                'localProject',
              )}
          </p>
        </div>
      </div>

      <div className="note-editor-actions">
        <button
          className="secondary-button"
          onClick={
            onClose
          }
          disabled={
            savingWorkspaceInfo
          }
        >
          {t(
            'cancel',
          )}
        </button>

        <button
          className="primary-button editor-save"
          onClick={
            onSave
          }
          disabled={
            savingWorkspaceInfo
          }
        >
          {savingWorkspaceInfo
            ? t(
                'saving',
              )
            : t(
                'updateWorkspace',
              )}
        </button>
      </div>
    </aside>
  )
}
