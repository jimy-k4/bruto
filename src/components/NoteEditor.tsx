import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { Note, NoteColorTheme, NotePattern } from '../types'
import type { Translator } from '../i18n/translations'
import type { Language, Workspace } from '../types'
import { noteStatuses, getNoteStatusLabel, getNoteStyle } from '../lib/statusLabels'
import { formatFileSize } from '../lib/format'

interface NoteEditorProps {
  t: Translator
  language: Language
  noteDraft: Note
  selectTitleOnOpen: boolean
  editorStyle: CSSProperties
  confirmingDelete: boolean
  savingNote: boolean
  addingFiles: boolean
  openingFilePath: string | null
  onStartResize: (event: React.MouseEvent<HTMLDivElement>) => void
  onClose: () => void
  onOpenStatusStyles: () => void
  /** Open project root for real
   * file metadata in the table. */
  projectDirectory?: FileSystemDirectoryHandle
  /** Active workspace, so the
   * header preview shows the same
   * status-driven look as the
   * card on the board. */
  workspace?: Workspace
  onUpdateNoteDraft: (
    field: 'title' | 'description' | 'webUrl' | 'status' | 'aiResponse',
    value: string,
  ) => void
  onApplyNoteDraftChange: (nextDraft: Note) => void
  onAddFiles: () => void
  onOpenProjectFile: (filePath: string) => void
  onRemoveFile: (filePath: string) => void
  onSave: () => void
  onSetConfirmingDelete: (value: boolean) => void
  onDeleteNote: () => void
}

