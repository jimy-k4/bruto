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
  | 'idea'
  | 'todo'
  | 'in-progress'
  | 'blocked'
  /** The AI finished: waiting for the user to check it. */
  | 'review'
  /** The user checked it and found problems (see `feedback`): back to the AI. */
  | 'changes-requested'
  | 'done'
  | 'bug'
  | 'wontfix'

export interface Note {
  id: string
  title: string
  description: string
  /** Paths relative to the project root. */
  filePaths: string[]
  webUrl: string
  /** Image paths relative to the project root (usually `.bruto/images/…`). */
  images: string[]
  x: number
  y: number
  zIndex: number
  colorTheme: NoteColorTheme
  pattern: NotePattern
  status?: NoteStatus
  /** What an AI model answered after working on the note. */
  aiResponse?: string
  /** What the user found wrong when reviewing the AI's work. */
  feedback?: string
}

export interface Connection {
  id: string
  from: string
  to: string
}

export type DocumentationType = 'obsidian' | 'notion' | 'web' | 'other'

export interface WorkspaceDocumentation {
  id: string
  name: string
  url: string
  type: DocumentationType
}

/** Look applied to a note when it changes to a status. Unset fields keep the note's own value. */
export interface StatusStyleConfig {
  color?: NoteColorTheme
  pattern?: NotePattern
}

export type StatusStyles = Partial<Record<NoteStatus, StatusStyleConfig>>

export interface Workspace {
  version: number
  title: string
  description: string
  aiContext: string
  documentation: WorkspaceDocumentation[]
  notes: Note[]
  connections: Connection[]
  statusStyles?: StatusStyles
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

export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}
