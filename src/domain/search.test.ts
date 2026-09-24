import { describe, expect, it } from 'vitest'
import type { Note } from '../types'
import { EMPTY_SEARCH, searchNotes } from './search'

const note = (id: string, patch: Partial<Note> = {}): Note => ({
  id,
  title: '',
  description: '',
  filePaths: [],
  webUrl: '',
  images: [],
  x: 0,
  y: 0,
  zIndex: 1,
  colorTheme: 'concrete',
  pattern: 'raw',
  ...patch,
})

const ids = (notes: Note[]) => notes.map((item) => item.id)

describe('searchNotes', () => {
  it('finds nothing without a query or a status', () => {
    expect(searchNotes([note('a', { title: 'Login' })], EMPTY_SEARCH)).toEqual([])
    expect(searchNotes([note('a', { title: 'Login' })], { query: '   ', statuses: [] })).toEqual([])
  })

  it('ignores case and accents', () => {
    const notes = [note('a', { title: 'Revisión del LOGIN' }), note('b', { title: 'Otro' })]

    expect(ids(searchNotes(notes, { query: 'revision login', statuses: [] }))).toEqual(['a'])
  })

  it('looks in every text the note has', () => {
    const notes = [
      note('a', { description: 'falla el token' }),
      note('b', { filePaths: ['src/auth/token.ts'] }),
      note('c', { aiResponse: 'renovado el token' }),
      note('d', { feedback: 'el token sigue caducando' }),
      note('e', { webUrl: 'https://example.com/token' }),
      note('g', { aiFilePaths: ['src/token/refresh.ts'] }),
      note('f', { title: 'nada' }),
    ]

    expect(ids(searchNotes(notes, { query: 'token', statuses: [] }))).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'g',
    ])
  })

  it('needs every word, in any order', () => {
    const notes = [note('a', { title: 'buscador pizarra' }), note('b', { title: 'buscador' })]

    expect(ids(searchNotes(notes, { query: 'pizarra buscador', statuses: [] }))).toEqual(['a'])
  })

  it('finds a note by its short id, with or without brackets', () => {
    const notes = [note('894c20ab-1111'), note('07cc95cd-2222')]

    expect(ids(searchNotes(notes, { query: '894c20', statuses: [] }))).toEqual(['894c20ab-1111'])
    expect(ids(searchNotes(notes, { query: '[07CC95]', statuses: [] }))).toEqual(['07cc95cd-2222'])
  })

  it('filters by status, alone or with a query', () => {
    const notes = [
      note('a', { title: 'login', status: 'review' }),
      note('b', { title: 'login', status: 'todo' }),
      note('c', { title: 'perfil', status: 'review' }),
      note('d', { title: 'login' }),
    ]

    expect(ids(searchNotes(notes, { query: '', statuses: ['review'] }))).toEqual(['a', 'c'])
    expect(ids(searchNotes(notes, { query: 'login', statuses: ['review', 'todo'] }))).toEqual([
      'a',
      'b',
    ])
  })

  it('returns notes in reading order', () => {
    const notes = [
      note('bottom', { title: 'x', x: 0, y: 500 }),
      note('right', { title: 'x', x: 400, y: 0 }),
      note('left', { title: 'x', x: 0, y: 0 }),
    ]

    expect(ids(searchNotes(notes, { query: 'x', statuses: [] }))).toEqual([
      'left',
      'right',
      'bottom',
    ])
  })
})
