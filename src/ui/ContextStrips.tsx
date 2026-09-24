import type { Note } from '../types'

/** More strips than this would be too thin to read. */
const MAX_STRIPS = 5

/**
 * Paints a copy button with the notes it copies: one equal strip per note,
 * using the same color and pattern classes as the cards. Renders nothing for
 * an empty list, so the button keeps its default look.
 */
export function ContextStrips({ notes }: { notes: Pick<Note, 'colorTheme' | 'pattern'>[] }) {
  if (notes.length === 0) {
    return null
  }

  return (
    <span className="context-strips" aria-hidden="true">
      {notes.slice(0, MAX_STRIPS).map((note, index) => (
        <span
          key={index}
          className={`note-color-${note.colorTheme} note-pattern-${note.pattern}`}
        />
      ))}
    </span>
  )
}
