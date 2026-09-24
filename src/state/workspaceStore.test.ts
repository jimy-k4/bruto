import { describe, expect, it } from 'vitest'
import { createEmptyWorkspace } from '../domain/workspace'
import { createWorkspaceStore } from './workspaceStore'

const rename = (title: string) => (workspace: ReturnType<typeof createEmptyWorkspace>) => ({
  ...workspace,
  title,
})

describe('workspace store', () => {
  it('undoes and redoes changes', () => {
    const store = createWorkspaceStore(createEmptyWorkspace('A'))

    store.update(rename('B'))
    store.update(rename('C'))
    store.undo()

    expect(store.getWorkspace().title).toBe('B')

    store.redo()

    expect(store.getWorkspace().title).toBe('C')
  })

  it('makes one undo step per group', () => {
    const store = createWorkspaceStore(createEmptyWorkspace('A'))

    store.update(rename('Ab'), { group: 'typing' })
    store.update(rename('Abc'), { group: 'typing' })
    store.endGroup()
    store.update(rename('Abcd'), { group: 'typing' })
    store.undo()

    expect(store.getWorkspace().title).toBe('Abc')

    store.undo()

    expect(store.getWorkspace().title).toBe('A')
  })

  it('skips history when asked', () => {
    const store = createWorkspaceStore(createEmptyWorkspace('A'))

    store.update(rename('B'), { history: false })

    expect(store.getSnapshot().canUndo).toBe(false)
  })

  it('ignores updates that change nothing', () => {
    const store = createWorkspaceStore(createEmptyWorkspace('A'))

    store.update((workspace) => workspace)

    expect(store.getSnapshot()).toMatchObject({ canUndo: false, dirty: false })
  })

  it('stays dirty when the workspace changed after the save started', () => {
    const store = createWorkspaceStore(createEmptyWorkspace('A'))

    store.update(rename('B'))
    const saving = store.getWorkspace()
    store.update(rename('C'))
    store.markSaved(saving)

    expect(store.getSnapshot().dirty).toBe(true)

    store.markSaved(store.getWorkspace())

    expect(store.getSnapshot().dirty).toBe(false)
  })

  it('clears history when receiving someone else changes', () => {
    const store = createWorkspaceStore(createEmptyWorkspace('A'))

    store.update(rename('B'))
    store.receive(createEmptyWorkspace('FROM DISK'), { resetHistory: true })

    expect(store.getSnapshot()).toMatchObject({ canUndo: false, canRedo: false })
    expect(store.getWorkspace().title).toBe('FROM DISK')
  })
})
