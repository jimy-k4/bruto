import type { AgentStamp, Workspace } from '../types'
import { isEqual, mergeWorkspaces, type MergeConflict } from '../domain/merge'
import {
  applyStatusStylesToChangedNotes,
  markReverted,
  serializeWorkspace,
  updateNotes,
} from '../domain/workspace'
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
  /** Adds lines to `.bruto/log.jsonl`, the agents' audit log. */
  appendLog?(lines: string): Promise<void>
}

/** Changes made by someone else, merged in. */
export interface ExternalChange {
  /** Note fields both sides changed: the user's values were kept over these. */
  conflicts: MergeConflict[]
  /** The board as saved, to name the notes. */
  workspace: Workspace
  /** Puts the other side's values back instead. */
  keepTheirs(): void
}

interface SyncOptions {
  store: WorkspaceStore
  io: WorkspaceIO
  /** Exact text of `workspace.json` when the workspace was loaded. */
  diskText: string
  onStatus: (status: SaveStatus) => void
  /** Called after changes made by someone else were merged in. */
  onExternalChange: (change: ExternalChange) => void
  saveDelay?: number
}

/** Times a save starts over when the file changes under it, before writing anyway. */
const RACE_RETRIES = 3

/** An agent's stamp once nothing of its change is undone any more. */
function withoutReverted(agent: AgentStamp | undefined): AgentStamp | undefined {
  if (!agent) return undefined

  const rest = { ...agent }

  delete rest.reverted
  delete rest.revertedAt

  return rest
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

  async function sync(force = false, attempt = 0): Promise<void> {
    if (disposed) return

    const local = store.getWorkspace()
    const readStamp = await io.stamp()
    const disk = await io.read()

    if (disk.kind === 'invalid' && !force) {
      diskStamp = await io.stamp()
      setStatus({ kind: 'disk-invalid', message: disk.error })

      return
    }

    let next: Workspace = local
    let external = false
    const conflicts: MergeConflict[] = []

    if (disk.kind === 'ok' && disk.text !== diskText) {
      const merged = applyStatusStylesToChangedNotes(
        local,
        mergeWorkspaces(base, local, disk.workspace, conflicts),
      )

      external = !isEqual(merged, local)
      // An agent's change the user's edit replaced says so on the note, for the agent to read.
      next = external ? markReverted(merged, base, conflicts) : local
    }

    const text = serializeWorkspace(next)

    if (disk.kind !== 'ok' || disk.text !== text) {
      // Someone wrote the file since we read it (an agent, say): start over with what's there.
      if (attempt < RACE_RETRIES && (await io.stamp()) !== readStamp) {
        return sync(force, attempt + 1)
      }

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

      if (conflicts.length > 0) await logReverted(next, conflicts)

      onExternalChange({
        conflicts,
        workspace: next,
        keepTheirs: () =>
          store.update((workspace) =>
            conflicts.reduce(
              (result, conflict) =>
                updateNotes(result, [conflict.noteId], {
                  [conflict.field]: conflict.replaced,
                  // Nothing of the agent's change is left undone.
                  ...(conflict.field !== 'agent' && {
                    agent: withoutReverted(
                      result.notes.find((note) => note.id === conflict.noteId)?.agent,
                    ),
                  }),
                }),
              workspace,
            ),
          ),
      })
    }

    store.markSaved(next)

    if (store.getSnapshot().dirty) {
      setStatus({ kind: 'unsaved' })
      scheduleSave()
    } else {
      setStatus({ kind: 'saved' })
    }
  }

  /**
   * The audit log says it too: what was written outside Bruto, by whom when an
   * agent's stamp tells, and that the user's edit replaced it. Never blocks a save.
   */
  async function logReverted(saved: Workspace, conflicts: MergeConflict[]) {
    if (!io.appendLog) return

    const at = new Date().toISOString()
    const lines = [...new Set(conflicts.map((conflict) => conflict.noteId))].map((noteId) => {
      const fields = conflicts.filter((conflict) => conflict.noteId === noteId)
      const agent = saved.notes.find((note) => note.id === noteId)?.agent
      const by = agent ? ` by ${agent.client}${agent.id ? ` (${agent.id})` : ''}` : ''

      return JSON.stringify({
        at,
        tool: 'merge',
        client: 'bruto',
        note: noteId,
        ok: true,
        result: `The user's edit replaced what was written outside Bruto${by}: ${fields.map((conflict) => conflict.field).join(', ')}.`,
        reverted: fields.map(({ field, replaced }) => ({ field, value: replaced })),
      })
    })

    try {
      await io.appendLog(`${lines.join('\n')}\n`)
    } catch {
      // The board is saved either way.
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
