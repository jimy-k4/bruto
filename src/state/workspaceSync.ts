import type { Workspace } from '../types'
import { isEqual, mergeWorkspaces } from '../domain/merge'
import { applyStatusStylesToChangedNotes, serializeWorkspace } from '../domain/workspace'
import type { DiskState } from '../storage/workspaceFile'
import type { WorkspaceStore } from './workspaceStore'

export type SaveStatus =
  | { kind: 'saved' }
  | { kind: 'saving' }
  | { kind: 'unsaved' }
  | { kind: 'error'; message: string }
  /** The file on disk can't be read (usually half-edited by another tool). */
  | { kind: 'disk-invalid'; message: string }

/** Disk access, injectable so the engine can be tested without a browser. */
export interface WorkspaceIO {
  read(): Promise<DiskState>
  write(text: string): Promise<void>
  /** Changes whenever the file changes. */
  stamp(): Promise<string>
}

interface SyncOptions {
  store: WorkspaceStore
  io: WorkspaceIO
  /** Exact text of `workspace.json` when the workspace was loaded. */
  diskText: string
  onStatus: (status: SaveStatus) => void
  /** Called after changes made by someone else were merged in. */
  onExternalChange: () => void
  saveDelay?: number
}

export type WorkspaceSync = ReturnType<typeof createWorkspaceSync>

/**
 * Keeps the store and `workspace.json` in sync. Every save first reads the
 * file: if another tool (usually an AI) changed it, both versions are merged
 * instead of overwriting their work. A file that can't be parsed is never
 * overwritten without asking.
 */
export function createWorkspaceSync({
  store,
  io,
  diskText: initialText,
  onStatus,
  onExternalChange,
  saveDelay = 400,
}: SyncOptions) {
  /** Last version known to be on disk: the common ancestor for merges. */
  let base = store.getWorkspace()
  let diskText = initialText
  let diskStamp: string | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let queue: Promise<void> = Promise.resolve()
  let status: SaveStatus = { kind: 'saved' }
  let disposed = false

  const setStatus = (next: SaveStatus) => {
    status = next
    onStatus(next)
  }

  const describe = (error: unknown) => (error instanceof Error ? error.message : String(error))

  const enqueue = (task: () => Promise<void>) => {
    queue = queue
      .then(task)
      .catch((error: unknown) => setStatus({ kind: 'error', message: describe(error) }))

    return queue
  }

  async function sync(force = false) {
    if (disposed) return

    const local = store.getWorkspace()
    const disk = await io.read()

    if (disk.kind === 'invalid' && !force) {
      diskStamp = await io.stamp()
      setStatus({ kind: 'disk-invalid', message: disk.error })

      return
    }

    let next: Workspace = local
    let external = false

    if (disk.kind === 'ok' && disk.text !== diskText) {
      const merged = applyStatusStylesToChangedNotes(
        local,
        mergeWorkspaces(base, local, disk.workspace),
      )

      external = !isEqual(merged, local)
      next = external ? merged : local
    }

    const text = serializeWorkspace(next)

    if (disk.kind !== 'ok' || disk.text !== text) {
      setStatus({ kind: 'saving' })
      await io.write(text)
    }

    diskText = text
    base = next
    diskStamp = await io.stamp()

    if (external) {
      const current = store.getWorkspace()

      // The user may have kept editing while we were reading and writing.
      store.receive(current === local ? next : mergeWorkspaces(local, current, next), {
        resetHistory: true,
      })

      onExternalChange()
    }

    store.markSaved(next)

    if (store.getSnapshot().dirty) {
      setStatus({ kind: 'unsaved' })
      scheduleSave()
    } else {
      setStatus({ kind: 'saved' })
    }
  }

  function scheduleSave() {
    if (disposed) return
    if (timer) clearTimeout(timer)

    timer = setTimeout(() => {
      timer = null
      void enqueue(() => sync())
    }, saveDelay)
  }

  const unsubscribe = store.subscribe(() => {
    if (store.getSnapshot().dirty) {
      if (status.kind === 'saved') setStatus({ kind: 'unsaved' })

      scheduleSave()
    }
  })

  return {
    getStatus: () => status,

    /** Writes pending changes right away (Ctrl+S, leaving the page, switching project). */
    saveNow() {
      if (timer) clearTimeout(timer)
      timer = null

      return enqueue(() => sync())
    },

    /** Looks for changes made by other tools; cheap when nothing changed. */
    async checkDisk() {
      if (disposed) return

      try {
        if ((await io.stamp()) === diskStamp) return
      } catch {
        return
      }

      await enqueue(() => sync())
    },

    /** Replaces a broken file on disk with the version in the app. */
    overwriteDisk() {
      return enqueue(() => sync(true))
    },

    dispose() {
      disposed = true
      unsubscribe()
      if (timer) clearTimeout(timer)
    },
  }
}
