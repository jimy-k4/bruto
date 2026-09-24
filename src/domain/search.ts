import type { Note, NoteStatus } from '../types'

/** Things a note can have or lack, to filter by. */
export type NoteTrait = 'files' | 'aiResponse' | 'images' | 'webUrl'

export const NOTE_TRAITS: NoteTrait[] = ['files', 'aiResponse', 'images', 'webUrl']

/** Per trait: only notes with it (`true`), only notes without it (`false`), or either (absent). */
export type TraitFilter = Partial<Record<NoteTrait, boolean>>

export interface NoteSearch {
  query: string
  /** Only notes with one of these statuses; empty means any status. */
  statuses: NoteStatus[]
  traits?: TraitFilter
}

export const hasTrait: Record<NoteTrait, (note: Note) => boolean> = {
  files: (note) => note.filePaths.length > 0,
  aiResponse: (note) => Boolean(note.aiResponse?.trim()),
  images: (note) => note.images.length > 0,
  webUrl: (note) => Boolean(note.webUrl.trim()),
}

/** Any → with → without → any: the order a trait filter button goes through. */
export const nextTraitFilter = (current: boolean | undefined) =>
  current === undefined ? true : current ? false : undefined

const traitEntries = (search: NoteSearch) =>
  Object.entries(search.traits ?? {}).filter(
    (entry): entry is [NoteTrait, boolean] => typeof entry[1] === 'boolean',
  )

export const EMPTY_SEARCH: NoteSearch = { query: '', statuses: [] }

/** Lower case and without accents, so "revision" finds "Revisión". */
export const normalizeText = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export const isSearchActive = (search: NoteSearch) =>
  search.query.trim() !== '' || search.statuses.length > 0 || traitEntries(search).length > 0

const searchableText = (note: Note) =>
  normalizeText(
    [
      note.title,
      note.description,
      note.webUrl,
      note.aiResponse ?? '',
      note.feedback ?? '',
      ...note.filePaths,
      ...(note.aiFilePaths ?? []),
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
  const traits = traitEntries(search)

  return notes
    .filter((note) => {
      if (search.statuses.length > 0 && !(note.status && search.statuses.includes(note.status))) {
        return false
      }

      if (traits.some(([trait, wanted]) => hasTrait[trait](note) !== wanted)) return false

      const text = searchableText(note)
      const id = note.id.toLowerCase()

      return words.every((word, index) => text.includes(word) || id.startsWith(ids[index]))
    })
    .sort((a, b) => a.y - b.y || a.x - b.x)
}
