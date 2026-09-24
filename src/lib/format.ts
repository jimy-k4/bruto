import type { Language } from '../types'

export function formatFileSize(
  size: number,
) {
  if (
    size <
    1024
  ) {
    return `${size} B`
  }

  if (
    size <
    1024 *
      1024
  ) {
    return `${(
      size / 1024
    ).toFixed(
      size <
        100 *
          1024
        ? 1
        : 0,
    )} KB`
  }

  if (
    size <
    1024 *
      1024 *
      1024
  ) {
    return `${(
      size /
      (1024 *
        1024)
    ).toFixed(
      1,
    )} MB`
  }

  return `${(
    size /
    (1024 *
      1024 *
      1024)
  ).toFixed(
    2,
  )} GB`
}

export function formatFileDate(
  language: Language,
  timestamp: number,
) {
  return new Intl.DateTimeFormat(
    language,
    {
      dateStyle:
        'medium',
      timeStyle:
        'short',
    },
  ).format(
    new Date(
      timestamp,
    ),
  )
}
