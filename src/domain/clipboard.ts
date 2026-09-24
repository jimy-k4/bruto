import type { Connection, Note, Point, Workspace } from '../types'
import { NOTE_MIN_SIZE } from './constants'
import { insertNotes, normalizeWorkspace } from './workspace'

/** Notes copied with Ctrl+C, pasteable into any project. */
export interface NoteClipboard {
  notes: Note[]
  connections: Connection[]
}

export function copyNotes(workspace: Workspace, ids: string[]): NoteClipboard | null {
  const targets = new Set(ids)
  const notes = workspace.notes.filter((note) => targets.has(note.id))

  if (notes.length === 0) {
    return null
  }

  return {
    notes: structuredClone(notes),
    connections: workspace.connections.filter(
      (connection) => targets.has(connection.from) && targets.has(connection.to),
    ),
  }
}

/**
 * Reads a clipboard saved by this or an older version of Bruto. Older versions
 * stored a single note, with the group (if any) nested inside it.
 */
export function parseClipboard(raw: unknown): NoteClipboard | null {
  if (typeof raw !== 'object' || raw === null) {
    return null
  }

  const value = raw as { notes?: unknown; connections?: unknown; id?: unknown }
  const notes = Array.isArray(value.notes) ? value.notes : value.id ? [raw] : []

  if (notes.length === 0) {
    return null
  }

  try {
    // Reuse the workspace normalizer so pasted notes are always valid.
    const normalized = normalizeWorkspace({
      notes,
      connections: Array.isArray(value.connections) ? value.connections : [],
    })

    return { notes: normalized.notes, connections: normalized.connections }
  } catch {
    return null
  }
}

/**
 * Pastes the clipboard so the group's top-left corner lands around `center`.
 * Pasting next to the originals (same project) marks the titles as copies.
 */
export function pasteNotes(
  workspace: Workspace,
  clipboard: NoteClipboard,
  center: Point,
  copySuffix: string,
): { workspace: Workspace; ids: string[] } {
  const left = Math.min(...clipboard.notes.map((note) => note.x))
  const top = Math.min(...clipboard.notes.map((note) => note.y))
  const existingIds = new Set(workspace.notes.map((note) => note.id))

  const notes = clipboard.notes.map((note) =>
    existingIds.has(note.id) ? { ...note, title: `${note.title.trim()} (${copySuffix})` } : note,
  )

  return insertNotes(workspace, notes, clipboard.connections, {
    x: center.x - NOTE_MIN_SIZE.width / 2 - left,
    y: center.y - NOTE_MIN_SIZE.height / 2 - top,
  })
}
