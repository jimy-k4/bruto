import type { CSSProperties } from 'react'
import type { ContextScope, Note, Workspace, WorkspaceDocumentation } from '../types'
import type { Translator } from '../i18n/translations'
import { getLocalizedDocumentationTypeLabel } from '../lib/documentationLabels'
import { ContextStrips, type ContextStrip } from './ContextStrips'

interface SidebarProps {
  t: Translator
  workspace: Workspace
  creatingNote: boolean
  sidebarVisible: boolean
  sidebarWidth: number
  /** Currently selected note, so
   * the AI CONTEXT section can
   * show what a copy would include. */
  selectedNote: Note | null
  /** Backgrounds for the copy
   * current/connected buttons,
   * from the selected note and its
   * connected notes. */
  aiContextStyles: {
    current: ContextStrip[]
    connected: ContextStrip[]
  }
  onOpenAiContext: () => void
  onCopyAiContext: (scope: ContextScope) => void
  onCreateNote: () => void
  onEditWorkspace: () => void
  onOpenDocumentation: (documentation: WorkspaceDocumentation) => void
  onEditDocumentation: (documentation: WorkspaceDocumentation) => void
  onDeleteDocumentation: (documentationId: string) => void
  onAddDocumentation: () => void
  onToggle: () => void
  onStartResize: (event: React.MouseEvent<HTMLDivElement>) => void
}

export function Sidebar({
  t,
  workspace,
  creatingNote,
  sidebarVisible,
  sidebarWidth,
  selectedNote,
  aiContextStyles,
  onOpenAiContext,
  onCopyAiContext,
  onCreateNote,
  onEditWorkspace,
  onOpenDocumentation,
  onEditDocumentation,
  onDeleteDocumentation,
  onAddDocumentation,
  onToggle,
  onStartResize,
}: SidebarProps) {
  const sidebarStyle: CSSProperties = {
    width: `${sidebarWidth}px`,
  }

  return (
    <>
      {!sidebarVisible && (
        <button
          type="button"
          className="sidebar-show-tab"
          onClick={onToggle}
          aria-label={t('showSidebar')}
          title={t('showSidebar')}
        >
          »
        </button>
      )}

      {sidebarVisible && (
        <>
          <aside className="sidebar" style={sidebarStyle}>
            <button
              type="button"
              className="sidebar-hide-button"
              onClick={onToggle}
              aria-label={t('hideSidebar')}
              title={t('hideSidebar')}
            >
              «
            </button>

            <div className="sidebar-section">
              <p className="sidebar-label">{t('workspace')}</p>

              <h2>{workspace.title}</h2>

              <p className="sidebar-description">
                {workspace.description || t('noWorkspaceDescription')}
              </p>

              <div className="sidebar-context-actions workspace-actions">
                <button type="button" className="sidebar-context-button" onClick={onEditWorkspace}>
                  {t('editWorkspace')}
                </button>
              </div>
            </div>

            <div className="sidebar-section ai-context-section">
              <p className="sidebar-label">{t('aiContext')}</p>

              <div className="sidebar-ai-selected">
                <span>{t('selectedNote')}</span>

                <strong>
                  {selectedNote ? selectedNote.title.trim() || t('untitled') : t('notSelected')}
                </strong>
              </div>

              <button type="button" className="sidebar-ai-open" onClick={onOpenAiContext}>
                {t('aiContextWindow')}
              </button>

              <div className="sidebar-ai-copies">
                <button
                  type="button"
                  className="sidebar-context-button context-painted"
                  disabled={!selectedNote}
                  onClick={() => onCopyAiContext('current')}
                >
                  <ContextStrips strips={aiContextStyles.current} />

                  <span>{t('copyCurrentNote')}</span>

                  <kbd>Q</kbd>
                </button>

                <button
                  type="button"
                  className="sidebar-context-button context-painted"
                  disabled={!selectedNote}
                  onClick={() => onCopyAiContext('connected')}
                >
                  <ContextStrips strips={aiContextStyles.connected} />

                  <span>{t('copyConnectedContext')}</span>

                  <kbd>W</kbd>
                </button>

                <button
                  type="button"
                  className="sidebar-context-button"
                  onClick={() => onCopyAiContext('entire')}
                >
                  <span>{t('copyEntireContext')}</span>

                  <kbd>E</kbd>
                </button>
              </div>
            </div>

            <div className="sidebar-section documentation-section">
              <p className="sidebar-label">{t('documentation')}</p>

              {workspace.documentation.length === 0 ? (
                <p className="sidebar-description documentation-empty">{t('noDocumentation')}</p>
              ) : (
                <div className="workspace-documentation-list">
                  {workspace.documentation.map((documentation) => (
                    <div className="workspace-documentation-item" key={documentation.id}>
                      <div className="workspace-documentation-info">
                        <span className="workspace-documentation-type">
                          {getLocalizedDocumentationTypeLabel(documentation.type, t)}
                        </span>

                        <strong>{documentation.name}</strong>

                        <span className="workspace-documentation-url">{documentation.url}</span>
                      </div>

                      <div className="workspace-documentation-actions">
                        <button type="button" onClick={() => onOpenDocumentation(documentation)}>
                          {t('open')}
                        </button>

                        <button type="button" onClick={() => onEditDocumentation(documentation)}>
                          {t('edit')}
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteDocumentation(documentation.id)}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                className="sidebar-context-button documentation-add-button"
                onClick={onAddDocumentation}
              >
                {t('addDocumentation')}
              </button>
            </div>

            <div className="sidebar-section">
              <p className="sidebar-label">{t('content')}</p>

              <div className="sidebar-stat">
                <span>{t('notes')}</span>

                <strong>{workspace.notes.length}</strong>
              </div>

              <div className="sidebar-stat">
                <span>{t('connections')}</span>

                <strong>{workspace.connections.length}</strong>
              </div>
            </div>

            <button className="sidebar-button" onClick={onCreateNote} disabled={creatingNote}>
              {creatingNote ? t('creating') : t('newNote')}
            </button>
          </aside>

          <div
            className="sidebar-resize-handle"
            style={{
              left: `${sidebarWidth - 6}px`,
            }}
            onMouseDown={onStartResize}
          />
        </>
      )}
    </>
  )
}
