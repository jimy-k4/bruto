import { memo, useCallback, useState } from 'react'
import type { Note } from '../types'
import { noteTitle, shortId } from '../domain/workspace'
import { statusLabel, useI18n } from '../i18n'
import { FileTable } from '../ui/FileTable'
import { ProjectImage } from '../ui/ProjectImage'

export type NoteFlash = 'copied' | 'pasted' | null

/** Board interactions, passed as one stable object so cards don't re-render needlessly. */
export interface NoteCardHandlers {
  onPointerDown: (event: React.PointerEvent<HTMLElement>, note: Note) => void
  onDoubleClick: (event: React.MouseEvent<HTMLElement>, note: Note) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>, note: Note) => void
  onFocus: (note: Note) => void
  observe: (id: string, element: HTMLElement) => () => void
}

interface NoteCardProps {
  note: Note
  selected: boolean
  connecting: boolean
  dragging: boolean
  flash: NoteFlash
  handlers: NoteCardHandlers
}

const MAX_THUMBNAILS = 3

export const NoteCard = memo(function NoteCard({
  note,
  selected,
  connecting,
  dragging,
  flash,
  handlers,
}: NoteCardProps) {
  const { t } = useI18n()
  const [aiOpen, setAiOpen] = useState(false)
  const title = noteTitle(note, t('untitled'))
  const { observe } = handlers

  const ref = useCallback(
    (element: HTMLElement | null) => {
      if (element) return observe(note.id, element)
    },
    [observe, note.id],
  )

  const classes = [
    'note',
    `note-color-${note.colorTheme}`,
    `note-pattern-${note.pattern}`,
    selected && 'is-selected',
    connecting && 'is-connecting',
    dragging && 'is-dragging',
    flash && `is-${flash}`,
  ]

  // Clicks inside links and buttons must not start a drag.
  const stop = (event: React.SyntheticEvent) => event.stopPropagation()

  return (
    <article
      ref={ref}
      className={classes.filter(Boolean).join(' ')}
      style={{ left: note.x, top: note.y, zIndex: note.zIndex }}
      data-note-id={note.id}
      tabIndex={0}
      aria-roledescription={t('note')}
      aria-label={[title, note.status && statusLabel(t, note.status), selected && t('selected')]
        .filter(Boolean)
        .join(', ')}
      onPointerDown={(event) => handlers.onPointerDown(event, note)}
      onDoubleClick={(event) => handlers.onDoubleClick(event, note)}
      onKeyDown={(event) => handlers.onKeyDown(event, note)}
      onFocus={(event) => event.target === event.currentTarget && handlers.onFocus(note)}
    >
      <header className="note__header">
        <span className="note__kind">{t('note')}</span>

        {note.status && (
          <span className={`status-badge status-badge--${note.status}`}>
            {statusLabel(t, note.status)}
          </span>
        )}

        <span className="note__id">{shortId(note.id)}</span>
      </header>

      <div className="note__body">
        <h3 className="note__title">{title}</h3>

        {note.description.trim() ? (
          <p className="note__description">{note.description}</p>
        ) : (
          <p className="note__description note__description--empty">{t('noDescription')}</p>
        )}

        {note.filePaths.length > 0 && <FileTable paths={note.filePaths} limit={4} compact />}

        {note.webUrl.trim() && (
          <a
            className="note__link"
            href={note.webUrl}
            target="_blank"
            rel="noopener noreferrer"
            onPointerDown={stop}
          >
            <span aria-hidden="true">↗</span>
            <span className="note__link-text">{note.webUrl}</span>
          </a>
        )}

        {note.images.length > 0 && (
          <div className="note__images">
            {note.images.slice(0, MAX_THUMBNAILS).map((path) => (
              <ProjectImage key={path} path={path} alt="" className="note__thumbnail" />
            ))}

            {note.images.length > MAX_THUMBNAILS && (
              <span className="note__more">+{note.images.length - MAX_THUMBNAILS}</span>
            )}
          </div>
        )}

        {note.aiResponse && (
          <div className="note__ai">
            <button
              type="button"
              className="note__ai-toggle"
              aria-expanded={aiOpen}
              onPointerDown={stop}
              onDoubleClick={stop}
              onClick={() => setAiOpen(!aiOpen)}
            >
              <span className="note__ai-mark" aria-hidden="true">
                AI
              </span>
              {t('aiResponse')}
              <span aria-hidden="true">{aiOpen ? '▾' : '▸'}</span>
            </button>

            {aiOpen && <p className="note__ai-text">{note.aiResponse}</p>}
          </div>
        )}

        {note.feedback && (
          <p className="note__feedback">
            <strong>{t('feedback')}:</strong> {note.feedback}
          </p>
        )}
      </div>

      <span className="note__brand" aria-hidden="true">
        B
      </span>
    </article>
  )
})
