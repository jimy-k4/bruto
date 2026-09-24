import type { Note } from '../types'

/** A place the side list shows notes for: one element of a lens. */
export interface LensFocus {
  key: string
  label: string
  paths: string[]
}

/** What every lens receives from the structure view. */
export interface LensContext {
  /** Notes that point at any of these files. */
  notesFor: (paths: string[]) => Note[]
  /** Whether these files belong to the notes selected on the board. */
  linked: (paths: string[]) => boolean
  focusKey: string | null
  onFocus: (focus: LensFocus) => void
}

/** Classes every clickable lens element shares: notes, board selection and focus. */
export function elementClasses(
  base: string,
  context: LensContext,
  key: string,
  paths: string[],
  notes: Note[],
) {
  return [
    base,
    notes.length > 0 && 'has-notes',
    context.linked(paths) && 'is-linked',
    context.focusKey === key && 'is-focused',
  ]
    .filter(Boolean)
    .join(' ')
}
