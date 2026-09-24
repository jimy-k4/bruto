import type { NoteColorTheme, NotePattern } from '../types'

/** One background strip for a
 * copy button: a note's resolved
 * color and pattern. */
export interface ContextStrip {
  color: NoteColorTheme
  pattern: NotePattern
}

/** CCoN paints at most this many
 * connected notes; more strips
 * would be too thin to read. */
const maxStrips = 5

/** Paints a copy button's
 * background with the notes it
 * copies: one equal strip per
 * note, reusing the same
 * note-color / note-pattern
 * classes the board renders cards
 * with. Renders nothing when there
 * are no notes, so the button
 * keeps its default look. The
 * button needs the
 * `context-painted` class. */
export function ContextStrips({ strips }: { strips: ContextStrip[] }) {
  if (strips.length === 0) {
    return null
  }

  return (
    <span className="context-strips" aria-hidden="true">
      {strips.slice(0, maxStrips).map((strip, index) => (
        <span key={index} className={`note-color-${strip.color} note-pattern-${strip.pattern}`} />
      ))}
    </span>
  )
}
