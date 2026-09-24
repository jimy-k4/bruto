import type { ReactNode } from 'react'
import type { FileTreeNode, SelectedFileInfo, Language } from '../types'
import type { Translator } from '../i18n/translations'
import { formatFileSize, formatFileDate } from '../lib/format'

interface DirectoryPanelProps {
  t: Translator
  language: Language
  directorySearch: string
  directorySearching: boolean
  directoryLoading: boolean
  activeDirectoryTree: FileTreeNode | null
  forceExpanded: boolean
  selectedFileInfo: SelectedFileInfo | null
  openingFilePath: string | null
  onDirectorySearchChange: (
    value: string,
  ) => void
  onRefresh: () => void
  onRenderFileTreeNode: (
    node: FileTreeNode,
    depth: number,
    forceExpanded: boolean,
  ) => ReactNode
  onOpenProjectFile: (
    filePath: string,
  ) => void
  onClose: () => void
}

export function DirectoryPanel({
  t,
  language,
  directorySearch,
  directorySearching,
  directoryLoading,
  activeDirectoryTree,
  forceExpanded,
  selectedFileInfo,
  openingFilePath,
  onDirectorySearchChange,
  onRefresh,
  onRenderFileTreeNode,
  onOpenProjectFile,
  onClose,
}: DirectoryPanelProps) {
  return (
    <div
      className="ai-context-overlay"
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose()
        }
      }}
    >
      <section className="ai-context-window directory-window">
        <header className="ai-context-window-header">
          <div>
            <p className="sidebar-label">
              {t(
                'directory',
              )}
            </p>

            <h2>
              {t(
                'directoryTitle',
              )}
            </h2>

            <p>
              {t(
                'directoryDescription',
              )}
            </p>
          </div>

          <button
            className="note-editor-close"
            onClick={
              onClose
            }
          >
            ×
          </button>
        </header>

        <div className="directory-toolbar">
          <div className="directory-search-container">
            <input
              type="search"
              className="directory-search"
              value={
                directorySearch
              }
              onChange={(
                event,
              ) =>
                onDirectorySearchChange(
                  event.target.value,
                )
              }
              placeholder={t(
                'directorySearch',
              )}
              autoFocus
            />

            {directorySearching && (
              <span className="directory-search-status">
                {t(
                  'directorySearching',
                )}
              </span>
            )}
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={
              onRefresh
            }
            disabled={
              directoryLoading
            }
          >
            {directoryLoading
              ? t(
                  'directoryLoading',
                )
              : t(
                  'directoryRefresh',
                )}
          </button>
        </div>

        <div className="directory-window-content">
          <div className="directory-tree-panel">
            {directoryLoading &&
            !activeDirectoryTree ? (
              <div className="directory-state">
                {t(
                  'directoryLoading',
                )}
              </div>
            ) : activeDirectoryTree ? (
              activeDirectoryTree.children &&
              activeDirectoryTree.children
                .length >
                0 ? (
                <div className="file-tree">
                  {onRenderFileTreeNode(
                    activeDirectoryTree,
                    0,
                    forceExpanded,
                  )}
                </div>
              ) : (
                <div className="directory-state">
                  {t(
                    'directoryEmpty',
                  )}
                </div>
              )
            ) : (
              <div className="directory-state">
                {t(
                  'directoryEmpty',
                )}
              </div>
            )}
          </div>

          <aside className="directory-file-info">
            {!selectedFileInfo ? (
              <div className="directory-file-info-empty">
                {t(
                  'directorySelectFile',
                )}
              </div>
            ) : (
              <>
                <div className="directory-file-info-header">
                  <span className="directory-file-info-type">
                    {t(
                      'file',
                    )}
                  </span>

                  <h3>
                    {
                      selectedFileInfo.name
                    }
                  </h3>
                </div>

                <div className="directory-file-info-list">
                  <div>
                    <span>
                      {t(
                        'directoryPath',
                      )}
                    </span>

                    <strong>
                      {
                        selectedFileInfo.path
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      {t(
                        'directorySize',
                      )}
                    </span>

                    <strong>
                      {formatFileSize(
                        selectedFileInfo.size,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      {t(
                        'directoryModified',
                      )}
                    </span>

                    <strong>
                      {formatFileDate(
                        language,
                        selectedFileInfo.lastModified,
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      {t(
                        'directoryMime',
                      )}
                    </span>

                    <strong>
                      {
                        selectedFileInfo.type
                      }
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="primary-button directory-open-button"
                  onClick={() =>
                    onOpenProjectFile(
                      selectedFileInfo.path,
                    )
                  }
                  disabled={
                    openingFilePath ===
                    selectedFileInfo.path
                  }
                >
                  {openingFilePath ===
                  selectedFileInfo.path
                    ? t(
                        'opening',
                      )
                    : t(
                        'directoryOpenFile',
                      )}
                </button>
              </>
            )}
          </aside>
        </div>

        <footer className="ai-context-window-footer">
          <button
            className="secondary-button"
            onClick={
              onClose
            }
          >
            {t(
              'close',
            )}
          </button>
        </footer>
      </section>
    </div>
  )
}
