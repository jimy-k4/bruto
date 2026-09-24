import { describe, expect, it } from 'vitest'
import { LOCALES, createTranslate } from '.'
import { es } from './locales/es'
import { en } from './locales/en'

/** Words that are the same in English and in some other languages. */
const SHARED_WORDS = new Set([
  'Zoom',
  'Idea',
  'Obsidian',
  'Notion',
  'Local',
  'Board',
  'Status',
  'Problem',
  'Color',
  'Type',
  'Name',
  'Link',
  'Documentation',
  'Description',
  'Actions',
  'Images',
  'Styles',
  'Note',
  'Ctrl',
  'Shift',
  'Enter',
  'Delete',
  'Del',
  'Web',
  '≈ {count} tokens',
  'Cobalt',
  'Indigo',
  'Diagonal',
  'Bands',
  'Triangles',
  'Sand',
  'Ochre',
  'Bug',
  '{count} notes',
])

const placeholders = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()

describe('translations', () => {
  const keys = Object.keys(es).filter((key) => !key.includes('_'))

  for (const [language, locale] of Object.entries(LOCALES)) {
    describe(language, () => {
      it('translates every key', () => {
        const missing = keys.filter((key) => !(locale as Record<string, string>)[key]?.trim())

        expect(missing).toEqual([])
      })

      it('keeps the same {placeholders}', () => {
        const broken = keys.filter((key) => {
          const text = (locale as Record<string, string>)[key]

          return (
            text && placeholders(text).join() !== placeholders(es[key as keyof typeof es]).join()
          )
        })

        expect(broken).toEqual([])
      })

      if (language !== 'en') {
        it('is not an untranslated copy of English', () => {
          const copied = keys.filter((key) => {
            const text = (locale as Record<string, string>)[key]

            return text === en[key as keyof typeof en] && !SHARED_WORDS.has(text)
          })

          expect(copied).toEqual([])
        })
      }
    })
  }

  it('uses the right plural form', () => {
    expect(createTranslate('es')('notesCount', { count: 1 })).toBe('1 nota')
    expect(createTranslate('es')('notesCount', { count: 3 })).toBe('3 notas')
    expect(createTranslate('ru')('notesCount', { count: 2 })).toBe('2 заметки')
    expect(createTranslate('ru')('notesCount', { count: 5 })).toBe('5 заметок')
    expect(createTranslate('ru')('notesCount', { count: 21 })).toBe('21 заметка')
    expect(createTranslate('ja')('notesCount', { count: 1 })).toBe('ノート 1 件')
  })
})
