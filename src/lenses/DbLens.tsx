import type { TranslationKey } from '../i18n'
import { useI18n } from '../i18n'
import { CARD_HEADER, CARD_ROW, CARD_ROWS, layoutEr, type PlacedTable } from './erLayout'
import { LensIcon, type LensIconName } from './LensIcon'
import { LensSection, LensTile, Marks } from './LensParts'
import { elementClasses, type LensContext } from './lensContext'
import type { DbModel, Program, ProgramKind, Relation } from './plsql'

const PROGRAM_GROUPS: {
  kind: Exclude<ProgramKind, 'package'>
  icon: LensIconName
  title: TranslationKey
}[] = [
  { kind: 'view', icon: 'view', title: 'lensViews' },
  { kind: 'trigger', icon: 'trigger', title: 'lensTriggers' },
  { kind: 'procedure', icon: 'procedure', title: 'lensProcedures' },
  { kind: 'function', icon: 'function', title: 'lensFunctions' },
  { kind: 'sequence', icon: 'sequence', title: 'lensSequences' },
  { kind: 'type', icon: 'type', title: 'lensTypes' },
]

/** Members listed per package half before "+N". */
const MAX_MEMBERS = 8

const tableKey = (name: string) => `db:table:${name}`

/** Crow's foot size: the "many" end on the table holding the key, the bar on the other. */
const FOOT = 7

/**
 * The line of a relation: from the child's top up to the parent's bottom, with
 * a crow's foot on the child and a bar on the parent drawn into the same path.
 */
function relationPath(child: PlacedTable, parent: PlacedTable, offset: number): string {
  if (child.y > parent.y + parent.height) {
    const childX = child.x + child.width / 2 + offset
    const parentX = parent.x + parent.width / 2 + offset
    const top = child.y
    const bottom = parent.y + parent.height
    // Turn in the gap right above the child, so the line never runs behind another table.
    const middle = top - 24

    return [
      `M${childX},${top} V${middle} H${parentX} V${bottom}`,
      `M${childX - FOOT},${top} L${childX},${top - FOOT * 1.6} L${childX + FOOT},${top}`,
      `M${parentX - FOOT},${bottom + FOOT} H${parentX + FOOT}`,
    ].join(' ')
  }

  // Same level (a cycle) or pointing down: go round the side.
  const fromRight = child.x < parent.x
  const direction = fromRight ? 1 : -1
  const startX = fromRight ? child.x + child.width : child.x
  const endX = fromRight ? parent.x : parent.x + parent.width
  const startY = child.y + CARD_HEADER / 2 + offset
  const endY = parent.y + CARD_HEADER / 2 + offset
  const middle = startX + (endX - startX) / 2

  return [
    `M${startX},${startY} H${middle} V${endY} H${endX}`,
    `M${startX},${startY - FOOT} L${startX + direction * FOOT * 1.6},${startY} L${startX},${startY + FOOT}`,
    `M${endX - direction * FOOT},${endY - FOOT} V${endY + FOOT}`,
  ].join(' ')
}

