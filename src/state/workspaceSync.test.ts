import { describe, expect, it, vi } from 'vitest'
import type { Note, Workspace } from '../types'
import {
  WorkspaceFormatError,
  createEmptyWorkspace,
  parseWorkspace,
  serializeWorkspace,
  updateNotes,
} from '../domain/workspace'
import type { DiskState } from '../storage/workspaceFile'
import { createWorkspaceStore } from './workspaceStore'
import { createWorkspaceSync, type SaveStatus, type WorkspaceIO } from './workspaceSync'

const note = (id: string, patch: Partial<Note> = {}): Note => ({
  id,
  title: id,
  description: '',
  filePaths: [],
  webUrl: '',
  images: [],
  x: 0,
  y: 0,
  zIndex: 1,
  colorTheme: 'concrete',
  pattern: 'raw',
  ...patch,
})

/** In-memory `workspace.json`. */
function fakeDisk(initial: Workspace) {
  let text = serializeWorkspace(initial)
  let version = 0

  const io: WorkspaceIO = {
    async read(): Promise<DiskState> {
      try {
        return { kind: 'ok', text, workspace: parseWorkspace(text) }
      } catch (error) {
        if (error instanceof WorkspaceFormatError) {
          return { kind: 'invalid', text, error: error.message }
        }

        throw error
      }
    },
    write: vi.fn(async (next: string) => {
      text = next
      version += 1
    }),
    async stamp() {
      return String(version)
    },
  }

  return {
    io,
    get text() {
      return text
    },
    get workspace() {
      return parseWorkspace(text)
    },
    /** Another tool writes the file. */
    externalWrite(next: string) {
      text = next
      version += 1
    },
  }
}

function setup(initial: Workspace) {
  const disk = fakeDisk(initial)
  const store = createWorkspaceStore(parseWorkspace(disk.text))
  const statuses: SaveStatus['kind'][] = []
  const onExternalChange = vi.fn()

  const sync = createWorkspaceSync({
    store,
    io: disk.io,
    diskText: disk.text,
    onStatus: (status) => statuses.push(status.kind),
    onExternalChange,
    saveDelay: 0,
  })

  return { disk, store, sync, statuses, onExternalChange }
}

const initial = (): Workspace => ({
  ...createEmptyWorkspace('P'),
  notes: [note('a', { status: 'todo' }), note('b', { status: 'todo' })],
})

describe('workspace sync', () => {
  it('saves local changes', async () => {
    const { disk, store, sync } = setup(initial())

    store.update((workspace) => updateNotes(workspace, ['a'], { title: 'Renamed' }))
    await sync.saveNow()

    expect(disk.workspace.notes[0].title).toBe('Renamed')
    expect(store.getSnapshot().dirty).toBe(false)
  })

  it('merges instead of overwriting what an AI wrote meanwhile', async () => {
    const { disk, store, sync, onExternalChange } = setup(initial())

    // The AI finishes note b while the user edits note a.
    disk.externalWrite(
      serializeWorkspace(
        updateNotes(disk.workspace, ['b'], { status: 'review', aiResponse: 'Fixed it' }),
      ),
    )
    store.update((workspace) => updateNotes(workspace, ['a'], { description: 'typed' }))
    await sync.saveNow()

    const [a, b] = disk.workspace.notes

    expect(a.description).toBe('typed')
    expect(b).toMatchObject({ status: 'review', aiResponse: 'Fixed it' })
    expect(store.getWorkspace().notes[1].aiResponse).toBe('Fixed it')
    expect(onExternalChange).toHaveBeenCalled()
  })

  it('picks up external changes when nothing is pending locally', async () => {
    const { disk, store, sync } = setup(initial())

    disk.externalWrite(
      serializeWorkspace({ ...disk.workspace, notes: [...disk.workspace.notes, note('c')] }),
    )
    await sync.checkDisk()

    expect(store.getWorkspace().notes.map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect(store.getSnapshot().dirty).toBe(false)
  })

  it('never overwrites a broken file on its own', async () => {
    const { disk, store, sync, statuses } = setup(initial())

    disk.externalWrite('{ "notes": [ ')
    store.update((workspace) => updateNotes(workspace, ['a'], { title: 'Mine' }))
    await sync.saveNow()

    expect(disk.text).toBe('{ "notes": [ ')
    expect(statuses.at(-1)).toBe('disk-invalid')
    expect(store.getSnapshot().dirty).toBe(true)
  })

  it('merges once the broken file is fixed', async () => {
    const { disk, store, sync } = setup(initial())

    disk.externalWrite('{ "notes": [ ')
    store.update((workspace) => updateNotes(workspace, ['a'], { title: 'Mine' }))
    await sync.saveNow()

    disk.externalWrite(serializeWorkspace({ ...initial(), notes: [...initial().notes, note('c')] }))
    await sync.checkDisk()

    expect(disk.workspace.notes.map((item) => [item.id, item.title])).toEqual([
      ['a', 'Mine'],
      ['b', 'b'],
      ['c', 'c'],
    ])
  })

  it('can overwrite a broken file when the user asks', async () => {
    const { disk, sync } = setup(initial())

    disk.externalWrite('garbage')
    await sync.overwriteDisk()

    expect(disk.workspace.notes).toHaveLength(2)
  })

  it('applies status styles to statuses an AI changed in the file', async () => {
    const start = { ...initial(), statusStyles: { review: { color: 'plum' as const } } }
    const { disk, store, sync } = setup(start)

    disk.externalWrite(
      serializeWorkspace({
        ...disk.workspace,
        notes: disk.workspace.notes.map((item) =>
          item.id === 'a' ? { ...item, status: 'review' as const } : item,
        ),
      }),
    )
    await sync.checkDisk()

    expect(store.getWorkspace().notes[0].colorTheme).toBe('plum')
    expect(disk.workspace.notes[0].colorTheme).toBe('plum')
  })

  it('writes ids for notes an AI added without one, so they stay stable', async () => {
    const { disk, sync, store } = setup(initial())

    disk.externalWrite(
      JSON.stringify({ ...disk.workspace, notes: [...disk.workspace.notes, { title: 'new' }] }),
    )
    await sync.checkDisk()

    const id = store.getWorkspace().notes[2].id

    expect(disk.workspace.notes[2].id).toBe(id)
  })
})
