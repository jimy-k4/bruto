import { memo, useCallback, useState } from 'react'
import type { CrossLink, Note } from '../types'
import { blockState, linkKey, type LinkedNoteInfo } from '../domain/crossLinks'
import { noteLinks, noteTitle, shortId } from '../domain/workspace'
import { kindLabel, statusLabel, useI18n } from '../i18n'
import { LensIcon } from '../lenses/LensIcon'
import { describeAgentStamp } from '../ui/agentStamp'
import { FileTable } from '../ui/FileTable'
import { formatDate } from '../ui/format'
import { formatAge } from '../ui/noteAge'
import { ProjectImage } from '../ui/ProjectImage'
import { RichText } from '../ui/RichText'
import { KIND_LABELS, linkedNote } from '../workspace/crossLinks'

export type NoteFlash = 'copied' | 'pasted' | null

/** How a note looks while the board search is active. */
export type SearchMark = 'match' | 'dimmed' | null

/** Board interactions, passed as one stable object so cards don't re-render needlessly. */
export interface NoteCardHandlers {
  onPointerDown: (event: React.PointerEvent<HTMLElement>, note: Note) => void
  onDoubleClick: (event: React.MouseEvent<HTMLElement>, note: Note) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>, note: Note) => void
  onFocus: (note: Note) => void
  observe: (id: string, element: HTMLElement) => () => void
  onOpenLink: (link: CrossLink) => void
}

interface NoteCardProps {
  note: Note
  selected: boolean
  connecting: boolean
  dragging: boolean
  flash: NoteFlash
  searchMark: SearchMark
  /** Linked notes in other projects, as read from them. */
  linkInfo: Map<string, LinkedNoteInfo>
  handlers: NoteCardHandlers
}

const MAX_THUMBNAILS = 3
/** Links shown on the card; the editor has them all. */
const MAX_LINKS = 3

/** An open AI response can reach the note below: while open, its note goes on top of the rest. */
const OPEN_ABOVE = 1_000_000

/** Words longer than this don't fit a card line at the full title size. */
const LONG_WORD = 13
const VERY_LONG_WORD = 17

function titleSizeClass(title: string) {
  const longest = Math.max(...title.split(/\s+/).map((word) => word.length))

  if (longest > VERY_LONG_WORD) return 'note__title note__title--smaller'
  if (longest > LONG_WORD) return 'note__title note__title--small'

  return 'note__title'
}

