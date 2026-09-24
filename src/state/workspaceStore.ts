import type { Workspace } from '../types'

const HISTORY_LIMIT = 100

export interface WorkspaceSnapshot {
  workspace: Workspace
  canUndo: boolean
  canRedo: boolean
  /** True while there are changes not yet written to disk. */
  dirty: boolean
}

export interface UpdateOptions {
  /** Record an undo step. Default true. Off for cosmetic changes like z-order. */
  history?: boolean
  /**
   * Consecutive updates with the same group make a single undo step: typing in
   * a field or dragging a note is undone at once, not letter by letter.
   */
  group?: string
}

export type WorkspaceStore = ReturnType<typeof createWorkspaceStore>

/**
 * Holds the open workspace outside React so the save engine can read the
 * latest version at any moment. Components subscribe through
 * `useSyncExternalStore`.
 */
export function createWorkspaceStore(initial: Workspace) {
  let workspace = initial
  let past: Workspace[] = []
  let future: Workspace[] = []
  let currentGroup: string | null = null
  let dirty = false
  let snapshot = makeSnapshot()
  const listeners = new Set<() => void>()

  function makeSnapshot(): WorkspaceSnapshot {
    return { workspace, canUndo: past.length > 0, canRedo: future.length > 0, dirty }
  }

  function emit() {
    snapshot = makeSnapshot()
    listeners.forEach((listener) => listener())
  }

  function pushHistory() {
    past = [...past.slice(-(HISTORY_LIMIT - 1)), workspace]
    future = []
  }

  return {
    getSnapshot: () => snapshot,

    getWorkspace: () => workspace,

    subscribe(listener: () => void) {
      listeners.add(listener)

      return () => listeners.delete(listener)
    },

    update(updater: (current: Workspace) => Workspace, options: UpdateOptions = {}) {
      const next = updater(workspace)

      if (next === workspace) return

      const { history = true, group } = options

      if (history) {
        if (!group || group !== currentGroup) pushHistory()

        currentGroup = group ?? null
      }

      workspace = next
      dirty = true
      emit()
    },

    /** Closes the current undo group, so the next grouped update starts a new step. */
    endGroup() {
      currentGroup = null
    },

    undo() {
      const previous = past.at(-1)

      if (!previous) return

      past = past.slice(0, -1)
      future = [...future, workspace]
      workspace = previous
      currentGroup = null
      dirty = true
      emit()
    },

    redo() {
      const next = future.at(-1)

      if (!next) return

      future = future.slice(0, -1)
      past = [...past, workspace]
      workspace = next
      currentGroup = null
      dirty = true
      emit()
    },

    /**
     * Replaces the workspace with a version that came from disk. History is
     * cleared when the change came from someone else: undoing past it would
     * silently revert their work.
     */
    receive(next: Workspace, { resetHistory }: { resetHistory: boolean }) {
      if (resetHistory) {
        past = []
        future = []
        currentGroup = null
      }

      if (next === workspace && !resetHistory) return

      workspace = next
      emit()
    },

    /** Marks `saved` as written; the store stays dirty if it changed meanwhile. */
    markSaved(saved: Workspace) {
      if (saved === workspace && dirty) {
        dirty = false
        emit()
      }
    },
  }
}
