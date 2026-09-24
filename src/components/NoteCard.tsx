import type { CSSProperties, MouseEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { Language, Note, Workspace } from '../types'
import type { Translator } from '../i18n/translations'
import { NOTE_BASE_HEIGHT, NOTE_BASE_WIDTH } from '../lib/connectionGeometry'
import { getNoteStyle, getNoteStatusLabel } from '../lib/statusLabels'
import { formatFileSize } from '../lib/format'

interface NoteCardProps {
  note: Note
  t: Translator
  /** App language, for the files
   * table's date formatting. */
  language: Language
  isSelected: boolean
  isDragging: boolean
  isConnecting: boolean
  /** True briefly after Ctrl+C so
   * the card can play the copy
   * animation. */
  justCopied: boolean
  /** True briefly after Ctrl+V so
   * the fresh card can pop in. */
  justPasted: boolean
  /** Active workspace, for
   * status-driven automatic
   * styles. */
  workspace?: Workspace
  /** Open project root, so the
   * files table can read real
   * size / modified metadata. */
  projectDirectory?: FileSystemDirectoryHandle
  onNoteMouseDown: (event: MouseEvent<HTMLElement>, note: Note) => void
  onNoteClick: (event: MouseEvent<HTMLElement>, note: Note) => void
}

export function NoteCard({
  note,
  t,
  language,
  isSelected,
  isDragging,
  isConnecting,
  justCopied,
  justPasted,
  workspace,
  projectDirectory,
  onNoteMouseDown,
  onNoteClick,
}: NoteCardProps) {
  // Collapsed by default; each
  // card remembers its own toggle.
  const [aiResponseOpen, setAiResponseOpen] = useState(false)

  const cardStyle: CSSProperties = {
    left: `${note.x}px`,
    top: `${note.y}px`,
    zIndex: note.zIndex,
    minWidth: `${NOTE_BASE_WIDTH}px`,
    minHeight: `${NOTE_BASE_HEIGHT}px`,
  }

  return (
    <article
      key={note.id}
      data-note-id={note.id}
      className={`note-card note-color-${getNoteStyle(note, workspace).color} note-pattern-${getNoteStyle(note, workspace).pattern} ${
        isSelected ? 'note-card-selected' : ''
      } ${isDragging ? 'note-card-dragging' : ''} ${isConnecting ? 'note-card-connecting' : ''} ${
        justCopied ? 'note-card-copied' : ''
      } ${justPasted ? 'note-card-pasted' : ''}`}
      style={cardStyle}
      onMouseDown={(event) => {
        onNoteMouseDown(event, note)
      }}
      onClick={(event) => {
        onNoteClick(event, note)
      }}
    >
      {isConnecting && (
        <svg
          className="note-connection-border"
          width="100%"
          height="100%"
          viewBox="0 0 280 160"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <rect x="2" y="2" width="276" height="156" />
        </svg>
      )}

      <div className="note-card-header">
        <span>{t('noteLabel')}</span>

        {note.status && (
          <div className={`note-card-status note-status-${note.status}`}>
            <span className="note-card-status-dot" />

            {getNoteStatusLabel(note.status, t)}
          </div>
        )}

        <span>{note.id.slice(0, 6)}</span>
      </div>

      <h3>{note.title || t('untitled')}</h3>

      <p>{note.description || t('noDescription')}</p>

      <div
        className={`note-card-meta ${
          (note.filePaths ?? []).length === 0 && !(note.webUrl ?? '').trim()
            ? 'note-card-meta-empty'
            : ''
        }`}
      >
        {(note.filePaths ?? []).length > 0 && (
          <div className="note-card-files-table">
            <div className="note-card-files-head">
              <span>{t('file')}</span>
              <span>{t('size')}</span>
              <span>{t('modified')}</span>
            </div>

            {(note.filePaths ?? []).slice(0, 4).map((filePath) => (
              <NoteFileRow
                key={filePath}
                filePath={filePath}
                language={language}
                projectDirectory={projectDirectory}
              />
            ))}

            {(note.filePaths ?? []).length > 4 && (
              <div className="note-card-files-more">+{(note.filePaths ?? []).length - 4}</div>
            )}
          </div>
        )}

        {note.webUrl.trim() && (
          <a
            className="note-card-link"
            href={note.webUrl}
            target="_blank"
            rel="noopener noreferrer"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <span>↗</span>

            <span className="note-card-link-text">{note.webUrl}</span>
          </a>
        )}
      </div>

      {/* AI model response: only
          rendered when a model has
          actually written something,
          collapsed by default. */}
      {(note.aiResponse ?? '').trim() && (
        <div
          className={`note-card-ai-response ${aiResponseOpen ? 'note-card-ai-response-open' : ''}`}
        >
          <button
            type="button"
            className="note-card-ai-toggle"
            onClick={(event) => {
              event.stopPropagation()

              setAiResponseOpen(!aiResponseOpen)
            }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <span className="note-card-ai-toggle-mark">AI</span>

            <span className="note-card-ai-toggle-label">{t('aiResponse')}</span>

            <span className="note-card-ai-toggle-arrow">{aiResponseOpen ? '▾' : '▸'}</span>
          </button>

          {aiResponseOpen && <pre className="note-card-ai-text">{note.aiResponse}</pre>}
        </div>
      )}
    </article>
  )
}

/** Shortens a path from the
 * middle (…/src/deep/file.tsx) so
 * long project paths still fit a
 * narrow column. */
function shortenFilePath(filePath: string): string {
  if (filePath.length <= 26) {
    return filePath
  }

  const fileName = filePath.split('/').pop() ?? filePath

  if (fileName.length >= 26) {
    return `…${filePath.slice(-25)}`
  }

  const remaining = 26 - fileName.length

  return `…${filePath.slice(
    filePath.length - fileName.length - remaining,
    filePath.length - fileName.length,
  )}${fileName}`
}

/** One row of the note's files
 * table: resolves the real file
 * handle when possible to show its
 * size and last-modified date,
 * falling back to just the path. */
function NoteFileRow({
  filePath,
  language,
  projectDirectory,
}: {
  filePath: string
  language: Language
  projectDirectory?: FileSystemDirectoryHandle
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
        // file: keep showing just
        // the path.
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
    <div className="note-card-files-row">
      <span className="note-card-files-name" title={filePath}>
        {shortenFilePath(filePath)}
      </span>

      <span>{fileInfo ? formatFileSize(fileInfo.size) : '—'}</span>

      <span>
        {fileInfo
          ? new Intl.DateTimeFormat(language, {
              dateStyle: 'short',
            }).format(new Date(fileInfo.lastModified))
          : '—'}
      </span>
    </div>
  )
}
