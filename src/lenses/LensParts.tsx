import type { ReactNode } from 'react'
import type { Note } from '../types'
import { LensIcon, type LensIconName } from './LensIcon'
import { elementClasses, type LensContext } from './lensContext'

const MAX_MARKS = 8

/** One square per note, in its status colour: the same marks as the file map. */
export function Marks({ notes }: { notes: Note[] }) {
  if (notes.length === 0) return null

  return (
    <span className="lens-marks" aria-hidden="true">
      {notes.slice(0, MAX_MARKS).map((note) => (
        <span
          key={note.id}
          className={`structure-block__mark status-badge--${note.status ?? 'none'}`}
        />
      ))}
      {notes.length > MAX_MARKS && <span>+{notes.length - MAX_MARKS}</span>}
    </span>
  )
}

export function LensSection({
  icon,
  title,
  count,
  children,
  wide = false,
}: {
  icon: LensIconName
  title: string
  count: number
  children: ReactNode
  wide?: boolean
}) {
  if (count === 0) return null

  return (
    <section className={`lens-section ${wide ? 'lens-section--wide' : ''}`}>
      <h3 className="lens-section__title">
        <LensIcon name={icon} />
        {title}
        <span className="lens-section__count">{count}</span>
      </h3>
      {children}
    </section>
  )
}

/** A small labelled block: the unit most lens sections are built from. */
export function LensTile({
  context,
  focusKey,
  icon,
  name,
  meta,
  paths,
  title,
}: {
  context: LensContext
  focusKey: string
  icon: LensIconName
  name: string
  meta?: ReactNode
  paths: string[]
  title?: string
}) {
  const notes = context.notesFor(paths)

  return (
    <button
      type="button"
      className={elementClasses('lens-tile', context, focusKey, paths, notes)}
      aria-pressed={context.focusKey === focusKey}
      title={title ?? [name, ...paths].join('\n')}
      onClick={() => context.onFocus({ key: focusKey, label: name, paths })}
    >
      <LensIcon name={icon} />
      <span className="lens-tile__text">
        <span className="lens-tile__name">{name}</span>
        {meta && <span className="lens-tile__meta">{meta}</span>}
      </span>
      <Marks notes={notes} />
    </button>
  )
}
