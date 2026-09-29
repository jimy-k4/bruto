import type {
  Language,
  NoteColorTheme,
  NoteKind,
  NotePattern,
  NoteStatus,
  Size,
  StyleKey,
} from '../types'

/** v4: "bug" and "loop" moved from `status` to `kind`. */
export const WORKSPACE_VERSION = 4

export const NOTE_COLORS: readonly NoteColorTheme[] = [
  'concrete',
  'sand',
  'ochre',
  'oxide',
  'wine',
  'cobalt',
  'teal',
  'moss',
  'plum',
  'slate',
  'bark',
  'indigo',
]

export const NOTE_PATTERNS: readonly NotePattern[] = [
  'raw',
  'grid',
  'hatch',
  'bands',
  'dots',
  'cross',
  'waves',
  'checker',
  'pinstripe',
  'diag',
  'weave',
  'triangle',
]

export const NOTE_STATUSES: readonly NoteStatus[] = [
  'idea',
  'todo',
  'in-progress',
  'review',
  'changes-requested',
  'done',
  'blocked',
  'wontfix',
]

export const NOTE_KINDS: readonly NoteKind[] = ['bug', 'rule']

/** The key each kind's look is kept under: its name from when it was a status. */
export const KIND_STYLE_KEY: Record<NoteKind, StyleKey> = { bug: 'bug', rule: 'loop' }

/** Every look that can be configured: statuses first, then kinds. */
export const STYLE_KEYS: readonly StyleKey[] = [
  ...NOTE_STATUSES,
  ...NOTE_KINDS.map((kind) => KIND_STYLE_KEY[kind]),
]

/** Statuses that mean "nothing left to do". */
export const CLOSED_STATUSES: readonly NoteStatus[] = ['done', 'wontfix']

export const LANGUAGES: readonly { value: Language; label: string }[] = [
  { value: 'es', label: 'ES' },
  { value: 'en', label: 'EN' },
  { value: 'ca', label: 'CA' },
  { value: 'fr', label: 'FR' },
  { value: 'de', label: 'DE' },
  { value: 'pt-BR', label: 'PT-BR' },
  { value: 'ru', label: 'RU' },
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '中文' },
]

/** Minimum size of a note card on the board. Cards grow with their content. */
export const NOTE_MIN_SIZE: Size = { width: 280, height: 160 }

/** Offset used when duplicating notes so the copy doesn't hide the original. */
export const DUPLICATE_OFFSET = 36

export const ZOOM_MIN = 0.25
export const ZOOM_MAX = 2

export function isNoteKind(value: unknown): value is NoteKind {
  return typeof value === 'string' && (NOTE_KINDS as readonly string[]).includes(value)
}

export function isNoteStatus(value: unknown): value is NoteStatus {
  return typeof value === 'string' && (NOTE_STATUSES as readonly string[]).includes(value)
}

export function isNoteColor(value: unknown): value is NoteColorTheme {
  return typeof value === 'string' && (NOTE_COLORS as readonly string[]).includes(value)
}

export function isNotePattern(value: unknown): value is NotePattern {
  return typeof value === 'string' && (NOTE_PATTERNS as readonly string[]).includes(value)
}

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((language) => language.value === value)
}
