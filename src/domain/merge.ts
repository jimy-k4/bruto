import type { Workspace } from '../types'

/**
 * Three-way merge of a workspace, used when the file on disk changed while the
 * app also had unsaved changes (an AI or another tool edited `workspace.json`).
 *
 * - `base` is the last version both sides agreed on.
 * - `local` is what the app has in memory.
 * - `remote` is what is on disk now.
 *
 * Notes, connections and documentation are merged item by item (by id), and
 * items field by field. When both sides changed the same field differently,
 * the local value wins: it is what the user is looking at. An item edited on
 * one side and deleted on the other is kept, so nothing is ever lost silently.
 */
export function mergeWorkspaces(base: Workspace, local: Workspace, remote: Workspace): Workspace {
  const merged = mergeRecords(
    base as unknown as Record<string, unknown>,
    local as unknown as Record<string, unknown>,
    remote as unknown as Record<string, unknown>,
    new Set(['notes', 'connections', 'documentation', 'statusStyles']),
  ) as unknown as Workspace

  merged.notes = mergeLists(base.notes, local.notes, remote.notes)
  merged.documentation = mergeLists(base.documentation, local.documentation, remote.documentation)

  const statusStyles = mergeValue(base.statusStyles, local.statusStyles, remote.statusStyles, true)

  if (statusStyles && Object.keys(statusStyles).length > 0) {
    merged.statusStyles = statusStyles
  } else {
    delete merged.statusStyles
  }

  const noteIds = new Set(merged.notes.map((note) => note.id))
  const seenPairs = new Set<string>()

  merged.connections = mergeLists(base.connections, local.connections, remote.connections).filter(
    (connection) => {
      const pair = `${connection.from}->${connection.to}`

      if (!noteIds.has(connection.from) || !noteIds.has(connection.to) || seenPairs.has(pair)) {
        return false
      }

      seenPairs.add(pair)

      return true
    },
  )

  return merged
}

type Item = { id: string }

function mergeLists<T extends Item>(base: T[], local: T[], remote: T[]): T[] {
  const baseById = new Map(base.map((item) => [item.id, item]))
  const remoteById = new Map(remote.map((item) => [item.id, item]))
  const localIds = new Set(local.map((item) => item.id))
  const result: T[] = []

  for (const localItem of local) {
    const baseItem = baseById.get(localItem.id)
    const remoteItem = remoteById.get(localItem.id)

    if (remoteItem) {
      result.push(
        mergeRecords(
          (baseItem ?? {}) as Record<string, unknown>,
          localItem as unknown as Record<string, unknown>,
          remoteItem as unknown as Record<string, unknown>,
        ) as unknown as T,
      )
    } else if (!baseItem || !isEqual(localItem, baseItem)) {
      // Added locally, or deleted on disk but edited here: keep it.
      result.push(localItem)
    }
  }

  for (const remoteItem of remote) {
    if (localIds.has(remoteItem.id)) continue

    const baseItem = baseById.get(remoteItem.id)

    // Added on disk, or deleted here but edited on disk: keep it.
    if (!baseItem || !isEqual(remoteItem, baseItem)) {
      result.push(remoteItem)
    }
  }

  return result
}

function mergeRecords(
  base: Record<string, unknown>,
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
  skip = new Set<string>(),
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const keys = new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(base)])

  for (const key of keys) {
    if (skip.has(key)) {
      result[key] = local[key]
      continue
    }

    const value = mergeValue(base[key], local[key], remote[key])

    if (value !== undefined) {
      result[key] = value
    }
  }

  return result
}

function mergeValue<T>(base: T, local: T, remote: T, deep = false): T {
  if (isEqual(local, remote)) return local
  if (isEqual(local, base)) return remote
  if (isEqual(remote, base)) return local

  if (deep && isPlainObject(local) && isPlainObject(remote)) {
    return mergeRecords(
      (isPlainObject(base) ? base : {}) as Record<string, unknown>,
      local as Record<string, unknown>,
      remote as Record<string, unknown>,
    ) as T
  }

  return local
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isEqual(a: unknown, b: unknown): boolean {
  return a === b || stableStringify(a) === stableStringify(b)
}

function stableStringify(value: unknown): string {
  return (
    JSON.stringify(value, (_key, item: unknown) =>
      isPlainObject(item)
        ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
        : item,
    ) ?? 'undefined'
  )
}