export const NoteCard = memo(function NoteCard({
  note,
  selected,
  connecting,
  dragging,
  flash,
  searchMark,
  linkInfo,
  handlers,
}: NoteCardProps) {
  const { t, language } = useI18n()
  const [aiOpen, setAiOpen] = useState(false)
  const readOnly = note.agentAccess === 'read'
  const title = noteTitle(note, t('untitled'))
  const links = noteLinks(note)
  const { observe } = handlers
  const crossLinks = note.crossLinks ?? []
  const { blockedBy, blocking } = blockState(note, linkInfo)

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
    searchMark && `is-${searchMark}`,
    blockedBy.length > 0 && 'is-blocked',
    blocking.length > 0 && 'is-blocking',
  ]

  // Clicks inside links and buttons must not start a drag.
  const stop = (event: React.SyntheticEvent) => event.stopPropagation()

  return (
    <article
      ref={ref}
      className={classes.filter(Boolean).join(' ')}
      style={{ left: note.x, top: note.y, zIndex: aiOpen ? OPEN_ABOVE + note.zIndex : note.zIndex }}
      data-note-id={note.id}
      tabIndex={0}
      aria-roledescription={t('note')}
      aria-label={[
        title,
        note.kind && kindLabel(t, note.kind),
        note.status && statusLabel(t, note.status),
        readOnly && t('agentReadOnly'),
        note.sentBack && t('sentBackTimes', { count: note.sentBack }),
        selected && t('selected'),
      ]
        .filter(Boolean)
        .join(', ')}
      onPointerDown={(event) => handlers.onPointerDown(event, note)}
      onDoubleClick={(event) => handlers.onDoubleClick(event, note)}
      onKeyDown={(event) => handlers.onKeyDown(event, note)}
      onFocus={(event) => event.target === event.currentTarget && handlers.onFocus(note)}
    >
      <header className="note__header">
        <span className={note.kind ? `note__kind note__kind--${note.kind}` : 'note__kind'}>
          {note.kind ? kindLabel(t, note.kind) : t('note')}
        </span>

        {note.status && (
          <span className={`status-badge status-badge--${note.status}`}>
            {statusLabel(t, note.status)}
          </span>
        )}

        <span className="note__id">
          {shortId(note.id)}
          {readOnly && (
            <abbr className="note__lock" title={t('agentReadOnly')}>
              <LensIcon name="lock" />
            </abbr>
          )}
        </span>
      </header>

      {/* Waiting on another project, or holding one up: the same note, taped. */}
      {blockedBy.length > 0 && (
        <p className="note__tape note__tape--blocked">
          <span>{t('tapeBlocked')}</span>
        </p>
      )}
      {blocking.length > 0 && (
        <p className="note__tape note__tape--blocking">
          <span>{t('tapeBlocking')}</span>
        </p>
      )}

      <div className="note__body">
        <h3 className={titleSizeClass(title)}>{title}</h3>

        {note.description.trim() ? (
          <RichText className="note__description" text={note.description} />
        ) : (
          <p className="note__description note__description--empty">{t('noDescription')}</p>
        )}

        {note.filePaths.length > 0 && <FileTable paths={note.filePaths} limit={4} compact />}

        {links.length > 0 && (
          <ul className="note__links">
            {links.slice(0, MAX_LINKS).map((link) => (
              <li key={link}>
                <a
                  className="note__link"
                  href={link}
                  title={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onPointerDown={stop}
                >
                  <span aria-hidden="true">↗</span>
                  <span className="note__link-text">{link}</span>
                </a>
              </li>
            ))}
            {links.length > MAX_LINKS && (
              <li className="note__more">+{links.length - MAX_LINKS}</li>
            )}
          </ul>
        )}

        {crossLinks.length > 0 && (
          <ul className="note__cross-links">
            {crossLinks.map((link) => {
              const other = linkedNote(link, linkInfo)
              const title = other.title?.trim() || t('untitled')
              const project = link.project.toUpperCase()

              return (
                <li key={linkKey(link)}>
                  <button
                    type="button"
                    className={`note__cross-link note__cross-link--${link.kind}`}
                    title={t('crossLinkOpen', { title, project })}
                    onPointerDown={stop}
                    onDoubleClick={stop}
                    onClick={() => handlers.onOpenLink(link)}
                  >
                    <span className="note__cross-link-kind">{t(KIND_LABELS[link.kind])}</span>
                    <span className="note__cross-link-text">
                      {project} · {title}
                      {other.missing
                        ? ` · ${t('crossLinkMissing')}`
                        : other.status && ` · ${statusLabel(t, other.status)}`}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
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

        {Boolean(note.aiResponse || note.aiFilePaths?.length) && (
          <div className="note__ai">
            <button
              type="button"
              className="note__ai-toggle"
              aria-expanded={aiOpen}
              title={note.agent ? describeAgentStamp(t, language, note.agent) : undefined}
              onPointerDown={stop}
              onDoubleClick={stop}
              onClick={() => setAiOpen(!aiOpen)}
            >
              <span className="note__ai-mark" aria-hidden="true">
                AI
              </span>
              {t('aiResponse')}
              {note.aiFilePaths?.length ? (
                <span className="note__ai-count">
                  {t('filesCount', { count: note.aiFilePaths.length })}
                </span>
              ) : null}
              <span aria-hidden="true">{aiOpen ? '▾' : '▸'}</span>
            </button>

            {aiOpen && note.aiResponse && (
              <RichText className="note__ai-text" text={note.aiResponse} />
            )}
            {aiOpen && note.aiFilePaths?.length ? (
              <FileTable paths={note.aiFilePaths} limit={4} compact />
            ) : null}
          </div>
        )}

        {note.feedback && (
          <div className="note__feedback">
            <strong>{t('feedback')}:</strong>
            <RichText text={note.feedback} />
          </div>
        )}
      </div>

      {/* Its age, which never resets, and its trips back from review. */}
      {Boolean(note.createdAt || note.sentBack) && (
        <p className="note__meta">
          {note.createdAt && (
            <span
              title={t('createdOn', {
                date: formatDate(language, Date.parse(note.createdAt), true),
              })}
            >
              {formatAge(language, note.createdAt)}
            </span>
          )}
          {note.sentBack ? (
            <span className="note__sent-back" title={t('sentBackTimes', { count: note.sentBack })}>
              ↩ {note.sentBack}
            </span>
          ) : null}
        </p>
      )}

      <span className="note__brand" aria-hidden="true">
        B
      </span>
    </article>
  )
})
