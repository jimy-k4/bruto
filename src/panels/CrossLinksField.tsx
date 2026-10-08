import { useState } from 'react'
import type { CrossLink, Note } from '../types'
import { linkKey, type LinkedNoteInfo } from '../domain/crossLinks'
import { shortId } from '../domain/workspace'
import { statusLabel, useI18n } from '../i18n'
import type { ActiveProject } from '../state/useProjects'
import { KIND_LABELS, linkedNote, unlinkNotes } from '../workspace/crossLinks'
import { LinkNoteDialog } from './LinkNoteDialog'

/** The editor's list of links to notes in other projects, with a way to add more. */
export function CrossLinksField({
  project,
  note,
  info,
  onOpen,
}: {
  project: ActiveProject
  note: Note
  info: Map<string, LinkedNoteInfo>
  onOpen: (link: CrossLink) => void
}) {
  const { t } = useI18n()
  const [adding, setAdding] = useState(false)
  const links = note.crossLinks ?? []

  return (
    <fieldset className="field">
      <legend className="field__label">{t('crossLinks')}</legend>

      {links.length > 0 ? (
        <ul className="cross-link-list">
          {links.map((link) => {
            const other = linkedNote(link, info)
            const title = other.title?.trim() || t('untitled')

            return (
              <li key={linkKey(link)} className={`cross-link cross-link--${link.kind}`}>
                <button
                  data-superveil="click:cross-links-field:cross-link-open"
                  type="button"
                  className="cross-link__open"
                  onClick={() => onOpen(link)}
                  aria-label={t('crossLinkOpen', { title, project: link.project.toUpperCase() })}
                >
                  <span className="cross-link__kind">{t(KIND_LABELS[link.kind])}</span>
                  <span className="cross-link__project">
                    {link.project.toUpperCase()} · {shortId(link.noteId)}
                  </span>
                  <span className="cross-link__title">{title}</span>
                  {other.missing ? (
                    <span className="cross-link__missing">{t('crossLinkMissing')}</span>
                  ) : (
                    other.status && (
                      <span className={`status-badge status-badge--${other.status}`}>
                        {statusLabel(t, other.status)}
                      </span>
                    )
                  )}
                </button>
                <button
                  data-superveil="click:cross-links-field:remove-item"
                  type="button"
                  className="icon-button"
                  aria-label={t('removeItem', { name: title })}
                  onClick={() => void unlinkNotes(project, note, link)}
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="field__hint">{t('crossLinkNone')}</p>
      )}

      <button
        data-superveil="click:cross-links-field:cross-link-add"
        type="button"
        className="button button--small"
        onClick={() => setAdding(true)}
      >
        + {t('crossLinkAdd')}
      </button>

      {adding && <LinkNoteDialog project={project} note={note} onClose={() => setAdding(false)} />}
    </fieldset>
  )
}
