import type { Workspace } from '../types'
import { isEqual } from './merge'

/**
 * When each part of the board last changed, and what was deleted when. Kept in
 * `workspace.json` under `sync`, next to the board, never in the app's state.
 *
 * A folder synced between computers (Syncthing, OneDrive, Dropbox…) keeps both
 * versions when the two changed the board before syncing: one stays
 * `workspace.json`, the other becomes a "conflicted copy". Nothing tells which
 * version they both came from, so a three-way merge can't be used; these
 * stamps let any two versions be merged item by item instead, the latest
 * change winning, without losing notes either side added.
 *
 * Keys: `note:<id>`, `connection:<id>`, `doc:<id>` and `field:<name>` for the
 * board's own fields. Values are ISO 8601 times.
 */
export interface SyncStamps {
  changed: Record<string, string>
  deleted: Record<string, string>
}

/** A version of the board with its stamps. */
export interface StampedBoard {
  workspace: Workspace
  stamps: SyncStamps
}

/** Board fields merged as a whole: the latest change wins. */
const FIELDS = [
  'title',
  'description',
  'aiContext',
  'statusStyles',
  'environments',
  'ghosts',
] as const

/** Deletions are remembered this long: a copy older than that is very unlikely. */
const KEEP_DELETED_MS = 180 * 24 * 60 * 60 * 1000

export const emptyStamps = (): SyncStamps => ({ changed: {}, deleted: {} })

/** Every stamped item of a board, by key. */
function items(workspace: Workspace): Map<string, unknown> {
  const map = new Map<string, unknown>()

  for (const note of workspace.notes) map.set(`note:${note.id}`, note)
  for (const connection of workspace.connections) map.set(`connection:${connection.id}`, connection)
  for (const doc of workspace.documentation) map.set(`doc:${doc.id}`, doc)
  for (const field of FIELDS) map.set(`field:${field}`, workspace[field])

  return map
}

const isTime = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value))

function readRecord(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}

  return Object.fromEntries(Object.entries(raw).filter(([, value]) => isTime(value)))
}

/** The stamps in a `workspace.json` text; empty when it has none or can't be read. */
export function readSyncStamps(text: string): SyncStamps {
  try {
    const raw = (JSON.parse(text) as { sync?: { changed?: unknown; deleted?: unknown } })?.sync

    return { changed: readRecord(raw?.changed), deleted: readRecord(raw?.deleted) }
  } catch {
    return emptyStamps()
  }
}

const sorted = (record: Record<string, string>) =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)))

/** Stamps as written to the file: sorted, so saving twice writes the same text. Null when empty. */
export function stampsForFile(stamps: SyncStamps): SyncStamps | null {
  if (Object.keys(stamps.changed).length === 0 && Object.keys(stamps.deleted).length === 0) {
    return null
  }

  return { changed: sorted(stamps.changed), deleted: sorted(stamps.deleted) }
}

/**
 * The stamps for `next`, about to be written over `previous` (what is on disk,
 * or was last written). Items that didn't change keep their stamp; changed or
 * new ones get `now`; items that are gone are recorded as deleted.
 */
export function stampChanges(
  next: Workspace,
  previous: StampedBoard | null,
  now = new Date(),
): SyncStamps {
  const time = now.toISOString()
  const before = previous ? items(previous.workspace) : new Map<string, unknown>()
  const after = items(next)
  const changed: Record<string, string> = {}
  const deleted: Record<string, string> = {}
  const oldest = now.getTime() - KEEP_DELETED_MS

  for (const [key, at] of Object.entries(previous?.stamps.deleted ?? {})) {
    if (!after.has(key) && Date.parse(at) >= oldest) deleted[key] = at
  }

  for (const [key, value] of after) {
    // A board field that was never set needs no stamp.
    if (key.startsWith('field:') && value === undefined && !before.has(key)) continue

    const kept = previous?.stamps.changed[key]

    if (before.has(key) && isEqual(before.get(key), value)) {
      if (kept) changed[key] = kept
    } else {
      changed[key] = time
    }
  }

  for (const key of before.keys()) {
    if (!after.has(key)) deleted[key] = time
  }

  return { changed, deleted }
}

