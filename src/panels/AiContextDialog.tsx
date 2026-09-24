import { useId, useMemo, useState } from 'react'
import type { ContextScope, Note, Workspace } from '../types'
import { buildAiContext } from '../domain/aiContext'
import { getConnectedNoteIds } from '../domain/workspace'
import { useI18n, type TranslationKey } from '../i18n'
import { ContextStrips } from '../ui/ContextStrips'
import { Dialog } from '../ui/Dialog'

interface AiContextDialogProps {
  workspace: Workspace
  selectedIds: string[]
  copiedScope: ContextScope | null
  /** Copies exactly what the preview shows. */
  onCopy: (scope: ContextScope, text: string) => void
  onSaveContext: (text: string) => void
  onClose: () => void
}

const SCOPES: { scope: ContextScope; label: TranslationKey; key: string }[] = [
  { scope: 'current', label: 'copyCurrent', key: 'Q' },
  { scope: 'connected', label: 'copyConnected', key: 'W' },
  { scope: 'entire', label: 'copyEntire', key: 'E' },
]

/** Rough token count, to know if a copy will fit in a chat. */
const estimateTokens = (text: string) => Math.ceil(text.length / 4)

export function AiContextDialog({
  workspace,
  selectedIds,
  copiedScope,
  onCopy,
  onSaveContext,
  onClose,
}: AiContextDialogProps) {
  const { t } = useI18n()
  const contextId = useId()
  const [draft, setDraft] = useState(workspace.aiContext)
  const [scope, setScope] = useState<ContextScope>(selectedIds.length > 0 ? 'current' : 'entire')
  const hasSelection = selectedIds.length > 0
  const unsaved = draft !== workspace.aiContext

  const stripNotes = useMemo(() => {
    const selected = workspace.notes.filter((note) => selectedIds.includes(note.id))
    const connected = new Set(selectedIds.flatMap((id) => [...getConnectedNoteIds(workspace, id)]))

    return {
      current: selected,
      connected: workspace.notes.filter(
        (note) => connected.has(note.id) && !selectedIds.includes(note.id),
      ),
      entire: [] as Note[],
    }
  }, [workspace, selectedIds])

  const preview = useMemo(
    () => buildAiContext({ ...workspace, aiContext: draft }, scope, selectedIds),
    [workspace, draft, scope, selectedIds],
  )

  return (
    <Dialog
      size="large"
      eyebrow={t('aiContext')}
      title={workspace.title}
      description={t('aiContextDescription')}
      onClose={onClose}
      className="ai-dialog"
    >
      <div className="ai-dialog__layout">
        <section className="ai-dialog__context">
          <label className="field__label" htmlFor={contextId}>
            {t('globalContext')}
          </label>
          <textarea
            id={contextId}
            className="textarea textarea--mono ai-dialog__textarea"
            value={draft}
            placeholder={t('globalContextPlaceholder')}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck={false}
            data-autofocus
          />
          <p className="field__hint">{t('globalContextHint')}</p>

          <div className="button-row">
            <button
              type="button"
              className="button"
              onClick={() => setDraft(workspace.aiContext)}
              disabled={!unsaved}
            >
              {t('discard')}
            </button>
            <button
              type="button"
              className="button button--primary"
              onClick={() => onSaveContext(draft)}
              disabled={!unsaved}
            >
              {t('saveContext')}
            </button>
          </div>
        </section>

        <section className="ai-dialog__preview" aria-label={t('preview')}>
          <div className="scope-tabs" role="radiogroup" aria-label={t('whatToCopy')}>
            {SCOPES.map((item) => (
              <button
                key={item.scope}
                type="button"
                role="radio"
                aria-checked={scope === item.scope}
                className="context-button"
                disabled={item.scope !== 'entire' && !hasSelection}
                onClick={() => setScope(item.scope)}
              >
                <ContextStrips notes={stripNotes[item.scope]} />
                <span className="context-button__label">{t(item.label)}</span>
                <kbd>{item.key}</kbd>
              </button>
            ))}
          </div>

          <pre className="ai-dialog__output" tabIndex={0} aria-label={t('preview')}>
            {preview}
          </pre>

          <div className="button-row button-row--spread">
            <span className="field__hint">
              {t('tokenEstimate', { count: estimateTokens(preview).toLocaleString() })}
            </span>
            <button
              type="button"
              className="button button--primary"
              onClick={() => onCopy(scope, preview)}
            >
              {copiedScope === scope ? t('copied') : t('copy')}
            </button>
          </div>
        </section>
      </div>
    </Dialog>
  )
}
