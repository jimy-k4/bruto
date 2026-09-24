import type { TranslationKey } from '../i18n'
import { useI18n } from '../i18n'
import { partFor, type ApiModel, type ApiPartKind } from './dotnet'
import { LensIcon, type LensIconName } from './LensIcon'
import { LensSection, LensTile, Marks } from './LensParts'
import { elementClasses, type LensContext } from './lensContext'

const LAYERS: { kind: ApiPartKind; icon: LensIconName; title: TranslationKey }[] = [
  { kind: 'service', icon: 'service', title: 'lensApiServices' },
  { kind: 'repository', icon: 'repository', title: 'lensRepositories' },
  { kind: 'data', icon: 'data', title: 'lensData' },
  { kind: 'model', icon: 'model', title: 'lensModels' },
  { kind: 'middleware', icon: 'middleware', title: 'lensMiddleware' },
  { kind: 'startup', icon: 'startup', title: 'lensStartup' },
  { kind: 'other', icon: 'other', title: 'lensOther' },
]

/** The part of a route after the resource's own prefix, so rows stay short. */
const relative = (route: string, base: string) =>
  base !== '/' && route.toLowerCase().startsWith(base.toLowerCase())
    ? route.slice(base.length) || '/'
    : route

/** A .NET API as resources with their endpoints, over the layers they rely on. */
export function ApiLens({ model, context }: { model: ApiModel; context: LensContext }) {
  const { t } = useI18n()

  if (model.resources.length === 0 && model.parts.length === 0) {
    return <p className="structure__message">{t('lensEmpty')}</p>
  }

  return (
    <div className="lens">
      <LensSection icon="controller" title={t('lensResources')} count={model.resources.length} wide>
        <div className="lens-resources">
          {model.resources.map((resource) => {
            const key = `api:${resource.path}:${resource.route}`
            const notes = context.notesFor([resource.path])
            const services = resource.uses
              .map((type) => ({ type, part: partFor(model.parts, type) }))
              .filter((dependency) => dependency.part)

            return (
              <article
                key={key}
                className={elementClasses('lens-resource', context, key, [resource.path], notes)}
              >
                <button
                  type="button"
                  className="lens-resource__head"
                  aria-pressed={context.focusKey === key}
                  title={resource.path}
                  onClick={() =>
                    context.onFocus({ key, label: resource.route, paths: [resource.path] })
                  }
                >
                  <LensIcon name={resource.kind === 'controller' ? 'controller' : 'server'} />
                  <span className="lens-resource__name">{resource.name}</span>
                  <span className="lens-resource__route">{resource.route}</span>
                  {resource.auth && (
                    <span title={t('requiresAuth')}>
                      <LensIcon name="lock" />
                    </span>
                  )}
                  <Marks notes={notes} />
                </button>

                <ul className="lens-endpoints">
                  {resource.endpoints.map((endpoint, index) => (
                    <li
                      key={`${endpoint.verb}:${endpoint.route}:${index}`}
                      className="lens-endpoint"
                    >
                      <span className={`lens-verb lens-verb--${endpoint.verb.toLowerCase()}`}>
                        {endpoint.verb}
                      </span>
                      <span className="lens-endpoint__route" title={endpoint.route}>
                        {relative(endpoint.route, resource.route)}
                      </span>
                      {endpoint.action && (
                        <span className="lens-endpoint__action" title={endpoint.action}>
                          {endpoint.action}
                        </span>
                      )}
                      {endpoint.auth && (
                        <span className="lens-endpoint__lock" title={t('requiresAuth')}>
                          <LensIcon name="lock" />
                        </span>
                      )}
                    </li>
                  ))}
                  {resource.endpoints.length === 0 && (
                    <li className="lens-endpoint lens-endpoint--empty">{t('noEndpoints')}</li>
                  )}
                </ul>

                {services.length > 0 && (
                  <div className="lens-resource__uses">
                    <span className="eyebrow">{t('lensUses')}</span>
                    {services.map(({ type, part }) => (
                      <button
                        key={type}
                        type="button"
                        className="lens-chip"
                        title={type}
                        onClick={() =>
                          context.onFocus({
                            key: `api:${part!.path}`,
                            label: part!.name,
                            paths: [part!.path],
                          })
                        }
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </LensSection>

      {LAYERS.map((layer) => {
        const parts = model.parts.filter((part) => part.kind === layer.kind)

        return (
          <LensSection
            key={layer.kind}
            icon={layer.icon}
            title={t(layer.title)}
            count={parts.length}
          >
            <div className="lens-tiles">
              {parts.map((part) => {
                const users = model.resources.filter((resource) =>
                  resource.uses.some((type) => partFor([part], type)),
                ).length

                return (
                  <LensTile
                    key={part.path}
                    context={context}
                    focusKey={`api:${part.path}`}
                    icon={layer.icon}
                    name={part.name}
                    meta={users > 0 ? t('usedByResources', { count: users }) : part.path}
                    paths={[part.path]}
                  />
                )
              })}
            </div>
          </LensSection>
        )
      })}
    </div>
  )
}
