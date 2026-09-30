import type { Language } from '../types'

const HOUR = 3_600_000
const DAY = 24 * HOUR

/**
 * How long ago a note was made, as short as the language writes it: "6 d",
 * "3 h", "2 wk". It keeps counting whoever the note passes to.
 */
export function formatAge(language: Language, createdAt: string, now = Date.now()): string {
  const elapsed = Math.max(0, now - Date.parse(createdAt))
  const [value, unit] =
    elapsed < HOUR
      ? [Math.max(1, Math.round(elapsed / 60_000)), 'minute']
      : elapsed < DAY
        ? [Math.floor(elapsed / HOUR), 'hour']
        : elapsed < 14 * DAY
          ? [Math.floor(elapsed / DAY), 'day']
          : [Math.floor(elapsed / (7 * DAY)), 'week']

  return new Intl.NumberFormat(language, { style: 'unit', unit, unitDisplay: 'narrow' }).format(
    value,
  )
}
