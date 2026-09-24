import { useId } from 'react'
import type { Note, NoteStatus } from '../types'
import { NOTE_STATUSES } from '../domain/constants'
import type { NotePatch } from '../domain/workspace'
import { statusLabel, useI18n } from '../i18n'
import { SidePanel } from '../ui/SidePanel'
import { ColorPicker, PatternPicker } from '../ui/StylePicker'

interface BulkEditorProps {
  notes: Note[]
  onChange: (patch: NotePatch) => void
  onDelete: () => void
  onClose: () => void
}

/** The value all notes share, or undefined when they differ. */
function shared<K extends keyof Note>(notes: Note[], key: K): Note[K] | undefined {
  const first = notes[0]?.[key]

  return notes.every((note) => note[key] === first) ? first : undefined
}

/**
 * Edits what makes sense for several notes at once: status and look. Texts
 * and files belong to each note, so they are left out.
 */
export function BulkEditor({ notes, onChange, onDelete, onClose }: BulkEditorProps) {
  const { t } = useI18n()
  const statusId = useId()
  const sameStatus = notes.every((note) => note.status === notes[0]?.status)
  const statusValue = sameStatus ? (notes[0]?.status ?? '') : 'mixed'
  const color = shared(notes, 'colorTheme')
  const pattern = shared(notes, 'pattern')
  const preview = { color: color ?? 'concrete', pattern: pattern ?? 'raw' } as const

  return (
    <SidePanel
      eyebrow={t('editSelection')}
      title={t('notesCount', { count: notes.length })}
      onClose={onClose}
      footer={
        <button type="button" className="button button--primary button--block" onClick={onClose}>
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
          <button type="button" className="button button--danger" onClick={onDelete}>
            {t('deleteNotesCount', { count: notes.length })}
          </button>
        </div>
      </div>
    </SidePanel>
  )
}
