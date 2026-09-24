import { useEffect, useMemo, type ReactNode } from 'react'
import type { Language } from '../types'
import { isLanguage } from '../domain/constants'
import { usePreference } from '../preferences'
import { I18nContext, createTranslate, detectLanguage, type I18nValue } from '.'

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = usePreference<Language>(
    'bruto-language',
    detectLanguage,
    isLanguage,
  )

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const value = useMemo<I18nValue>(
    () => ({ language, setLanguage, t: createTranslate(language) }),
    [language, setLanguage],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
