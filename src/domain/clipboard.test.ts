import { describe, expect, it } from 'vitest'
import type { Note } from '../types'
import { copyNotes, parseClipboard, pasteNotes } from './clipboard'
import { addConnection, createEmptyWorkspace } from './workspace'

const note = (id: string, x: number, y: number): Note => ({
  id,
  title: id,
  description: '',
  filePaths: [],
  webUrl: '',
  images: [],
  x,
  y,
  zIndex: 1,
  colorTheme: 'concrete',
  pattern: 'raw',
})

describe('note clipboard', () => {
  const source = addConnection(
    { ...createEmptyWorkspace('S'), notes: [note('a', 100, 100), note('b', 400, 150)] },
    'a',
    'b',
  )

  it('copies notes with the connections between them', () => {
    const clipboard = copyNotes(source, ['a', 'b'])

    expect(clipboard?.notes).toHaveLength(2)
    expect(clipboard?.connections).toHaveLength(1)
  })

  it('pastes into another project keeping layout, titles and connections', () => {
    const clipboard = copyNotes(source, ['a', 'b'])!
    const target = createEmptyWorkspace('T')

    const { workspace, ids } = pasteNotes(target, clipboard, { x: 1000, y: 1000 }, 'copy')

    expect(workspace.notes.map((item) => [item.title, item.x, item.y])).toEqual([
      ['a', 860, 920],
      ['b', 1160, 970],
    ])
    expect(workspace.connections[0]).toMatchObject({ from: ids[0], to: ids[1] })
  })

  it('marks titles as copies when pasting next to the originals', () => {
    const clipboard = copyNotes(source, ['a'])!

    const { workspace, ids } = pasteNotes(source, clipboard, { x: 0, y: 0 }, 'copy')

    expect(workspace.notes.find((item) => item.id === ids[0])?.title).toBe('a (copy)')
  })

  it('reads clipboards saved by older versions', () => {
    const legacySingle = { ...note('a', 0, 0) }
    const legacyGroup = {
      ...note('a', 0, 0),
      notes: [note('a', 0, 0), note('b', 10, 10)],
      connections: [{ id: 'c', from: 'a', to: 'b' }],
    }

    expect(parseClipboard(legacySingle)?.notes).toHaveLength(1)
    expect(parseClipboard(legacyGroup)).toMatchObject({ notes: [{ id: 'a' }, { id: 'b' }] })
    expect(parseClipboard('nope')).toBeNull()
  })
})