const stampOf = (board: StampedBoard, key: string) => board.stamps.changed[key] ?? ''
const deletedAt = (board: StampedBoard, key: string) => board.stamps.deleted[key] ?? ''

/**
 * Merges a conflicted copy into the board, item by item. An item on both sides
 * takes the latest change (the board's own on a tie). An item on one side only
 * is kept, unless the other side deleted it after its last change: notes added
 * on either computer are never lost.
 */
export function mergeCopy(main: StampedBoard, copy: StampedBoard): StampedBoard {
  const mainItems = items(main.workspace)
  const copyItems = items(copy.workspace)
  const changed: Record<string, string> = {}
  const keep = new Map<string, unknown>()

  for (const key of new Set([...mainItems.keys(), ...copyItems.keys()])) {
    const inMain = mainItems.has(key)
    const inCopy = copyItems.has(key)
    const fromMain = { value: mainItems.get(key), at: stampOf(main, key) }
    const fromCopy = { value: copyItems.get(key), at: stampOf(copy, key) }

    let chosen: { value: unknown; at: string } | null

    if (key.startsWith('field:')) {
      chosen = fromCopy.at > fromMain.at ? fromCopy : fromMain
    } else if (inMain && inCopy) {
      chosen = fromCopy.at > fromMain.at ? fromCopy : fromMain
    } else if (inMain) {
      chosen = deletedAt(copy, key) > fromMain.at ? null : fromMain
    } else if (inCopy) {
      chosen = deletedAt(main, key) > fromCopy.at ? null : fromCopy
    } else {
      chosen = null
    }

    if (!chosen) continue

    keep.set(key, chosen.value)
    if (chosen.at) changed[key] = chosen.at
  }

  const deleted: Record<string, string> = {}

  for (const source of [main.stamps.deleted, copy.stamps.deleted]) {
    for (const [key, at] of Object.entries(source)) {
      if (!keep.has(key) && at > (deleted[key] ?? '')) deleted[key] = at
    }
  }

  /** Items of one kind in board order: the board's own first, then the copy's. */
  const pick = <T extends { id: string }>(prefix: string, ours: T[], theirs: T[]): T[] => {
    const seen = new Set<string>()
    const list: T[] = []

    for (const item of [...ours, ...theirs]) {
      const key = `${prefix}:${item.id}`

      if (seen.has(item.id) || !keep.has(key)) continue
      seen.add(item.id)
      list.push(keep.get(key) as T)
    }

    return list
  }

  const notes = pick('note', main.workspace.notes, copy.workspace.notes)
  const noteIds = new Set(notes.map((note) => note.id))
  const pairs = new Set<string>()
  const connections = pick(
    'connection',
    main.workspace.connections,
    copy.workspace.connections,
  ).filter((connection) => {
    const pair = `${connection.from}->${connection.to}`

    if (!noteIds.has(connection.from) || !noteIds.has(connection.to) || pairs.has(pair)) {
      return false
    }

    pairs.add(pair)

    return true
  })

  const workspace: Workspace = {
    ...main.workspace,
    version: Math.max(main.workspace.version, copy.workspace.version),
    notes,
    connections,
    documentation: pick('doc', main.workspace.documentation, copy.workspace.documentation),
  }

  for (const field of FIELDS) {
    const value = keep.get(`field:${field}`)

    if (value === undefined) {
      delete workspace[field]
    } else {
      ;(workspace as unknown as Record<string, unknown>)[field] = value
    }
  }

  return { workspace, stamps: { changed, deleted } }
}

/**
 * Whether a file next to `workspace.json` is a copy a sync tool left when both
 * computers changed the board: Syncthing (`workspace.sync-conflict-…`), Dropbox
 * and Nextcloud (`workspace (… conflicted copy …)`), Google Drive
 * (`workspace (1)`), iCloud (`workspace 2`) or OneDrive (`workspace-PC`).
 * Bruto's own backups never count.
 */
export function isConflictCopyName(name: string): boolean {
  if (/backup/i.test(name)) return false

  return /^workspace(?:\.sync-conflict-[^/\\]+| \([^)]*conflict[^)]*\)| \(\d+\)| \d+|-[^.\s]+|_conflict[^.]*)\.json$/i.test(
    name,
  )
}
