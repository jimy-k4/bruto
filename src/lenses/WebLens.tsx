import type { TranslationKey } from '../i18n'
import { useI18n } from '../i18n'
import { LensIcon, type LensIconName } from './LensIcon'
import { LensSection, LensTile, Marks } from './LensParts'
import { elementClasses, type LensContext } from './lensContext'
import type { WebElement, WebModel, WebRole } from './web'

/** Roles after pages and components, in the order they are shown. */
const GROUPS: { role: WebRole; icon: LensIconName; title: TranslationKey }[] = [
  { role: 'layout', icon: 'layout', title: 'lensLayouts' },
  { role: 'server', icon: 'server', title: 'lensServer' },
  { role: 'hook', icon: 'hook', title: 'lensHooks' },
  { role: 'store', icon: 'store', title: 'lensStores' },
  { role: 'service', icon: 'service', title: 'lensServices' },
  { role: 'entry', icon: 'entry', title: 'lensEntries' },
  { role: 'style', icon: 'style', title: 'lensStyles' },
  { role: 'asset', icon: 'asset', title: 'lensAssets' },
  { role: 'config', icon: 'config', title: 'lensConfig' },
  { role: 'test', icon: 'test', title: 'lensTests' },
]

/** Screens it shows at most per frame before "+N". */
const MAX_BRICKS = 8

const byRoute = (a: WebElement, b: WebElement) =>
  (a.route ?? `~${a.name}`).localeCompare(b.route ?? `~${b.name}`)

/** A web app as screens (with the components on them), a wall of components and its layers. */
export function WebLens({ model, context }: { model: WebModel; context: LensContext }) {
  const { t } = useI18n()
  const byPath = new Map(model.elements.map((element) => [element.path, element]))
  const of = (role: WebRole) => model.elements.filter((element) => element.role === role)
  const pages = of('page').sort(byRoute)
  const components = of('component').sort(
    (a, b) => b.usedBy - a.usedBy || a.name.localeCompare(b.name),
  )
  const maxUse = Math.max(1, ...components.map((component) => component.usedBy))

  if (model.elements.length === 0) {
    return <p className="structure__message">{t('lensEmpty')}</p>
  }

  return (
    <div className="lens">
      <LensSection icon="page" title={t('lensScreens')} count={pages.length} wide>
        <div className="lens-screens">
          {pages.map((page) => {
            const key = `web:${page.path}`
            const notes = context.notesFor([page.path])
            const bricks = page.uses
              .map((path) => byPath.get(path))
              .filter((element): element is WebElement => element?.role === 'component')

            return (
              <button
                key={page.path}
                type="button"
                className={elementClasses('lens-screen', context, key, [page.path], notes)}
                aria-pressed={context.focusKey === key}
                title={page.path}
                onClick={() =>
                  context.onFocus({ key, label: page.route ?? page.name, paths: [page.path] })
                }
              >
                <span className="lens-screen__bar" aria-hidden="true">
                  <span className="lens-screen__dots" />
                  <span className="lens-screen__url">{page.route ?? t('noRoute')}</span>
                </span>
                <span className="lens-screen__body">
                  <span className="lens-screen__name">{page.name}</span>
                  <span className="lens-screen__bricks">
                    {bricks.slice(0, MAX_BRICKS).map((brick) => (
                      <span key={brick.path} className="lens-brick">
                        {brick.name}
                      </span>
                    ))}
                    {bricks.length > MAX_BRICKS && (
                      <span className="lens-brick lens-brick--more">
                        +{bricks.length - MAX_BRICKS}
                      </span>
                    )}
                  </span>
                </span>
                <span className="lens-screen__foot">
                  <span className="lens-screen__path">{page.path}</span>
                  <Marks notes={notes} />
                </span>
              </button>
            )
          })}
        </div>
      </LensSection>

      <LensSection icon="component" title={t('lensComponents')} count={components.length} wide>
        <div className="lens-wall">
          {components.map((component) => {
            const key = `web:${component.path}`
            const notes = context.notesFor([component.path])

            return (
              <button
                key={component.path}
                type="button"
                className={elementClasses(
                  'lens-brick-block',
                  context,
                  key,
                  [component.path],
                  notes,
                )}
                // The more a component is used, the bigger its brick.
                style={{ flexGrow: 1 + (component.usedBy / maxUse) * 3 }}
                aria-pressed={context.focusKey === key}
                title={component.path}
                onClick={() =>
                  context.onFocus({ key, label: component.name, paths: [component.path] })
                }
              >
                <LensIcon name="component" />
                <span className="lens-brick-block__name">{component.name}</span>
                <span className="lens-brick-block__uses">
                  {t('usesCount', { count: component.usedBy })}
                </span>
                <Marks notes={notes} />
              </button>
            )
          })}
        </div>
      </LensSection>

      {GROUPS.map((group) => {
        const elements = of(group.role).sort(byRoute)

        return (
          <LensSection
            key={group.role}
            icon={group.icon}
            title={t(group.title)}
            count={elements.length}
          >
            <div className="lens-tiles">
              {elements.map((element) => (
                <LensTile
                  key={element.path}
                  context={context}
                  focusKey={`web:${element.path}`}
                  icon={group.icon}
                  name={element.name}
                  meta={element.route ?? element.path}
                  paths={[element.path]}
                />
              ))}
            </div>
          </LensSection>
        )
      })}
    </div>
  )
}
