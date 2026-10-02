import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CrossLinkKind, Note } from '../types'
import { CROSS_LINK_KINDS } from '../domain/crossLinks'
import { normalizeText } from '../domain/search'
import { noteTitle, shortId } from '../domain/workspace'
import { statusLabel, useI18n } from '../i18n'
import type { ActiveProject } from '../state/useProjects'
import { readOtherWorkspace } from '../storage/linkedProjects'
import { listRecentProjects, type RecentProject } from '../storage/recentProjects'
import { Dialog } from '../ui/Dialog'
import { useToast } from '../ui/toasts'
import { KIND_LABELS, linkNotes } from '../workspace/crossLinks'

type Loaded =
  { kind: 'idle' } | { kind: 'loading' } | { kind: 'failed' } | { kind: 'ok'; notes: Note[] }

/** Picks a note in another recent project and links this one to it, on both boards. */
export function LinkNoteDialog({
  project,
  note,
  onClose,
}: {
  project: ActiveProject
  note: Note
  onClose: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const ids = { kind: useId(), project: useId(), search: useId() }
  const [kind, setKind] = useState<CrossLinkKind>('blocks')
  const [projects, setProjects] = useState<RecentProject[] | null>(null)
  const [target, setTarget] = useState<RecentProject | null>(null)
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'idle' })
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void listRecentProjects().then(async (recents) => {
      const others: RecentProject[] = []

      for (const recent of recents)
        if (!(await recent.handle.isSameEntry(project.handle).catch(() => false)))
          others.push(recent)

      setProjects(others)
    })
  }, [project.handle])

  // Picking a project is a click: the browser may ask for access to its folder right then.
  const choose = async (id: string) => {
    const recent = projects?.find((item) => item.id === id) ?? null

    setTarget(recent)
    setChosen(null)
    setQuery('')

    if (!recent) return setLoaded({ kind: 'idle' })

    setLoaded({ kind: 'loading' })

    const other = await readOtherWorkspace(recent, true)

    setLoaded(other ? { kind: 'ok', notes: other.notes } : { kind: 'failed' })
  }

  const needle = normalizeText(query.trim())
  const notes =
    loaded.kind === 'ok'
      ? loaded.notes.filter(
          (item) => !needle || normalizeText(`${item.title} ${item.id}`).includes(needle),
        )
      : []
  const targetNote = loaded.kind === 'ok' ? loaded.notes.find((item) => item.id === chosen) : null

  const confirm = async () => {
    if (!target || !targetNote) return

    setSaving(true)

    const both = await linkNotes(project, note, kind, target, targetNote)
    const name = target.handle.name.toUpperCase()

    toast(
      both
        ? { tone: 'success', message: t('crossLinkLinked', { project: name }) }
        : { tone: 'error', message: t('crossLinkOneSided', { project: name }) },
    )
    onClose()
  }

  return createPortal(
    <Dialog
      eyebrow={`#${shortId(note.id)} ${noteTitle(note, t('untitled'))}`}
      title={t('crossLinkAdd')}
      description={t('linkDialogDescription')}
      onClose={onClose}
      footer={
        <div className="button-row">
          <button
            data-superveil="click:link-note-dialog:cancel"
            type="button"
            className="button"
            onClick={onClose}
          >
            {t('cancel')}
          </button>
          <button
            data-superveil="click:link-note-dialog:link-confirm"
            type="button"
            className="button button--primary"
            disabled={!targetNote || saving}
            onClick={() => void confirm()}
          >
            {t('linkConfirm')}
          </button>
        </div>
      }
    >
      <div className="form">
        <fieldset className="field">
          <legend className="field__label">{t('linkKind')}</legend>
          <div className="segmented" role="radiogroup">
            {CROSS_LINK_KINDS.map((option) => (
              <label key={option} className="segmented__option">
                <input
                  type="radio"
                  name={ids.kind}
                  value={option}
                  checked={kind === option}
                  onChange={() => setKind(option)}
                />
                <span>{t(KIND_LABELS[option])}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field">
          <label className="field__label" htmlFor={ids.project}>
            {t('linkProject')}
          </label>
          {projects && projects.length === 0 ? (
            <p className="field__hint">{t('linkNoProjects')}</p>
          ) : (
            <select
              id={ids.project}
              className="select select--full"
              value={target?.id ?? ''}
              onChange={(event) => void choose(event.target.value)}
              data-autofocus
            >
              <option value="">{t('linkChooseProject')}</option>
              {projects?.map((recent) => (
                <option key={recent.id} value={recent.id}>
                  {recent.handle.name.toUpperCase()}
                </option>
              ))}
            </select>
          )}
        </div>

        {loaded.kind === 'failed' && <p className="field__hint">{t('linkUnreadable')}</p>}

        {loaded.kind === 'ok' && (
          <fieldset className="field">
            <legend className="field__label">{t('linkNote')}</legend>
            <label className="visually-hidden" htmlFor={ids.search}>
              {t('linkSearch')}
            </label>
            <input
              id={ids.search}
              type="search"
              className="input"
              placeholder={t('linkSearch')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />

            {notes.length === 0 ? (
              <p className="field__hint">{t('linkNoNotes')}</p>
            ) : (
              <ul className="link-picker">
                {notes.map((item) => (
                  <li key={item.id}>
                    <label className={`link-picker__row ${chosen === item.id ? 'is-chosen' : ''}`}>
                      <input
                        type="radio"
                        name={ids.search}
                        checked={chosen === item.id}
                        onChange={() => setChosen(item.id)}
                      />
                      <span className="link-picker__id">{shortId(item.id)}</span>
                      <span className="link-picker__title">{noteTitle(item, t('untitled'))}</span>
                      {item.status && (
                        <span className={`status-badge status-badge--${item.status}`}>
                          {statusLabel(t, item.status)}
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
        )}
      </div>
    </Dialog>,
    document.body,
  )
}