const noteColorThemes: NoteColorTheme[] = [
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

const notePatterns: NotePattern[] = [
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

export function NoteEditor({
  t,
  language,
  noteDraft,
  selectTitleOnOpen,
  editorStyle,
  confirmingDelete,
  savingNote,
  addingFiles,
  openingFilePath,
  onStartResize,
  onClose,
  onOpenStatusStyles,
  projectDirectory,
  workspace,
  onUpdateNoteDraft,
  onApplyNoteDraftChange,
  onAddFiles,
  onOpenProjectFile,
  onRemoveFile,
  onSave,
  onSetConfirmingDelete,
  onDeleteNote,
}: NoteEditorProps) {
  const titleInputRef = useRef<HTMLInputElement | null>(null)

  // A freshly created note opens
  // with its whole title selected
  // so the user can retype it
  // immediately.
  useEffect(() => {
    if (selectTitleOnOpen && titleInputRef.current) {
      titleInputRef.current.focus()

      titleInputRef.current.select()
    }
  }, [selectTitleOnOpen])

  return (
    <aside className="note-editor" style={editorStyle}>
      <div className="editor-resize-handle" onMouseDown={onStartResize} />

      <div className="note-editor-header">
        <div>
          <p className="sidebar-label">{t('editNote')}</p>

          <span className="note-editor-id">{noteDraft.id}</span>
        </div>

        {/* Live preview of the
            note's current look —
            status-driven, exactly like
            the card on the board. */}
        <div
          className={`note-editor-preview note-color-${getNoteStyle(noteDraft, workspace).color} note-pattern-${getNoteStyle(noteDraft, workspace).pattern}`}
          title={getNoteStyle(noteDraft, workspace).color}
        />

        <button className="note-editor-close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="note-editor-content">
        <label>
          <span>{t('title')}</span>

          <input
            ref={titleInputRef}
            type="text"
            value={noteDraft.title}
            onChange={(event) => onUpdateNoteDraft('title', event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault()

                onSave()
              }
            }}
            autoFocus
          />
        </label>

        <label>
          <span>{t('description')}</span>

          <textarea
            value={noteDraft.description}
            onChange={(event) => onUpdateNoteDraft('description', event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault()

                onSave()
              }
            }}
            rows={8}
          />
        </label>

        <label>
          <span>{t('status')}</span>

          <div className="editor-status-field">
            <span className={`editor-status-swatch note-status-${noteDraft.status ?? 'none'}`} />

            <select
              className="note-editor-select"
              value={noteDraft.status ?? ''}
              onChange={(event) => onUpdateNoteDraft('status', event.target.value)}
            >
              <option value="">—</option>

              {noteStatuses.map((status) => (
                <option key={status} value={status}>
                  {getNoteStatusLabel(status, t)}
                </option>
              ))}
            </select>
          </div>

          <button type="button" className="editor-styles-link" onClick={onOpenStatusStyles}>
            {t('customizeEveryStatus')} →
          </button>
        </label>

        <label>
          <span>{t('webUrl')}</span>

          <input
            type="url"
            placeholder="https://..."
            value={noteDraft.webUrl}
            onChange={(event) => onUpdateNoteDraft('webUrl', event.target.value)}
          />
        </label>

        <label>
          <span>{t('aiResponse')}</span>

          <textarea
            className="editor-ai-response"
            value={noteDraft.aiResponse ?? ''}
            onChange={(event) => onUpdateNoteDraft('aiResponse', event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault()

                onSave()
              }
            }}
            placeholder="{}"
            rows={4}
          />
        </label>

        <div className="note-visual-editor">
          <div className="editor-section-title">{t('visual')}</div>

          <div className="editor-visual-row">
            <span className="editor-visual-label">{t('color')}</span>

            <div className="note-style-options">
              {noteColorThemes.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`note-style-option note-style-color-${color} note-pattern-${noteDraft.pattern} ${
                    noteDraft.colorTheme === color ? 'note-style-option-selected' : ''
                  }`}
                  onClick={() =>
                    onApplyNoteDraftChange({
                      ...noteDraft,
                      colorTheme: color,
                    })
                  }
                >
                  <span />
                </button>
              ))}
            </div>
          </div>

          <div className="editor-visual-row">
            <span className="editor-visual-label">{t('pattern')}</span>

            <div className="note-style-options">
              {notePatterns.map((pattern) => (
                <button
                  key={pattern}
                  type="button"
                  className={`note-style-option note-style-color-${
                    noteDraft.colorTheme
                  } note-pattern-${pattern} ${
                    noteDraft.pattern === pattern ? 'note-style-option-selected' : ''
                  }`}
                  onClick={() =>
                    onApplyNoteDraftChange({
                      ...noteDraft,
                      pattern,
                    })
                  }
                >
                  <span />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="editor-files">
          <div className="editor-files-header">
            <span>{t('files')}</span>

            <button
              type="button"
              className="secondary-button editor-add-file"
              onClick={onAddFiles}
              disabled={addingFiles || savingNote}
            >
              {addingFiles ? t('adding') : t('addFiles')}
            </button>
          </div>

          {noteDraft.filePaths.length === 0 ? (
            <p className="editor-files-empty">{t('noFiles')}</p>
          ) : (
            <div className="editor-file-list">
              <div className="editor-files-table-head">
                <span>{t('file')}</span>

                <span>{t('size')}</span>

                <span>{t('modified')}</span>
              </div>

              {noteDraft.filePaths.map((filePath) => (
                <EditorFileRow
                  key={filePath}
                  filePath={filePath}
                  language={language}
                  projectDirectory={projectDirectory}
                  opening={openingFilePath === filePath}
                  saving={savingNote}
                  openingLabel={t('opening')}
                  onOpen={() => onOpenProjectFile(filePath)}
                  onRemove={() => onRemoveFile(filePath)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="note-editor-actions">
        <button className="primary-button editor-save" onClick={onSave} disabled={savingNote}>
          {savingNote ? t('saving') : t('done')}
        </button>
      </div>

      <div className="note-editor-danger">
        {!confirmingDelete ? (
          <button className="delete-button" onClick={() => onSetConfirmingDelete(true)}>
            {t('deleteNote')}
          </button>
        ) : (
          <div className="delete-confirm">
            <div>
              <strong>{t('confirmDelete')}</strong>

              <p>{t('deleteCannotUndo')}</p>
            </div>

            <div className="delete-confirm-actions">
              <button className="secondary-button" onClick={() => onSetConfirmingDelete(false)}>
                {t('cancel')}
              </button>

              <button className="delete-confirm-button" onClick={onDeleteNote}>
                {t('delete')}
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

/** One row of the editor's files
 * table: real size and last-modified
 * date resolved through the open
 * project directory, like the note
 * card does. */
function EditorFileRow({
  filePath,
  language,
  projectDirectory,
  opening,
  saving,
  openingLabel,
  onOpen,
  onRemove,
}: {
  filePath: string
  language: Language
  projectDirectory?: FileSystemDirectoryHandle
  opening: boolean
  saving: boolean
  openingLabel: string
  onOpen: () => void
  onRemove: () => void
}) {
  const [fileInfo, setFileInfo] = useState<{
    size: number
    lastModified: number
  } | null>(null)

  const resolvingRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    const resolve = async () => {
      if (resolvingRef.current) {
        return
      }

      resolvingRef.current = true

      try {
        const parts = filePath.split('/')

        const fileName = parts.pop()

        if (!fileName) {
          return
        }

        let directory: FileSystemDirectoryHandle | undefined = projectDirectory

        if (!directory) {
          return
        }

        for (const part of parts) {
          directory = await directory.getDirectoryHandle(part)
        }

        const fileHandle = await directory.getFileHandle(fileName)

        const file = await fileHandle.getFile()

        if (!cancelled) {
          setFileInfo({
            size: file.size,
            lastModified: file.lastModified,
          })
        }
      } catch {
        // Missing or unreadable
        // file: keep dashes.
      } finally {
        resolvingRef.current = false
      }
    }

    resolve()

    return () => {
      cancelled = true
    }
  }, [filePath, projectDirectory])

  return (
    <div className="editor-file">
      <button type="button" className="editor-file-open" onClick={onOpen} disabled={opening}>
        <span className="editor-file-path" title={filePath}>
          {opening ? openingLabel : filePath}
        </span>
      </button>

      <span className="editor-file-size">{fileInfo ? formatFileSize(fileInfo.size) : '—'}</span>

      <span className="editor-file-date">
        {fileInfo
          ? new Intl.DateTimeFormat(language, {
              dateStyle: 'short',
            }).format(new Date(fileInfo.lastModified))
          : '—'}
      </span>

      <button
        type="button"
        className="editor-file-remove"
        onClick={onRemove}
        disabled={saving || opening}
      >
        ×
      </button>
    </div>
  )
}
