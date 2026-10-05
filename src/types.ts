export type Language = 'es' | 'en' | 'ja' | 'ru' | 'zh' | 'ca' | 'fr' | 'de' | 'pt-BR'

export type AppTheme = 'light' | 'dark'

/** How heavy lines and shadows are: bold (the brutalist default) or soft. */
export type AppLook = 'bold' | 'soft'

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

/** Where a note stands. Up to v3 "bug" and "loop" were statuses too; they are kinds now. */
export type NoteStatus =
  | 'idea'
  | 'todo'
  | 'in-progress'
  /** Waiting on something outside the board: a person, a vendor, an access. */
  | 'blocked'
  /** The AI finished: waiting for the user to check it. */
  | 'review'
  /** The user checked it and found problems (see `feedback`): back to the AI. */
  | 'changes-requested'
  | 'done'
  | 'wontfix'

/**
 * What a note is, apart from where it stands. A note without a kind is a task.
 * A rule is a standing rule: the AI applies it on every task and never answers
 * it; closing it (done, won't fix) retires it.
 */
export type NoteKind = 'bug' | 'rule'

export interface Note {
  id: string
  title: string
  description: string
  /** Paths relative to the project root. */
  filePaths: string[]
  /** Web links: docs, a ticket, a design, the page that fails. */
  webUrls: string[]
  /** Image paths relative to the project root (usually `.bruto/images/…`). */
  images: string[]
  x: number
  y: number
  zIndex: number
  colorTheme: NoteColorTheme
  pattern: NotePattern
  status?: NoteStatus
  /** Absent for a plain task. */
  kind?: NoteKind
  /** What an AI model answered after working on the note. */
  aiResponse?: string
  /**
   * Files the AI created or changed for this note, kept apart from `filePaths`
   * (what the user pointed it at) so each stays easy to find.
   */
  aiFilePaths?: string[]
  /** What the user found wrong when reviewing the AI's work. */
  feedback?: string
  /** Notes in other projects this one blocks, waits on or relates to. */
  crossLinks?: CrossLink[]
  /** When the note was made (ISO 8601). Its age runs from here, whoever it passes to. */
  createdAt?: string
  /** Times the user sent it back to the AI ("changes requested"): the review round trips. */
  sentBack?: number
  /** The agent that last changed the note through the MCP server. */
  agent?: AgentStamp
  /** "read": agents may read the note but never answer it or change its status. Set by the user. */
  agentAccess?: AgentAccess
}

export type AgentAccess = 'read'

/** What an agent did to a note through the MCP server. */
export type AgentAction = 'answer' | 'status' | 'create'

/** Who changed a note through the MCP server, and when: the audit log has the rest. */
export interface AgentStamp {
  /** The MCP client as it introduced itself, e.g. "claude-code". */
  client: string
  version?: string
  /** The agent or subagent that made the call, when it said. */
  id?: string
  action: AgentAction
  /** ISO 8601. */
  at: string
  /**
   * What of that change didn't stay: the user edited the same fields at the
   * same time, and their values were kept. The agent reads it on its next look.
   */
  reverted?: RevertedChange[]
  revertedAt?: string
}

/** A field an agent wrote that the user's own edit replaced. */
export interface RevertedChange {
  field: string
  /** What the agent wrote, when it is short enough to repeat. */
  value?: string
}

/** How a note relates to one in another project, seen from this note. */
export type CrossLinkKind = 'blocks' | 'blocked-by' | 'related'

export interface CrossLink {
  kind: CrossLinkKind
  /** The other project's folder name: how Bruto finds it again. */
  project: string
  /** Its id among this browser's recent projects, when known: a surer match. */
  projectId?: string
  noteId: string
  /** The other note's title and status when last seen, shown while its project can't be read. */
  title?: string
  status?: NoteStatus
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

/**
 * The look for each status, and for each kind. Kinds keep the keys they had as
 * statuses ("bug", and "loop" for rules), so older tools reading the file keep
 * them too.
 */
export type StyleKey = NoteStatus | 'bug' | 'loop'

export type StatusStyles = Partial<Record<StyleKey, StatusStyleConfig>>

export interface Workspace {
  version: number
  title: string
  description: string
  aiContext: string
  documentation: WorkspaceDocumentation[]
  notes: Note[]
  connections: Connection[]
  statusStyles?: StatusStyles
  /** Notes of linked projects that lead to notes here, copied from their boards. */
  ghosts?: GhostZone[]
}

/**
 * Notes of another project shown on this board, read only, laid out as on
 * their own: the linked notes and the chain of arrows that leads to them.
 * Kept apart from `notes` so nothing here, and no agent, edits or answers them.
 */
export interface GhostZone {
  /** The other project's folder name, as links name it. */
  project: string
  projectId?: string
  /** Moves the zone's notes from their own board's positions to where they sit on this one. */
  offset: Point
  notes: GhostNote[]
  /** Arrows between them, as on their board. */
  connections: Connection[]
  /** When this copy was taken (ISO 8601). */
  syncedAt: string
  /** The project it was learned through, when it wasn't read from its own board. */
  via?: string
  /** Boards it went through to get here: 1 when read from its own. */
  hops: number
}

/** What a ghost carries of its note: enough to know what it is and where it leads. */
export interface GhostNote {
  id: string
  title: string
  kind?: NoteKind
  status?: NoteStatus
  colorTheme: NoteColorTheme
  pattern: NotePattern
  /** Its position on its own board. */
  x: number
  y: number
  /** The start of its description. */
  description?: string
  /** Paths in its own project, never in this one. */
  files?: string[]
  /** Its links to notes in other projects: how zones and notes here connect. */
  crossLinks?: Pick<CrossLink, 'kind' | 'project' | 'projectId' | 'noteId'>[]
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
