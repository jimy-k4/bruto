import { describe, expect, it } from 'vitest'
import type { Connection, CrossLink, Note, Workspace } from '../types'
import { ghostArrows, moveGhostZone, placeGhostZones, zoneKey, zonesFrom } from './ghosts'
import { parseWorkspace, serializeWorkspace } from './workspace'

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
  colorTheme: 'cobalt',
  pattern: 'raw',
  ...(crossLinks && { crossLinks }),
})

const arrow = (from: string, to: string): Connection => ({ id: `${from}-${to}`, from, to })

const board = (notes: Note[], connections: Connection[] = []): Workspace => ({
  version: 4,
  title: 'BOARD',
  description: '',
  aiContext: '',
  documentation: [],
  notes,
  connections,
})

const link = (kind: CrossLink['kind'], project: string, noteId: string): CrossLink => ({
  kind,
  project,
  noteId,
})

const NOW = '2026-10-05T10:00:00.000Z'

describe('ghost zones', () => {
  // The user's example: C and B lead to A in P1, and A blocks D in P2.
  const p1 = board(
    [
      note('a', 400, 100, [link('blocks', 'p2', 'd')]),
      note('c', 900, -10),
      note('b', 900, 210),
      note('lonely', 2000, 2000),
    ],
    [arrow('c', 'a'), arrow('b', 'a')],
  )
  const p2 = board([note('d', 0, 100, [link('blocked-by', 'p1', 'a')])])

  it('copies the linked note and the chain that leads to it, laid out as on its board', () => {
    const [zone, ...rest] = zonesFrom({ project: 'p1', workspace: p1 }, { project: 'p2' }, NOW)

    expect(rest).toEqual([])
    expect(zone.notes.map(({ id, x, y }) => ({ id, x, y }))).toEqual([
      { id: 'a', x: 400, y: 100 },
      { id: 'c', x: 900, y: -10 },
      { id: 'b', x: 900, y: 210 },
    ])
    expect(zone.connections).toEqual([arrow('c', 'a'), arrow('b', 'a')])
    expect(zone).toMatchObject({ project: 'p1', hops: 1, syncedAt: NOW })
  })

  it('places a new zone beside the note it links to, and the arrow points from what blocks', () => {
    const ghosts = placeGhostZones(
      p2,
      [
        {
          origin: { project: 'p1' },
          zones: zonesFrom({ project: 'p1', workspace: p1 }, { project: 'p2' }, NOW),
        },
      ],
      { project: 'p2' },
    )!
    const [zone] = ghosts

    // The chain runs leftwards in P1 (B and C sit right of A), so it does here too:
    // A lands right of D, at its height, and the rest keeps its place around A.
    expect(zone.notes[0].x + zone.offset.x).toBe(0 + 280 + 120)
    expect(zone.notes[0].y + zone.offset.y).toBe(100)
    expect(ghostArrows({ ...p2, ghosts })).toEqual([
      { key: expect.any(String), from: { zone: 'p1:a', id: 'a' }, to: { id: 'd' }, directed: true },
    ])
  })

  it('places a lone ghost by the arrows here, never over the notes here', () => {
    const ghosts = placeGhostZones(
      p1,
      [
        {
          origin: { project: 'p2' },
          zones: zonesFrom({ project: 'p2', workspace: p2 }, { project: 'p1' }, NOW),
        },
      ],
      { project: 'p1' },
    )!
    const [zone] = ghosts

    // B and C lead into A from its right: what A blocks, D, goes on its left.
    expect(zone.notes.map((ghost) => ghost.id)).toEqual(['d'])
    expect(zone.notes[0].x + zone.offset.x).toBe(400 - 120 - 280)
  })

  it('lets one project push its own zone and leaves the zones of others alone', () => {
    const others = placeGhostZones(
      db,
      [
        {
          origin: { project: 'api' },
          zones: zonesFrom({ project: 'api', workspace: apiWithFront }, { project: 'db' }, NOW),
        },
      ],
      { project: 'db' },
    )!
    const renamed = {
      ...front,
      notes: front.notes.map((item) => (item.id === 'c' ? { ...item, title: 'C2' } : item)),
    }
    const pushed = placeGhostZones(
      { ...db, ghosts: others },
      [
        {
          origin: { project: 'front' },
          zones: zonesFrom({ project: 'front', workspace: renamed }, { project: 'db' }, NOW),
        },
      ],
      { project: 'db' },
      { keepOthers: true },
    )!

    // DB doesn't link to the front itself: nothing of it comes straight, and the API's zones stay.
    expect(pushed.map((zone) => zone.project)).toEqual(['api', 'front'])
  })

  it('gives each group of joined notes its own zone, beside its own link', () => {
    // Two chains in P1 that have nothing to do with each other, each linked to a note in P2.
    const apart = board(
      [...p1.notes, note('report', 3000, 900, [link('blocks', 'p2', 'answer')])],
      p1.connections,
    )
    const here = board([...p2.notes, note('answer', 0, 900, [link('blocked-by', 'p1', 'report')])])
    const zones = zonesFrom({ project: 'p1', workspace: apart }, { project: 'p2' }, NOW)
    let workspace: Workspace = {
      ...here,
      ghosts: placeGhostZones(here, [{ origin: { project: 'p1' }, zones }], { project: 'p2' }),
    }
    const [chain, report] = workspace.ghosts!

    expect(workspace.ghosts!.map((zone) => zone.notes.map((ghost) => ghost.id))).toEqual([
      ['a', 'c', 'b'],
      ['report'],
    ])
    // Each sits by its own note here, not where the other one's board put it.
    expect(report.notes[0].y + report.offset.y).toBe(900)
    expect(chain.notes[0].y + chain.offset.y).toBe(100)

    // And each moves alone, keeping its place when read again.
    workspace = moveGhostZone(workspace, zoneKey(report), { x: 5000, y: 5000 })
    const again = placeGhostZones(workspace, [{ origin: { project: 'p1' }, zones }], {
      project: 'p2',
    })!

    expect(again.map((zone) => zone.offset)).toEqual([chain.offset, { x: 5000, y: 5000 }])
  })

  it('keeps where the user moved a zone, and the last copy of a project it can’t read', () => {
    const read = [
      {
        origin: { project: 'p1' },
        zones: zonesFrom({ project: 'p1', workspace: p1 }, { project: 'p2' }, NOW),
      },
    ]
    let workspace: Workspace = { ...p2, ghosts: placeGhostZones(p2, read, { project: 'p2' }) }

    workspace = moveGhostZone(workspace, zoneKey(workspace.ghosts![0]), { x: -1000, y: 40.4 })
    expect(placeGhostZones(workspace, read, { project: 'p2' })![0].offset).toEqual({
      x: -1000,
      y: 40,
    })
    expect(
      placeGhostZones(workspace, [{ origin: { project: 'p1' }, zones: null }], { project: 'p2' }),
    ).toEqual(workspace.ghosts)
  })

  // Notes in the front: A → B → C (links D); in the API: D → E → F → G (links H); in the database: H → I → J.
  const front = board(
    [note('a', 0, 0), note('b', 400, 0), note('c', 800, 0, [link('blocks', 'api', 'd')])],
    [arrow('a', 'b'), arrow('b', 'c')],
  )
  const api = board(
    [
      note('d', 0, 0, [link('blocked-by', 'front', 'c')]),
      note('e', 400, 0),
      note('f', 800, 0),
      note('g', 1200, 0, [link('blocks', 'db', 'h')]),
    ],
    [arrow('d', 'e'), arrow('e', 'f'), arrow('f', 'g')],
  )
  const db = board(
    [note('h', 0, 0, [link('blocked-by', 'api', 'g')]), note('i', 400, 0), note('j', 800, 0)],
    [arrow('h', 'i'), arrow('i', 'j')],
  )

  const apiWithFront: Workspace = {
    ...api,
    ghosts: placeGhostZones(
      api,
      [
        {
          origin: { project: 'front' },
          zones: zonesFrom({ project: 'front', workspace: front }, { project: 'api' }, NOW),
        },
      ],
      { project: 'api' },
    ),
  }

  it('passes on the zones that lead into the chain, through the board that holds them', () => {
    const zones = zonesFrom({ project: 'api', workspace: apiWithFront }, { project: 'db' }, NOW)
    const ghosts = placeGhostZones(db, [{ origin: { project: 'api' }, zones }], { project: 'db' })!

    expect(ghosts.map(({ project, via, hops }) => ({ project, via, hops }))).toEqual([
      { project: 'api', via: undefined, hops: 1 },
      { project: 'front', via: 'api', hops: 2 },
    ])
    expect(ghosts[0].notes.map((ghost) => ghost.id)).toEqual(['d', 'e', 'f', 'g'])
    expect(ghosts[1].notes.map((ghost) => ghost.id)).toEqual(['a', 'b', 'c'])

    // Front sits around the API zone as it sits around the API's own notes there.
    const [apiZone, frontZone] = ghosts
    const apiFront = apiWithFront.ghosts![0]

    expect(frontZone.offset.x - apiZone.offset.x).toBe(apiFront.offset.x)

    expect(ghostArrows({ ...db, ghosts }).map(({ from, to }) => [from, to])).toEqual([
      [{ zone: 'api:d', id: 'g' }, { id: 'h' }],
      [
        { zone: 'front:a', id: 'c' },
        { zone: 'api:d', id: 'd' },
      ],
    ])
  })

  it('never brings a project its own notes back, and stops after three boards', () => {
    const backToFront = zonesFrom(
      { project: 'api', workspace: apiWithFront },
      { project: 'front' },
      NOW,
    )

    // The front sees D, the note its link points at, but never its own zone back.
    expect(backToFront.map((zone) => [zone.project, zone.notes.map((ghost) => ghost.id)])).toEqual([
      ['api', ['d']],
    ])

    const far = {
      ...apiWithFront,
      ghosts: apiWithFront.ghosts!.map((zone) => ({ ...zone, hops: 3 })),
    }

    expect(
      zonesFrom({ project: 'api', workspace: far }, { project: 'db' }, NOW).map(
        (zone) => zone.project,
      ),
    ).toEqual(['api'])
  })

  it('keeps what the AI needs of each note, briefly, and survives a round trip through the file', () => {
    const long = {
      ...note('x', 0, 0, [link('blocks', 'p2', 'd')]),
      description: 'word '.repeat(200),
      filePaths: Array.from({ length: 14 }, (_, index) => `src/${index}.ts`),
    }
    const [zone] = zonesFrom({ project: 'p1', workspace: board([long]) }, { project: 'p2' }, NOW)

    expect(zone.notes[0].description!.length).toBeLessThanOrEqual(401)
    expect(zone.notes[0].files).toHaveLength(10)

    const workspace = { ...p2, ghosts: [zone, { project: '', notes: [] }] } as unknown as Workspace

    expect(parseWorkspace(serializeWorkspace(workspace)).ghosts).toEqual([zone])
  })
})
