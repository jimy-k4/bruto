import { useCallback, useEffect, useState } from 'react'
import type { AppTheme } from './types'

/** localStorage can throw (private mode, blocked storage): preferences then last for the session. */
function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Keep working without persistence.
  }
}

/** A small piece of UI state remembered across reloads. */
export function usePreference<T extends string | number | boolean>(
  key: string,
  initial: T | (() => T),
  isValid: (value: unknown) => value is T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const stored = read(key)
    const parsed = stored === null ? undefined : parseStored(stored)

    if (isValid(parsed)) return parsed

    return typeof initial === 'function' ? initial() : initial
  })

  const update = useCallback(
    (next: T) => {
      setValue(next)
      write(key, String(next))
    },
    [key],
  )

  return [value, update]
}

function parseStored(stored: string): unknown {
  if (stored === 'true' || stored === 'false') return stored === 'true'

  const number = Number(stored)

  return stored.trim() !== '' && Number.isFinite(number) ? number : stored
}

const isTheme = (value: unknown): value is AppTheme => value === 'light' || value === 'dark'

/** Theme on `<html>` so every layer (dialogs, menus, scrollbars) follows it. */
export function useTheme(): [AppTheme, () => void] {
  const [theme, setTheme] = usePreference<AppTheme>(
    'bruto-theme',
    () => (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'),
    isTheme,
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
  }, [theme])

  const toggle = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme])

  return [theme, toggle]
}

export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'

export const isNumberBetween =
  (min: number, max: number) =>
  (value: unknown): value is number =>
    typeof value === 'number' && value >= min && value <= max
