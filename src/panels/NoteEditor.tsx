import { useEffect, useId, useRef, useState } from 'react'
import type { Note, NoteStatus } from '../types'
import { NOTE_STATUSES } from '../domain/constants'
import { shortId, type NotePatch } from '../domain/workspace'
import { statusLabel, useI18n } from '../i18n'
import { FileTable } from '../ui/FileTable'
import { ProjectImage } from '../ui/ProjectImage'
import { SidePanel } from '../ui/SidePanel'
import { ColorPicker, PatternPicker } from '../ui/StylePicker'

interface NoteEditorProps {
  note: Note
  /** Focus and select the title (new notes, keyboard opening). */
  focusTitle: boolean
  onChange: (patch: NotePatch) => void
  onClose: () => void
  onDelete: () => void
  onAddFiles: () => void
  onOpenFile: (path: string) => void
  onAddImages: (images: File[]) => void
  onOpenStatusStyles: () => void
}

export function NoteEditor({
  note,
  focusTitle,
  onChange,
  onClose,
  onDelete,
  onAddFiles,
  onOpenFile,
  onAddImages,
  onOpenStatusStyles,
}: NoteEditorProps) {
  const { t } = useI18n()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const ids = {
    title: useId(),
    status: useId(),
    description: useId(),
    url: useId(),
    ai: useId(),
    feedback: useId(),
  }

  useEffect(() => {
    if (focusTitle) {
      titleRef.current?.focus()
      titleRef.current?.select()
    }
  }, [focusTitle, note.id])

  // Ctrl+Enter from any field closes the editor: everything is already saved.
  const closeOnCtrlEnter = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      onClose()
    }
  }

  const removeFrom = (key: 'filePaths' | 'images', path: string) =>
    onChange({ [key]: note[key].filter((item) => item !== path) })

  return (
    <SidePanel
      eyebrow={t('editNote')}
      title={`#${shortId(note.id)}`}
      headerClassName={`side-panel__header--painted note-color-${note.colorTheme} note-pattern-${note.pattern}`}
      onClose={onClose}
      autoFocus={false}
      footer={
        <button type="button" className="button button--primary button--block" onClick={onClose}>
          {t('done')}{' '}
          <kbd>
            {t('keyCtrl')} {t('keyEnter')}
          </kbd>
        </button>
      }
    >
      <div className="form" onKeyDown={closeOnCtrlEnter}>
        <div className="field">
          <label className="field__label" htmlFor={ids.title}>
            {t('title')}
          </label>
          <input
            id={ids.title}
            ref={titleRef}
            className="input"
            value={note.title}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor={ids.status}>
            {t('status')}
          </label>
          <div className="field__row">
            <select
              id={ids.status}
              className="select select--full"
              value={note.status ?? ''}
              onChange={(event) =>
                onChange({ status: (event.target.value || undefined) as NoteStatus | undefined })
              }
            >
              <option value="">{t('noStatus')}</option>
              {NOTE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(t, status)}
                </option>
              ))}
            </select>
          </div>
          {note.status === 'loop' && <p className="field__hint">{t('loopStatusHint')}</p>}
          <button type="button" className="link-button" onClick={onOpenStatusStyles}>
            {t('customizeStatuses')} →
          </button>
        </div>

        <div className="field">
          <label className="field__label" htmlFor={ids.description}>
            {t('description')}
          </label>
          <textarea
            id={ids.description}
            className="textarea"
            rows={7}
            value={note.description}
            onChange={(event) => onChange({ description: event.target.value })}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor={ids.url}>
            {t('webLink')}
          </label>
          <input
            id={ids.url}
            className="input"
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={note.webUrl}
            onChange={(event) => onChange({ webUrl: event.target.value })}
          />
        </div>

        <fieldset className="field">
          <legend className="field__label">{t('files')}</legend>

          {note.filePaths.length > 0 ? (
            <FileTable
              paths={note.filePaths}
              onOpen={onOpenFile}
              onRemove={(path) => removeFrom('filePaths', path)}
            />
          ) : (
            <p className="field__hint">{t('noFiles')}</p>
          )}

          <button type="button" className="button button--small" onClick={onAddFiles}>
            + {t('addFiles')}
          </button>
        </fieldset>

        <fieldset
          className="field image-drop"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            onAddImages([...event.dataTransfer.files])
          }}
        >
          <legend className="field__label">{t('images')}</legend>

          {note.images.length > 0 && (
            <ul className="image-grid">
              {note.images.map((path) => (
                <li key={path} className="image-grid__item">
                  <button
                    type="button"
                    className="image-grid__open"
                    onClick={() => onOpenFile(path)}
                    aria-label={t('openImage', { name: path.split('/').pop()! })}
                  >
                    <ProjectImage path={path} alt="" className="image-grid__image" />
                  </button>
                  <button
                    type="button"
                    className="icon-button icon-button--small image-grid__remove"
                    onClick={() => removeFrom('images', path)}
                    aria-label={t('removeItem', { name: path.split('/').pop()! })}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="field__hint">{t('imagesHint')}</p>

          <button
            type="button"
            className="button button--small"
            onClick={() => imageInputRef.current?.click()}
          >
            + {t('addImages')}
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              onAddImages([...(event.target.files ?? [])])
              event.target.value = ''
            }}
          />
        </fieldset>

        <div className="field">
          <label className="field__label" htmlFor={ids.ai}>
            {t('aiResponse')}
          </label>
          <textarea
            id={ids.ai}
            className="textarea textarea--mono"
            rows={4}
            placeholder={t('aiResponsePlaceholder')}
            value={note.aiResponse ?? ''}
            onChange={(event) => onChange({ aiResponse: event.target.value })}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor={ids.feedback}>
            {t('feedback')}
          </label>
          <textarea
            id={ids.feedback}
            className="textarea"
            rows={3}
            placeholder={t('feedbackPlaceholder')}
            value={note.feedback ?? ''}
            onChange={(event) => onChange({ feedback: event.target.value })}
          />

          {/* Written feedback only reaches the AI if the note goes back to it. */}
          {/* A rule stays a rule: feedback on it is read on the next task anyway. */}
          {note.feedback?.trim() &&
            note.status !== 'changes-requested' &&
            note.status !== 'loop' && (
              <div className="suggestion">
                <p>{t('feedbackStatusHint', { status: statusLabel(t, 'changes-requested') })}</p>
                <button
                  type="button"
                  className="button button--small"
                  onClick={() => onChange({ status: 'changes-requested' })}
                >
                  {t('markAsStatus', { status: statusLabel(t, 'changes-requested') })}
                </button>
              </div>
            )}
        </div>

        <ColorPicker
          label={t('color')}
          value={note.colorTheme}
          preview={{ color: note.colorTheme, pattern: note.pattern }}
          onChange={(colorTheme) => onChange({ colorTheme })}
        />

        <PatternPicker
          label={t('pattern')}
          value={note.pattern}
          preview={{ color: note.colorTheme, pattern: note.pattern }}
          onChange={(pattern) => onChange({ pattern })}
        />

        <div className="danger-zone">
          {confirmingDelete ? (
            <div
              className="danger-zone__confirm"
              role="alertdialog"
              aria-label={t('deleteNoteQuestion')}
            >
              <strong>{t('deleteNoteQuestion')}</strong>
              <p>{t('deleteNoteUndoHint')}</p>
              <div className="button-row">
                <button type="button" className="button" onClick={() => setConfirmingDelete(false)}>
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  className="button button--danger"
                  onClick={onDelete}
                  autoFocus
                >
                  {t('delete')}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="button button--danger"
              onClick={() => setConfirmingDelete(true)}
            >
              {t('deleteNote')}
            </button>
          )}
        </div>
      </div>
    </SidePanel>
  )
}
