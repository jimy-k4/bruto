import { describe, expect, it } from 'vitest'
import type { CrossLink, GhostZone, Note, Workspace } from '../types'
import { createEmptyWorkspace } from '../domain/workspace'
import { ARRANGE_GAP } from './arrange'
import { arrangeWorkspace } from './arrangeWorkspace'
import { FRAME_PADDING, ZONE_LABEL_ROOM, boundingRect, noteRect, zoneFrame } from './geometry'

const note = (id: string, x: number, y: number, crossLinks?: CrossLink[]): Note => ({
  id,
  title: id.toUpperCase(),
  description: '',
  filePaths: [],
  webUrls: [],
  images: [],
  x,
  y,
  zIndex: 1,
  colorTheme: 'concrete',
  pattern: 'raw',
  ...(crossLinks && { crossLinks }),
})

/** A zone with ghosts at the given places on their own board. */
const zone = (
  project: string,
  offset: { x: number; y: number },
  ghosts: { id: string; x?: number; y?: number; crossLinks?: CrossLink[] }[],
): GhostZone => ({
  project,
  offset,
  notes: ghosts.map(({ id, x = 0, y = 0, crossLinks }) => ({
    id,
    title: id,
    colorTheme: 'concrete',
    pattern: 'raw',
    x,
    y,
    ...(crossLinks && { crossLinks }),
  })),
  connections: [],
  syncedAt: '',
  hops: 1,
})

const blocks = (project: string, noteId: string): CrossLink => ({
  kind: 'blocks',
  project,
  noteId,
})

const board = (notes: Note[], ghosts: GhostZone[]): Workspace => ({
  ...createEmptyWorkspace('TEST'),
  notes,
  ghosts,
})

const NO_SIZES = new Map()

const frameOf = (workspace: Workspace, project: string) =>
  zoneFrame(
    workspace.ghosts!.find((item) => item.project === project)!,
    NO_SIZES,
  )

const notesBox = (workspace: Workspace) =>
  boundingRect(workspace.notes.map((item) => noteRect(item, NO_SIZES)))!

describe('arrangeWorkspace', () => {
  it('keeps the notes close however big a linked zone is', () => {
    // A zone as spread out as a board that was never tidied.
    const huge = zone('api', { x: 0, y: 0 }, [{ id: 'g' }, { id: 'far', x: 20_000, y: 30_000 }])
    const arranged = arrangeWorkspace(
      board(
        [note('a', 0, 0, [blocks('api', 'g')]), note('b', 5000, 5000), note('c', 9000, 0)],
        [huge],
      ),
      ['a', 'b', 'c'],
      NO_SIZES,
    )!
    const box = notesBox(arranged)

    expect(box.width).toBeLessThan(1000)
    expect(box.height).toBeLessThan(400)
  })

  it('puts a linked zone right of the notes, level with the note it links to', () => {
    const arranged = arrangeWorkspace(
      board(
        [note('a', 100, 100), note('b', 100, 600, [blocks('api', 'g')])],
        [zone('api', { x: 3000, y: -2000 }, [{ id: 'g' }])],
      ),
      ['a', 'b'],
      NO_SIZES,
    )!
    const notes = notesBox(arranged)
    const frame = frameOf(arranged, 'api')
    const b = arranged.notes.find((item) => item.id === 'b')!

    expect(frame.x).toBe(notes.x + notes.width + ARRANGE_GAP * 2)
    expect(frame.y - ZONE_LABEL_ROOM).toBe(b.y)
  })

  it('stacks zones without one on another, and brings the zones they lead to', () => {
    const arranged = arrangeWorkspace(
      board(
        [note('a', 0, 0, [blocks('api', 'g'), blocks('db', 'h')]), note('b', 400, 0)],
        [
          zone('api', { x: 5000, y: 5000 }, [{ id: 'g', crossLinks: [blocks('front', 'k')] }]),
          zone('db', { x: -5000, y: 5000 }, [{ id: 'h' }]),
          zone('front', { x: 9000, y: 9000 }, [{ id: 'k' }]),
          zone('other', { x: 7000, y: 7000 }, [{ id: 'z' }]),
        ],
      ),
      ['a', 'b'],
      NO_SIZES,
    )!
    const frames = ['api', 'db', 'front']
      .map((project) => frameOf(arranged, project))
      .sort((one, two) => one.y - two.y)

    for (let index = 1; index < frames.length; index++) {
      expect(frames[index].y - ZONE_LABEL_ROOM).toBeGreaterThanOrEqual(
        frames[index - 1].y + frames[index - 1].height + ARRANGE_GAP,
      )
      expect(frames[index].x).toBe(frames[0].x)
    }

    expect(frameOf(arranged, 'other')).toMatchObject({ x: 7000 - FRAME_PADDING })
  })

  it('places the zone of a single note, but has nothing to do for a note on its own', () => {
    expect(
      arrangeWorkspace(
        board([note('a', 0, 0)], [zone('api', { x: 9, y: 9 }, [{ id: 'g' }])]),
        ['a'],
        NO_SIZES,
      ),
    ).toBeNull()

    const arranged = arrangeWorkspace(
      board([note('a', 0, 0, [blocks('api', 'g')])], [zone('api', { x: 9, y: 9 }, [{ id: 'g' }])]),
      ['a'],
      NO_SIZES,
    )!

    expect(arranged.notes[0]).toMatchObject({ x: 0, y: 0 })
    expect(frameOf(arranged, 'api').x).toBe(280 + ARRANGE_GAP * 2)
  })

  it('leaves notes outside the selection where they are', () => {
    const arranged = arrangeWorkspace(
      board([note('a', 0, 0), note('b', 900, 900), note('c', 5000, 5000)], []),
      ['a', 'b'],
      NO_SIZES,
    )!

    expect(arranged.notes[2]).toMatchObject({ x: 5000, y: 5000 })
  })
})
