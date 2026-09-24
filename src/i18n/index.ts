import { createContext, useContext } from 'react'
import type { Language, NoteStatus } from '../types'
import { isLanguage } from '../domain/constants'
import { es } from './locales/es'
import { en } from './locales/en'
import { ca } from './locales/ca'
import { fr } from './locales/fr'
import { de } from './locales/de'
import { ptBR } from './locales/pt-BR'
import { ru } from './locales/ru'
import { ja } from './locales/ja'
import { zh } from './locales/zh'

/** Keys the app asks for. Plural variants (`key_one`, `key_few`…) are picked automatically. */
export type TranslationKey = Exclude<keyof typeof es, `${string}_${string}`>

/**
 * Every language must translate every key: a missing one is a type error.
 * Plural forms go in extra keys like `notesCount_one` or `notesCount_few`.
 */
export type Locale = Record<TranslationKey, string> & Partial<Record<string, string>>

export const LOCALES: Record<Language, Locale> = { es, en, ca, fr, de, 'pt-BR': ptBR, ru, ja, zh }

export type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string

export interface I18nValue {
  language: Language
  setLanguage: (language: Language) => void
  t: Translate
}

export const I18nContext = createContext<I18nValue | null>(null)

export function createTranslate(language: Language): Translate {
  const locale = LOCALES[language]
  const plural = new Intl.PluralRules(language)

  return (key, values) => {
    const count = values?.count
    const pluralText =
      typeof count === 'number' ? locale[`${key}_${plural.select(count)}`] : undefined
    const text = pluralText ?? locale[key] ?? es[key] ?? key

    return values
      ? text.replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match))
      : text
  }
}

export function detectLanguage(): Language {
  for (const candidate of navigator.languages) {
    if (isLanguage(candidate)) return candidate

    const short = candidate.slice(0, 2)

    if (isLanguage(short)) return short
  }

  return 'es'
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext)

  if (!value) {
    throw new Error('useI18n must be used inside <I18nProvider>')
  }

  return value
}

const STATUS_KEYS: Record<NoteStatus, TranslationKey> = {
  idea: 'statusIdea',
  todo: 'statusTodo',
  'in-progress': 'statusInProgress',
  blocked: 'statusBlocked',
  review: 'statusReview',
  done: 'statusDone',
  bug: 'statusBug',
  issue: 'statusIssue',
  wontfix: 'statusWontfix',
}

export const statusLabel = (t: Translate, status: NoteStatus) => t(STATUS_KEYS[status])
