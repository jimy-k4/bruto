import type { TranslationKey } from './i18n/translations'

export type Language = 'es' | 'en' | 'ja' | 'ru' | 'zh' | 'ca' | 'fr' | 'de' | 'pt-BR'

export type AppTheme = 'light' | 'dark'

export type NoteColorTheme =
  | 'concrete'
  | 'sand'
  | 'ochre'
  | 'oxide'
  | 'wine'
  | 'cobalt'
  | 'teal'
  | 'moss'
  | 'plum'
  | 'slate'
  | 'bark'
  | 'indigo'

export type NotePattern =
  | 'raw'
  | 'grid'
  | 'hatch'
  | 'bands'
  | 'dots'
  | 'cross'
  | 'waves'
  | 'checker'
  | 'pinstripe'
  | 'diag'
  | 'weave'
  | 'triangle'

export type NoteStatus =
  'idea' | 'todo' | 'in-progress' | 'blocked' | 'review' | 'done' | 'bug' | 'issue' | 'wontfix'

export interface Note {
  id: string
  title: string
  description: string
  filePaths: string[]
  webUrl: string
  images: string[]
  x: number
  y: number
  zIndex: number
  colorTheme: NoteColorTheme
  pattern: NotePattern
  status?: NoteStatus
  /** Response an AI model left
   * after processing this note.
   * Empty/undefined keeps the
   * section hidden everywhere. */
  aiResponse?: string
}

export interface Connection {
  id: string
  from: string
  to: string
}

export interface WorkspaceDocumentation {
  id: string
  name: string
  url: string
  type: 'obsidian' | 'notion' | 'web' | 'other'
}

export interface Workspace {
  version: number
  title: string
  description: string
  aiContext: string
  documentation: WorkspaceDocumentation[]
  notes: Note[]
  connections: Connection[]
  /** Per-status automatic look.
   * Only what the user configured
   * is set; everything else keeps
   * each note's own defaults. */
  statusStyles?: Partial<Record<NoteStatus, StatusStyleConfig>>
}

/** How notes of one status look
 * when the status changes. Both
 * fields optional: unset means
 * "keep the note's own value". */
export interface StatusStyleConfig {
  color?: NoteColorTheme
  pattern?: NotePattern
}

export type ContextScope = 'current' | 'connected' | 'entire'

export interface FileTreeNode {
  name: string
  path: string
  kind: 'file' | 'directory'
  handle: FileSystemFileHandle | FileSystemDirectoryHandle
  children?: FileTreeNode[]
  loaded?: boolean
}

export interface SelectedFileInfo {
  name: string
  path: string
  size: number
  lastModified: number
  type: string
}

export interface ShortcutDefinition {
  keys: string
  title: TranslationKey
  description: TranslationKey
}
