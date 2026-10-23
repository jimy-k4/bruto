import { useId, useRef } from 'react'
import type { Environment, Workspace } from '../types'
import { environmentId, projectEnvironments } from '../domain/environments'
import { useI18n } from '../i18n'
import { SidePanel } from '../ui/SidePanel'

interface WorkspaceEditorProps {
  workspace: Workspace
  folderName: string
  onChange: (patch: Partial<Pick<Workspace, 'title' | 'description' | 'environments'>>) => void
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
  const environments = projectEnvironments(workspace)
  const focusEnvironment = useRef<number | null>(null)

  // Any change makes the list the project's own: the defaults are only a starting point.
  const setEnvironments = (next: Environment[]) => onChange({ environments: next })
  const changeEnvironment = (index: number, patch: Partial<Environment>) =>
    setEnvironments(
      environments.map((item, position) => (position === index ? { ...item, ...patch } : item)),
    )
  const moveEnvironment = (index: number, by: -1 | 1) => {
    const next = [...environments]

    ;[next[index], next[index + by]] = [next[index + by], next[index]]
    setEnvironments(next)
  }
  const addEnvironment = () => {
    const name = t('newEnvironment')

    focusEnvironment.current = environments.length
    setEnvironments([...environments, { id: environmentId(name, environments), name }])
  }

  return (
    <SidePanel
      eyebrow={t('editProject')}
      title={workspace.title}
      onClose={onClose}
      footer={
        <button
          data-superveil="click:workspace-editor:done"
          type="button"
          className="button button--primary button--block"
          onClick={onClose}
        >
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

        {/* In the order a change goes through them, production last. */}
        <fieldset className="field">
          <legend className="field__label">{t('environments')}</legend>

          {environments.length > 0 ? (
            <ol className="link-list environment-list">
              {environments.map((environment, index) => (
                <li key={environment.id} className="link-list__row environment-list__row">
                  <input
                    ref={(element) => {
                      // A new environment gets the focus, its name selected, ready to type over.
                      if (element && focusEnvironment.current === index) {
                        element.focus()
                        element.select()
                        focusEnvironment.current = null
                      }
                    }}
                    className="input"
                    aria-label={t('environmentName', { number: index + 1 })}
                    value={environment.name}
                    onChange={(event) =>
                      changeEnvironment(index, { name: event.target.value.toUpperCase() })
                    }
                  />
                  <button
                    data-superveil="click:workspace-editor:environment-protected"
                    type="button"
                    className="button button--small button--toggle"
                    aria-pressed={Boolean(environment.protected)}
                    title={t('environmentProtectedHint')}
                    onClick={() =>
                      changeEnvironment(index, { protected: !environment.protected || undefined })
                    }
                  >
                    {t('environmentProtected')}
                  </button>
                  <button
                    data-superveil="click:workspace-editor:environment-up"
                    type="button"
                    className="icon-button"
                    aria-label={t('moveEnvironmentUp', { name: environment.name })}
                    disabled={index === 0}
                    onClick={() => moveEnvironment(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    data-superveil="click:workspace-editor:environment-down"
                    type="button"
                    className="icon-button"
                    aria-label={t('moveEnvironmentDown', { name: environment.name })}
                    disabled={index === environments.length - 1}
                    onClick={() => moveEnvironment(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    data-superveil="click:workspace-editor:remove-environment"
                    type="button"
                    className="icon-button"
                    aria-label={t('removeItem', { name: environment.name })}
                    onClick={() =>
                      setEnvironments(environments.filter((_, position) => position !== index))
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="field__hint">{t('noEnvironments')}</p>
          )}

          <p className="field__hint">{t('environmentsHint')}</p>

          <div className="button-row">
            <button
              data-superveil="click:workspace-editor:add-environment"
              type="button"
              className="button button--small"
              onClick={addEnvironment}
            >
              + {t('addEnvironment')}
            </button>
            {workspace.environments && (
              <button
                data-superveil="click:workspace-editor:default-environments"
                type="button"
                className="link-button"
                onClick={() => onChange({ environments: undefined })}
              >
                {t('defaultEnvironments')}
              </button>
            )}
          </div>
        </fieldset>

        <div className="field">
          <span className="field__label">{t('projectFolder')}</span>
          <p className="field__value">{folderName}/.bruto/workspace.json</p>
        </div>
      </div>
    </SidePanel>
  )
}
