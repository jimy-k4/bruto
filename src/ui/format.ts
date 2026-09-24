import type { Language } from '../types'

export function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 ** 2) return `${(size / 1024).toFixed(size < 100 * 1024 ? 1 : 0)} KB`
  if (size < 1024 ** 3) return `${(size / 1024 ** 2).toFixed(1)} MB`

  return `${(size / 1024 ** 3).toFixed(2)} GB`
}

export function formatDate(language: Language, timestamp: number, withTime = false): string {
  return new Intl.DateTimeFormat(language, {
    dateStyle: withTime ? 'medium' : 'short',
    ...(withTime && { timeStyle: 'short' }),
  }).format(new Date(timestamp))
}

/** Shortens a path from the middle (…/deep/file.tsx) keeping the file name whole. */
export function shortenPath(path: string, max = 28): string {
  if (path.length <= max) return path

  const fileName = path.split('/').pop() ?? path

  if (fileName.length >= max - 1) return `…${path.slice(-(max - 1))}`

  return `…${path.slice(path.length - max + 1)}`
}
