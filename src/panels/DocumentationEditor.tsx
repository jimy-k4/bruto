import { useId, useState } from 'react'
import type { DocumentationType, WorkspaceDocumentation } from '../types'
import { useI18n, type TranslationKey } from '../i18n'
import { SidePanel } from '../ui/SidePanel'

interface DocumentationEditorProps {
  documentation: WorkspaceDocumentation
  isNew: boolean
  onSave: (documentation: WorkspaceDocumentation) => void
  onRemove: () => void
  onClose: () => void
}

const TYPES: { value: DocumentationType; label: TranslationKey }[] = [
  { value: 'web', label: 'documentationTypeWeb' },
  { value: 'obsidian', label: 'documentationTypeObsidian' },
  { value: 'notion', label: 'documentationTypeNotion' },
  { value: 'other', label: 'documentationTypeOther' },
]

/** A link to documentation that lives elsewhere (web, Obsidian, Notion…). */
export function DocumentationEditor({
  documentation,
  isNew,
  onSave,
  onRemove,
  onClose,
}: DocumentationEditorProps) {
  const { t } = useI18n()
  const [draft, setDraft] = useState(documentation)
  const [showErrors, setShowErrors] = useState(false)
  const ids = { name: useId(), type: useId(), url: useId() }
  const errors = {
    name: !draft.name.trim() ? t('documentationNeedsName') : null,
    url: !draft.url.trim() ? t('documentationNeedsLink') : null,
  }

  const save = () => {
    if (errors.name || errors.url) {
      setShowErrors(true)
      return
    }

    onSave({ ...draft, name: draft.name.trim(), url: draft.url.trim() })
  }

  return (
    <SidePanel
      eyebrow={t('documentation')}
      title={isNew ? t('addDocumentation') : draft.name || t('documentation')}
      onClose={onClose}
      footer={
        <div className="button-row">
          <button type="button" className="button" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="button" className="button button--primary" onClick={save}>
            {t('save')}
          </button>
        </div>
      }
    >
      <form
        className="form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <div className="field">
          <label className="field__label" htmlFor={ids.name}>
            {t('name')}
          </label>
          <input
            id={ids.name}
            className="input"
            value={draft.name}
            aria-invalid={showErrors && Boolean(errors.name)}
            aria-describedby={showErrors && errors.name ? `${ids.name}-error` : undefined}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
          {showErrors && errors.name && (
            <p id={`${ids.name}-error`} className="field__error">
              {errors.name}
            </p>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor={ids.type}>
            {t('type')}
          </label>
          <select
            id={ids.type}
            className="select select--full"
            value={draft.type}
            onChange={(event) =>
              setDraft({ ...draft, type: event.target.value as DocumentationType })
            }
          >
            {TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {t(type.label)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field__label" htmlFor={ids.url}>
            {t('link')}
          </label>
          <input
            id={ids.url}
            className="input"
            value={draft.url}
            placeholder="https://… / obsidian://…"
            aria-invalid={showErrors && Boolean(errors.url)}
            aria-describedby={showErrors && errors.url ? `${ids.url}-error` : `${ids.url}-hint`}
            onChange={(event) => setDraft({ ...draft, url: event.target.value })}
          />
          {showErrors && errors.url ? (
            <p id={`${ids.url}-error`} className="field__error">
              {errors.url}
            </p>
          ) : (
            <p id={`${ids.url}-hint`} className="field__hint">
              {t('documentationLinkHint')}
            </p>
          )}
        </div>

        {/* Enter in a field saves. */}
        <button type="submit" hidden />

        {!isNew && (
          <div className="danger-zone">
            <button type="button" className="button button--danger" onClick={onRemove}>
              {t('removeDocumentation')}
            </button>
          </div>
        )}
      </form>
    </SidePanel>
  )
}
