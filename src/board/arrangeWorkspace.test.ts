import { describe, expect, it } from 'vitest'
import type { CrossLink, GhostZone, Note, Workspace } from '../types'
import { createEmptyWorkspace } from '../domain/workspace'
import { ARRANGE_GAP } from './arrange'
import { arrangeWorkspace } from './arrangeWorkspace'
import { FRAME_PADDING, ZONE_LABEL_ROOM } from './geometry'

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

const zone = (
  project: string,
  ghost: string,
  offset: { x: number; y: number },
  crossLinks?: CrossLink[],
): GhostZone => ({
  project,
  offset,
  notes: [
    {
      id: ghost,
      title: ghost,
      colorTheme: 'concrete',
      pattern: 'raw',
      x: 0,
      y: 0,
      ...(crossLinks && { crossLinks }),
    },
  ],
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

/** Where a zone's single ghost sits on the board. */
const ghostAt = (workspace: Workspace, project: string) => {
  const found = workspace.ghosts!.find((item) => item.project === project)!

  return { x: found.notes[0].x + found.offset.x, y: found.notes[0].y + found.offset.y }
}

/** From a zone's top (its label) down to its ghost. */
const ZONE_TOP_TO_GHOST = ZONE_LABEL_ROOM + FRAME_PADDING

describe('arrangeWorkspace', () => {
  it('puts a zone the selection blocks on the level below, label and all', () => {
    const arranged = arrangeWorkspace(
      board([note('a', 100, 100, [blocks('api', 'g')])], [zone('api', 'g', { x: 2000, y: 2000 })]),
      ['a'],
      new Map(),
    )!

    expect(arranged.notes[0]).toMatchObject({ x: expect.any(Number), y: 100 })
    expect(ghostAt(arranged, 'api').y).toBe(100 + 160 + ARRANGE_GAP + ZONE_TOP_TO_GHOST)
  })

  it('arranges a zone joined by a related link, which has no direction, too', () => {
    const arranged = arrangeWorkspace(
      board(
        [
          note('a', 100, 100, [{ kind: 'related', project: 'api', noteId: 'g' }]),
          note('b', 0, 900),
        ],
        [zone('api', 'g', { x: 700, y: 120 })],
      ),
      ['a', 'b'],
      new Map(),
    )!

    expect(ghostAt(arranged, 'api')).not.toEqual({ x: 700, y: 120 })
  })

  it('brings zones joined only to other zones, and leaves the rest alone', () => {
    const arranged = arrangeWorkspace(
      board(
        [note('a', 100, 100, [blocks('api', 'g')])],
        [
          zone('api', 'g', { x: 2000, y: 2000 }, [blocks('front', 'h')]),
          zone('front', 'h', { x: 4000, y: 4000 }),
          zone('other', 'k', { x: 6000, y: 6000 }),
        ],
      ),
      ['a'],
      new Map(),
    )!

    expect(ghostAt(arranged, 'front').y).toBeGreaterThan(ghostAt(arranged, 'api').y)
    expect(ghostAt(arranged, 'front').x).toBeLessThan(4000)
    expect(ghostAt(arranged, 'other')).toEqual({ x: 6000, y: 6000 })
  })

  it('arranges one note with its zone, but not one note on its own', () => {
    expect(
      arrangeWorkspace(
        board([note('a', 0, 0)], [zone('api', 'g', { x: 9, y: 9 })]),
        ['a'],
        new Map(),
      ),
    ).toBeNull()
    expect(
      arrangeWorkspace(
        board([note('a', 0, 0, [blocks('api', 'g')])], [zone('api', 'g', { x: 9, y: 9 })]),
        ['a'],
        new Map(),
      ),
    ).not.toBeNull()
  })

  it('leaves notes outside the selection where they are', () => {
    const arranged = arrangeWorkspace(
      board([note('a', 0, 0), note('b', 900, 900), note('c', 5000, 5000)], []),
      ['a', 'b'],
      new Map(),
    )!

    expect(arranged.notes[2]).toMatchObject({ x: 5000, y: 5000 })
  })
})
