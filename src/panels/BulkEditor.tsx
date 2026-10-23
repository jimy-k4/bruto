import { useId } from 'react'
import type { Environment, Note, NoteKind, NoteStatus } from '../types'
import { NOTE_KINDS, NOTE_STATUSES } from '../domain/constants'
import type { NotePatch } from '../domain/workspace'
import { kindLabel, statusLabel, useI18n } from '../i18n'
import { SidePanel } from '../ui/SidePanel'
import { ColorPicker, PatternPicker } from '../ui/StylePicker'

interface BulkEditorProps {
  notes: Note[]
  /** The project's environments, production last. */
  environments: readonly Environment[]
  onChange: (patch: NotePatch) => void
  onDelete: () => void
  onClose: () => void
}

/** The placeholder for notes in different environments: a value no environment id takes. */
const MIXED = '*'

/** The value all notes share, or undefined when they differ. */
function shared<K extends keyof Note>(notes: Note[], key: K): Note[K] | undefined {
  const first = notes[0]?.[key]

  return notes.every((note) => note[key] === first) ? first : undefined
}

/**
 * Edits what makes sense for several notes at once: status, kind, environment and look. Texts
 * and files belong to each note, so they are left out.
 */
export function BulkEditor({ notes, environments, onChange, onDelete, onClose }: BulkEditorProps) {
  const { t } = useI18n()
  const statusId = useId()
  const sameStatus = notes.every((note) => note.status === notes[0]?.status)
  const statusValue = sameStatus ? (notes[0]?.status ?? '') : 'mixed'
  const kindId = useId()
  const sameKind = notes.every((note) => note.kind === notes[0]?.kind)
  const kindValue = sameKind ? (notes[0]?.kind ?? '') : 'mixed'
  const environmentId = useId()
  const sameEnvironment = notes.every((note) => note.environment === notes[0]?.environment)
  const environmentValue = sameEnvironment ? (notes[0]?.environment ?? '') : MIXED
  const color = shared(notes, 'colorTheme')
  const pattern = shared(notes, 'pattern')
  const preview = { color: color ?? 'concrete', pattern: pattern ?? 'raw' } as const

  return (
    <SidePanel
      eyebrow={t('editSelection')}
      title={t('notesCount', { count: notes.length })}
      onClose={onClose}
      footer={
        <button
          data-superveil="click:bulk-editor:done"
          type="button"
          className="button button--primary button--block"
          onClick={onClose}
        >
          {t('done')}
        </button>
      }
    >
      <div className="form">
        <p className="field__hint">{t('bulkEditHint')}</p>

        <div className="field">
          <label className="field__label" htmlFor={statusId}>
            {t('status')}
          </label>
          <select
            id={statusId}
            className="select select--full"
            value={statusValue}
            onChange={(event) =>
              event.target.value !== 'mixed' &&
              onChange({ status: (event.target.value || undefined) as NoteStatus | undefined })
            }
          >
            <option value="mixed" disabled>
              {t('mixedValues')}
            </option>
            <option value="">{t('noStatus')}</option>
            {NOTE_STATUSES.map((item) => (
              <option key={item} value={item}>
                {statusLabel(t, item)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field__label" htmlFor={kindId}>
            {t('kind')}
          </label>
          <select
            id={kindId}
            className="select select--full"
            value={kindValue}
            onChange={(event) =>
              event.target.value !== 'mixed' &&
              onChange({ kind: (event.target.value || undefined) as NoteKind | undefined })
            }
          >
            <option value="mixed" disabled>
              {t('mixedValues')}
            </option>
            {[undefined, ...NOTE_KINDS].map((item) => (
              <option key={item ?? 'task'} value={item ?? ''}>
                {kindLabel(t, item)}
              </option>
            ))}
          </select>
        </div>

        {environments.length > 0 && (
          <div className="field">
            <label className="field__label" htmlFor={environmentId}>
              {t('environment')}
            </label>
            <select
              id={environmentId}
              className="select select--full"
              value={environmentValue}
              onChange={(event) =>
                event.target.value !== MIXED &&
                onChange({ environment: event.target.value || undefined })
              }
            >
              <option value={MIXED} disabled>
                {t('mixedValues')}
              </option>
              <option value="">{t('noEnvironment')}</option>
              {environments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <ColorPicker
          label={t('color')}
          value={color}
          preview={preview}
          onChange={(colorTheme) => onChange({ colorTheme })}
        />

        <PatternPicker
          label={t('pattern')}
          value={pattern}
          preview={preview}
          onChange={(value) => onChange({ pattern: value })}
        />

        <div className="danger-zone">
          <button
            data-superveil="click:bulk-editor:delete-notes-count"
            type="button"
            className="button button--danger"
            onClick={onDelete}
          >
            {t('deleteNotesCount', { count: notes.length })}
          </button>
        </div>
      </div>
    </SidePanel>
  )
}