/** An Oracle schema: tables and their keys as a diagram, then the PL/SQL around them. */
export function DbLens({ model, context }: { model: DbModel; context: LensContext }) {
  const { t } = useI18n()
  const layout = layoutEr(model.tables, model.relations)
  const placed = new Map(layout.tables.map((item) => [item.table.name, item]))
  const focusedTable = context.focusKey?.startsWith('db:table:')
    ? context.focusKey.slice('db:table:'.length)
    : null
  const touches = (relation: Relation, name: string | null) =>
    name !== null && (relation.from === name || relation.to === name)
  const related = new Set(
    model.relations
      .filter((relation) => touches(relation, focusedTable))
      .flatMap((relation) => [relation.from, relation.to]),
  )
  const packages = model.programs.filter((program) => program.kind === 'package')
  const focusTable = (name: string) => {
    const table = placed.get(name)?.table

    if (table) context.onFocus({ key: tableKey(name), label: name, paths: [table.path] })
  }

  if (model.tables.length === 0 && model.programs.length === 0) {
    return <p className="structure__message">{t('lensEmpty')}</p>
  }

  return (
    <div className="lens">
      <LensSection icon="table" title={t('lensTables')} count={model.tables.length} wide>
        <div className="lens-er-scroll">
          <div className="lens-er" style={{ width: layout.width + 8, height: layout.height + 8 }}>
            <svg
              className="lens-er__lines"
              width={layout.width + 8}
              height={layout.height + 8}
              aria-hidden="true"
            >
              {model.relations.map((relation, index) => {
                const child = placed.get(relation.from)
                const parent = placed.get(relation.to)

                if (!child || !parent || child === parent) return null

                // Several keys between the same tables get their own lines.
                const siblings = model.relations.filter(
                  (other) => other.from === relation.from && other.to === relation.to,
                )
                const offset = (siblings.indexOf(relation) - (siblings.length - 1) / 2) * 14

                return (
                  <path
                    key={index}
                    className={`lens-er__line ${touches(relation, focusedTable) ? 'is-active' : ''}`}
                    d={relationPath(child, parent, offset)}
                  />
                )
              })}
            </svg>

            {layout.tables.map(({ table, x, y, width, height }) => {
              const key = tableKey(table.name)
              const notes = context.notesFor([table.path])
              const foreign = new Set(
                model.relations
                  .filter((relation) => relation.from === table.name)
                  .flatMap((relation) => relation.fromColumns),
              )
              const classes = [
                elementClasses('lens-table', context, key, [table.path], notes),
                focusedTable &&
                  !related.has(table.name) &&
                  focusedTable !== table.name &&
                  'is-dimmed',
              ]

              return (
                <button
                  key={table.name}
                  type="button"
                  className={classes.filter(Boolean).join(' ')}
                  style={{ left: x, top: y, width, height }}
                  aria-pressed={context.focusKey === key}
                  title={`${table.name}
${table.path}`}
                  onClick={() => focusTable(table.name)}
                >
                  <span className="lens-table__head" style={{ height: CARD_HEADER }}>
                    <LensIcon name="table" />
                    <span className="lens-table__name">{table.name}</span>
                    <Marks notes={notes} />
                  </span>
                  {table.columns.slice(0, CARD_ROWS).map((column) => (
                    <span key={column.name} className="lens-column" style={{ height: CARD_ROW }}>
                      <span className="lens-column__key">
                        {column.primaryKey ? (
                          <abbr title={t('primaryKey')}>PK</abbr>
                        ) : foreign.has(column.name) ? (
                          <abbr title={t('foreignKey')}>FK</abbr>
                        ) : null}
                      </span>
                      <span className="lens-column__name" title={column.name}>
                        {column.name}
                      </span>
                      <span className="lens-column__type">{column.type}</span>
                    </span>
                  ))}
                  {table.columns.length > CARD_ROWS && (
                    <span className="lens-column lens-column--more" style={{ height: CARD_ROW }}>
                      +{table.columns.length - CARD_ROWS}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </LensSection>

      <LensSection icon="package" title={t('lensPackages')} count={packages.length} wide>
        <div className="lens-packages">
          {packages.map((pkg) => (
            <PackageBlock key={pkg.name} program={pkg} context={context} onTable={focusTable} />
          ))}
        </div>
      </LensSection>

      {PROGRAM_GROUPS.map((group) => {
        const programs = model.programs.filter((program) => program.kind === group.kind)

        return (
          <LensSection
            key={group.kind}
            icon={group.icon}
            title={t(group.title)}
            count={programs.length}
          >
            <div className="lens-tiles">
              {programs.map((program) => (
                <LensTile
                  key={program.name}
                  context={context}
                  focusKey={`db:${program.kind}:${program.name}`}
                  icon={group.icon}
                  name={program.name}
                  meta={
                    program.on
                      ? t('onTable', { table: program.on })
                      : program.tables.length > 0
                        ? program.tables.join(', ')
                        : undefined
                  }
                  paths={program.paths}
                />
              ))}
            </div>
          </LensSection>
        )
      })}
    </div>
  )
}

/** A package as two halves: what it offers (specification) and what it hides (body). */
function PackageBlock({
  program,
  context,
  onTable,
}: {
  program: Program
  context: LensContext
  onTable: (name: string) => void
}) {
  const { t } = useI18n()
  const key = `db:package:${program.name}`
  const notes = context.notesFor(program.paths)
  const members = program.members ?? []
  const publics = members.filter((member) => member.public)
  const privates = members.filter((member) => !member.public)

  const list = (items: typeof members) => (
    <ul className="lens-members">
      {items.slice(0, MAX_MEMBERS).map((member) => (
        <li key={member.name}>
          <LensIcon name={member.kind} />
          {member.name}
        </li>
      ))}
      {items.length > MAX_MEMBERS && <li>+{items.length - MAX_MEMBERS}</li>}
    </ul>
  )

  return (
    <article className={elementClasses('lens-package', context, key, program.paths, notes)}>
      <button
        type="button"
        className="lens-package__head"
        aria-pressed={context.focusKey === key}
        title={program.paths.join('\n')}
        onClick={() => context.onFocus({ key, label: program.name, paths: program.paths })}
      >
        <LensIcon name="package" />
        <span className="lens-package__name">{program.name}</span>
        <Marks notes={notes} />
      </button>

      <div className="lens-package__halves">
        <div className={`lens-package__half ${program.hasSpec ? '' : 'is-missing'}`}>
          <span className="eyebrow">{t('packageSpec')}</span>
          {program.hasSpec ? (
            list(publics)
          ) : (
            <span className="field__hint">{t('packageMissing')}</span>
          )}
        </div>
        <div className={`lens-package__half ${program.hasBody ? '' : 'is-missing'}`}>
          <span className="eyebrow">{t('packageBody')}</span>
          {program.hasBody ? (
            privates.length > 0 ? (
              <>
                <span className="field__hint">
                  {t('privateMembers', { count: privates.length })}
                </span>
                {list(privates)}
              </>
            ) : (
              <span className="field__hint">{t('privateMembers', { count: 0 })}</span>
            )
          ) : (
            <span className="field__hint">{t('packageMissing')}</span>
          )}
        </div>
      </div>

      {program.tables.length > 0 && (
        <div className="lens-resource__uses">
          <span className="eyebrow">{t('lensUses')}</span>
          {program.tables.map((table) => (
            <button
              key={table}
              type="button"
              className="lens-chip"
              title={table}
              onClick={() => onTable(table)}
            >
              {table}
            </button>
          ))}
        </div>
      )}
    </article>
  )
}
