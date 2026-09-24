import { useId } from 'react'
import type { Workspace } from '../types'
import { useI18n } from '../i18n'
import { SidePanel } from '../ui/SidePanel'

interface WorkspaceEditorProps {
  workspace: Workspace
  folderName: string
  onChange: (patch: Partial<Pick<Workspace, 'title' | 'description'>>) => void
  onClose: () => void
}

export function WorkspaceEditor({
  workspace,
  folderName,
  onChange,
  onClose,
}: WorkspaceEditorProps) {
  const { t } = useI18n()
  const titleId = useId()
  const descriptionId = useId()

  return (
    <SidePanel
      eyebrow={t('editProject')}
      title={workspace.title}
      onClose={onClose}
      footer={
        <button type="button" className="button button--primary button--block" onClick={onClose}>
          {t('done')}
        </button>
      }
    >
      <div className="form">
        <div className="field">
          <label className="field__label" htmlFor={titleId}>
            {t('title')}
          </label>
          <input
            id={titleId}
            className="input"
            value={workspace.title}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor={descriptionId}>
            {t('description')}
          </label>
          <textarea
            id={descriptionId}
            className="textarea"
            rows={10}
            value={workspace.description}
            onChange={(event) => onChange({ description: event.target.value })}
          />
          <p className="field__hint">{t('projectDescriptionHint')}</p>
        </div>

        <div className="field">
          <span className="field__label">{t('projectFolder')}</span>
          <p className="field__value">{folderName}/.bruto/workspace.json</p>
        </div>
      </div>
    </SidePanel>
  )
}
