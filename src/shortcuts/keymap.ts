import type { TranslationKey } from '../i18n'

export type ShortcutAction =
  | 'newNote'
  | 'openAiContext'
  | 'copyCurrent'
  | 'copyConnected'
  | 'copyEntire'
  | 'center'
  | 'search'
  | 'structure'
  | 'connect'
  | 'resetView'
  | 'selectAll'
  | 'duplicate'
  | 'delete'
  | 'undo'
  | 'redo'
  | 'save'
  | 'help'
  | 'escape'
  | 'switchProject'

/** Where a shortcut works. */
type Scope =
  /** On the board, when no text field has focus and no window is open. */
  | 'board'
  /** Everywhere, even while typing. */
  | 'global'

interface KeyPattern {
  /** Letter or key name (`event.key`), compared case-insensitively. */
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
}

/** A key as shown in the help: literal text, or a word that needs translating. */
export type KeyLabel = string | { label: TranslationKey }

export interface ShortcutDefinition {
  action?: ShortcutAction
  /** What the help shows, e.g. ["Ctrl", "D"]. */
  keys: KeyLabel[]
  title: TranslationKey
  description: TranslationKey
  scope?: Scope
  patterns?: KeyPattern[]
}

const letter = (key: string, extra: Omit<KeyPattern, 'key'> = {}): KeyPattern => ({ key, ...extra })

/** Single source for the keyboard handler and the help window. */
export const SHORTCUTS: ShortcutDefinition[] = [
  {
    action: 'newNote',
    keys: ['N'],
    title: 'shortcutNewNote',
    description: 'shortcutNewNoteDescription',
    patterns: [letter('n')],
  },
  {
    action: 'openAiContext',
    keys: ['A'],
    title: 'shortcutAiContext',
    description: 'shortcutAiContextDescription',
    patterns: [letter('a')],
  },
  {
    action: 'copyCurrent',
    keys: ['Q'],
    title: 'shortcutCopyCurrent',
    description: 'shortcutCopyCurrentDescription',
    patterns: [letter('q')],
  },
  {
    action: 'copyConnected',
    keys: ['W'],
    title: 'shortcutCopyConnected',
    description: 'shortcutCopyConnectedDescription',
    patterns: [letter('w')],
  },
  {
    action: 'copyEntire',
    keys: ['E'],
    title: 'shortcutCopyEntire',
    description: 'shortcutCopyEntireDescription',
    patterns: [letter('e')],
  },
  {
    keys: [{ label: 'keyCtrl' }, 'C'],
    title: 'shortcutCopyNotes',
    description: 'shortcutCopyNotesDescription',
  },
  {
    keys: [{ label: 'keyCtrl' }, 'V'],
    title: 'shortcutPaste',
    description: 'shortcutPasteDescription',
  },
  {
    action: 'duplicate',
    keys: [{ label: 'keyCtrl' }, 'D'],
    title: 'shortcutDuplicate',
    description: 'shortcutDuplicateDescription',
    patterns: [letter('d', { ctrl: true })],
  },
  {
    action: 'selectAll',
    keys: [{ label: 'keyCtrl' }, 'A'],
    title: 'shortcutSelectAll',
    description: 'shortcutSelectAllDescription',
    patterns: [letter('a', { ctrl: true })],
  },
  {
    action: 'delete',
    keys: [{ label: 'keyDelete' }],
    title: 'shortcutDelete',
    description: 'shortcutDeleteDescription',
    patterns: [{ key: 'Delete' }, { key: 'Backspace' }],
  },
  {
    keys: [{ label: 'keyEnter' }],
    title: 'shortcutOpen',
    description: 'shortcutOpenDescription',
  },
  {
    keys: ['←', '↑', '→', '↓'],
    title: 'shortcutMove',
    description: 'shortcutMoveDescription',
  },
  {
    action: 'connect',
    keys: ['C'],
    title: 'shortcutConnect',
    description: 'shortcutConnectDescription',
    patterns: [letter('c')],
  },
  {
    action: 'center',
    keys: ['F'],
    title: 'shortcutCenter',
    description: 'shortcutCenterDescription',
    patterns: [letter('f')],
  },
  {
    action: 'search',
    keys: [{ label: 'keyCtrl' }, 'F'],
    title: 'shortcutSearch',
    description: 'shortcutSearchDescription',
    patterns: [letter('f', { ctrl: true }), { key: '/' }],
  },
  {
    action: 'structure',
    keys: ['M'],
    title: 'shortcutStructure',
    description: 'shortcutStructureDescription',
    patterns: [letter('m')],
  },
  {
    action: 'resetView',
    keys: ['0'],
    title: 'shortcutResetView',
    description: 'shortcutResetViewDescription',
    patterns: [{ key: '0' }],
  },
  {
    action: 'undo',
    keys: [{ label: 'keyCtrl' }, 'Z'],
    title: 'shortcutUndo',
    description: 'shortcutUndoDescription',
    patterns: [letter('z', { ctrl: true })],
  },
  {
    action: 'redo',
    keys: [{ label: 'keyCtrl' }, 'Y'],
    title: 'shortcutRedo',
    description: 'shortcutRedoDescription',
    patterns: [letter('y', { ctrl: true }), letter('z', { ctrl: true, shift: true })],
  },
  {
    action: 'save',
    keys: [{ label: 'keyCtrl' }, 'S'],
    title: 'shortcutSave',
    description: 'shortcutSaveDescription',
    scope: 'global',
    patterns: [letter('s', { ctrl: true })],
  },
  {
    action: 'switchProject',
    keys: ['Alt', '1…9'],
    title: 'shortcutSwitchProject',
    description: 'shortcutSwitchProjectDescription',
    scope: 'global',
    patterns: '123456789'.split('').map((digit) => ({ key: digit, alt: true })),
  },
  {
    action: 'escape',
    keys: ['Esc'],
    title: 'shortcutEscape',
    description: 'shortcutEscapeDescription',
    scope: 'global',
    patterns: [{ key: 'Escape' }],
  },
  {
    action: 'help',
    keys: ['?'],
    title: 'shortcutHelp',
    description: 'shortcutHelpDescription',
    patterns: [{ key: '?', shift: undefined }, { key: 'F1' }],
  },
  {
    keys: [{ label: 'keyShift' }, '+', { label: 'keyClick' }],
    title: 'shortcutMultiSelect',
    description: 'shortcutMultiSelectDescription',
  },
  {
    keys: [{ label: 'keyDrag' }],
    title: 'shortcutAreaSelect',
    description: 'shortcutAreaSelectDescription',
  },
  {
    keys: [{ label: 'keyMiddleClick' }],
    title: 'shortcutMiddleClick',
    description: 'shortcutMiddleClickDescription',
  },
  {
    keys: [{ label: 'keyWheel' }],
    title: 'shortcutZoom',
    description: 'shortcutZoomDescription',
  },
]

