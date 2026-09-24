import type { Note, NoteStatus } from '../types'

export interface NoteSearch {
  query: string
  /** Only notes with one of these statuses; empty means any status. */
  statuses: NoteStatus[]
}

export const EMPTY_SEARCH: NoteSearch = { query: '', statuses: [] }

/** Lower case and without accents, so "revision" finds "Revisión". */
export const normalizeText = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export const isSearchActive = (search: NoteSearch) =>
  search.query.trim() !== '' || search.statuses.length > 0

const searchableText = (note: Note) =>
  normalizeText(
    [
      note.title,
      note.description,
      note.webUrl,
      note.aiResponse ?? '',
      note.feedback ?? '',
      ...note.filePaths,
    ].join('\n'),
  )

/**
 * Notes matching the search, in reading order (top to bottom, then left to
 * right) so "next" moves through the board the way the eye does.
 * Every word must appear; a word can also be the start of a note id, written
 * as in the AI context: `894c20` or `[894c20]`.
 */
export function searchNotes(notes: Note[], search: NoteSearch): Note[] {
  if (!isSearchActive(search)) return []

  const words = normalizeText(search.query).split(/\s+/).filter(Boolean)
  const ids = words.map((word) => word.replace(/^\[|\]$/g, ''))

  return notes
    .filter((note) => {
      if (search.statuses.length > 0 && !(note.status && search.statuses.includes(note.status))) {
        return false
      }

      const text = searchableText(note)
      const id = note.id.toLowerCase()

      return words.every((word, index) => text.includes(word) || id.startsWith(ids[index]))
    })
    .sort((a, b) => a.y - b.y || a.x - b.x)
}
