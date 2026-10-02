import { useEffect, useMemo, useRef, useState } from 'react'
import type { TranslationKey } from '../i18n'
import { useI18n } from '../i18n'
import { CARD_HEADER, CARD_ROW, CARD_ROWS, layoutEr, type PlacedTable } from './erLayout'
import { LensIcon, type LensIconName } from './LensIcon'
import { LensSection, LensTile, Marks } from './LensParts'
import { elementClasses, type LensContext } from './lensContext'
import type { DbModel, Program, ProgramKind, Relation } from './sql'
import { findTables, type TableMatch } from './tableSearch'

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
  { kind: 'policy', icon: 'policy', title: 'lensPolicies' },
]

/** Policies share names across tables ("Users read their own rows"): they are told apart by table. */
const programKey = (program: Program) =>
  program.kind === 'policy' ? `${program.name}@${program.on ?? ''}` : program.name

/** Search results listed before "+N": the diagram shows the rest. */
const MAX_RESULTS = 12

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

  // Finding one table among hundreds: by name or by a column, then straight to it.
  // Tables the code uses but no script creates are found too, though not drawn.
  const undeclared = useMemo(() => model.undeclared ?? [], [model.undeclared])
  const [query, setQuery] = useState('')
  const [current, setCurrent] = useState(-1)
  const matches = useMemo(
    () => findTables(model.tables, query, undeclared),
    [model.tables, query, undeclared],
  )
  const matched = new Set(matches.filter((match) => match.table).map((match) => match.name))
  const searching = query.trim() !== ''
  const tableElements = useRef(new Map<string, HTMLElement>())
  const searchInput = useRef<HTMLInputElement>(null)
  const diagramScroll = useRef<HTMLDivElement>(null)

  const goTo = ({ name, usedIn }: TableMatch) => {
    // Selected, not toggled: going to a table twice keeps it selected.
    const focused = context.focusKey === tableKey(name)

    // Not on the diagram: the side list shows the notes on the files that use it.
    if (usedIn) {
      if (!focused) context.onFocus({ key: tableKey(name), label: name, paths: usedIn })
      return
    }

    if (!focused) focusTable(name)

    // Only the diagram scrolls: the search and its results stay where they are.
    const element = tableElements.current.get(name)
    const diagram = diagramScroll.current

    if (element && diagram) {
      // Centred in the part of the diagram on screen: it may run past the bottom of the window.
      const box = diagram.getBoundingClientRect()
      const visibleTop = Math.max(box.top, 0) - box.top
      const visibleBottom = Math.min(box.bottom, window.innerHeight) - box.top
      const middle = (visibleTop + visibleBottom) / 2

      diagram.scrollTo({
        left: element.offsetLeft - (diagram.clientWidth - element.offsetWidth) / 2,
        top: element.offsetTop - middle + element.offsetHeight / 2,
        behavior: 'smooth',
      })
    }
  }

  const step = (direction: 1 | -1) => {
    if (matches.length === 0) return

    const next = (current + direction + matches.length) % matches.length

    setCurrent(next)
    goTo(matches[next])
  }

  // Ctrl+F looks for a table here, not on the board behind.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'f') return

      event.preventDefault()
      event.stopPropagation()
      searchInput.current?.focus()
      searchInput.current?.select()
    }

    window.addEventListener('keydown', onKeyDown, true)

    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  if (model.tables.length === 0 && model.programs.length === 0 && undeclared.length === 0) {
    return <p className="structure__message">{t('lensEmpty')}</p>
  }

  return (
    <div className="lens">
      <LensSection icon="table" title={t('lensTables')} count={model.tables.length} wide>
        <div className="lens-search">
          <input
            ref={searchInput}
            type="search"
            className="input"
            placeholder={t('tableSearch')}
            aria-label={t('tableSearch')}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setCurrent(-1)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                step(event.shiftKey ? -1 : 1)
              } else if (event.key === 'Escape' && query) {
                // Clears the search first; the next Escape leaves the view.
                event.stopPropagation()
                setQuery('')
              }
            }}
          />
          {searching && (
            <span className="lens-search__count" aria-live="polite">
              {t('tableSearchCount', {
                count: matches.length,
                total: model.tables.length + undeclared.length,
              })}
            </span>
          )}
        </div>

        {undeclared.length > 0 && (
          <p className="field__hint">
            {t('tableSearchUndeclaredHint', { count: undeclared.length })}
          </p>
        )}

        {searching &&
          (matches.length === 0 ? (
            <p className="field__hint">{t('tableSearchNone')}</p>
          ) : (
            <ul className="lens-search__results">
              {matches.slice(0, MAX_RESULTS).map((match, index) => (
                <li
                  key={match.name}
                  className={[
                    'lens-search__result',
                    index === current && 'is-current',
                    match.usedIn && 'is-undeclared',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <button
                    data-superveil="click:db-lens:table-search-column"
                    type="button"
                    className="lens-search__go"
                    title={match.usedIn?.join('\n')}
                    onClick={() => {
                      setCurrent(index)
                      goTo(match)
                    }}
                  >
                    <LensIcon name="table" />
                    <span className="lens-search__name">{match.name}</span>
                    {match.column && (
                      <span className="lens-search__column">
                        {t('tableSearchColumn', { name: match.column })}
                      </span>
                    )}
                    {match.usedIn && (
                      <span className="lens-search__column">
                        {t('tableSearchUndeclared', { count: match.usedIn.length })}
                      </span>
                    )}
                  </button>
                  <CopyName name={match.name} />
                </li>
              ))}
              {matches.length > MAX_RESULTS && (
                <li className="lens-search__more">+{matches.length - MAX_RESULTS}</li>
              )}
            </ul>
          ))}

        <div ref={diagramScroll} className="lens-er-scroll">
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
                  placed.has(focusedTable) &&
                  !related.has(table.name) &&
                  focusedTable !== table.name &&
                  'is-dimmed',
                searching && (matched.has(table.name) ? 'is-match' : 'is-dimmed'),
              ]

              return (
                <button
                  data-superveil="click:db-lens:row-level-security"
                  key={table.name}
                  ref={(element) => {
                    if (element) tableElements.current.set(table.name, element)
                    else tableElements.current.delete(table.name)
                  }}
                  type="button"
                  className={[...new Set(classes.filter(Boolean))].join(' ')}
                  style={{ left: x, top: y, width, height }}
                  aria-pressed={context.focusKey === key}
                  title={`${table.name}
${table.path}`}
                  onClick={() => focusTable(table.name)}
                >
                  <span className="lens-table__head" style={{ height: CARD_HEADER }}>
                    <LensIcon name="table" />
                    <span className="lens-table__name">{table.name}</span>
                    {table.rls && (
                      <abbr className="lens-table__rls" title={t('rowLevelSecurity')}>
                        <LensIcon name="lock" />
                      </abbr>
                    )}
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
                  key={programKey(program)}
                  context={context}
                  focusKey={`db:${program.kind}:${programKey(program)}`}
                  icon={group.icon}
                  name={program.name}
                  meta={
                    program.on
                      ? [t('onTable', { table: program.on }), program.command?.toUpperCase()]
                          .filter(Boolean)
                          .join(' · ')
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

/** Copies a table's name, to cite it in a note. */
function CopyName({ name }: { name: string }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return

    const timer = window.setTimeout(() => setCopied(false), 1500)

    return () => window.clearTimeout(timer)
  }, [copied])

  return (
    <button
      data-superveil="click:db-lens:copy-name"
      type="button"
      className="button button--small"
      aria-label={copied ? t('copied') : t('copyName', { name })}
      onClick={() =>
        void navigator.clipboard.writeText(name).then(
          () => setCopied(true),
          // Without clipboard access the name can still be read and typed.
          () => undefined,
        )
      }
    >
      {copied ? t('copied') : t('copy')}
    </button>
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
        data-superveil="click:db-lens:focus-program"
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
              data-superveil="click:db-lens:open-table"
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