/**
 * The letter a key produces on a Latin layout. On Cyrillic, Greek or CJK
 * layouts `event.key` isn't a Latin letter, so the physical key is used.
 */
function latinKey(event: KeyboardEvent): string {
  if (/^[a-z]$/i.test(event.key)) return event.key.toLowerCase()
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3).toLowerCase()
  if (/^Digit\d$/.test(event.code) && event.altKey) return event.code.slice(5)

  return event.key
}

function matches(pattern: KeyPattern, event: KeyboardEvent): boolean {
  const ctrl = event.ctrlKey || event.metaKey
  const isLetter = /^[a-z]$/.test(pattern.key)
  const key = isLetter || /^\d$/.test(pattern.key) ? latinKey(event) : event.key

  if (key.toLowerCase() !== pattern.key.toLowerCase()) return false
  if (Boolean(pattern.ctrl) !== ctrl) return false
  if (Boolean(pattern.alt) !== event.altKey) return false

  // "?" needs Shift on most layouts: only check Shift where it matters.
  if (pattern.shift !== undefined || isLetter) {
    return Boolean(pattern.shift) === event.shiftKey
  }

  return true
}

export function matchShortcut(
  event: KeyboardEvent,
): { action: ShortcutAction; scope: Scope; key: string } | null {
  for (const shortcut of SHORTCUTS) {
    if (!shortcut.action || !shortcut.patterns) continue

    const pattern = shortcut.patterns.find((item) => matches(item, event))

    if (pattern) {
      return { action: shortcut.action, scope: shortcut.scope ?? 'board', key: pattern.key }
    }
  }

  return null
}
