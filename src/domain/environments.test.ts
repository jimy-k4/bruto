import { describe, expect, it } from 'vitest'
import { buildAiContext } from './aiContext'
import {
  DEFAULT_ENVIRONMENTS,
  environmentId,
  findEnvironment,
  nextEnvironment,
  normalizeEnvironments,
} from './environments'
import { zonesFrom } from './ghosts'
import { searchNotes } from './search'
import { duplicateNotes, normalizeWorkspace, updateNotes } from './workspace'

const board = (raw: Record<string, unknown>) =>
  normalizeWorkspace({ title: 'GTT', notes: [], connections: [], ...raw })

describe('the project’s environments', () => {
  it('are LOCAL, DEV, PRE and PRO unless the file lists its own, even none', () => {
    expect(board({}).environments).toBeUndefined()
    expect(board({ environments: [] }).environments).toEqual([])
    expect(DEFAULT_ENVIRONMENTS.map((item) => item.name)).toEqual(['LOCAL', 'DEV', 'PRE', 'PRO'])
  })

  it('come out of a hand-edited list valid, with unique ids, keeping what Bruto doesn’t know', () => {
    expect(
      normalizeEnvironments([
        'QA',
        { name: ' Staging ', id: 'stg', url: 'https://stg' },
        { name: 'Prod', id: 'stg', protected: true },
        { id: 'nameless' },
        42,
      ]),
    ).toEqual([
      { id: 'qa', name: 'QA' },
      { id: 'stg', name: 'Staging', url: 'https://stg' },
      { id: 'prod', name: 'Prod', protected: true },
    ])
  })

  it('are found by id or by name, and go in order up to production', () => {
    const pre = findEnvironment(DEFAULT_ENVIRONMENTS, 'Pre')

    expect(pre?.id).toBe('pre')
    expect(nextEnvironment(DEFAULT_ENVIRONMENTS, {})?.id).toBe('local')
    expect(nextEnvironment(DEFAULT_ENVIRONMENTS, { environment: 'pre' })?.id).toBe('pro')
    expect(nextEnvironment(DEFAULT_ENVIRONMENTS, { environment: 'pro' })).toBeUndefined()
  })

  it('get an id from the name that no other one has', () => {
    expect(environmentId('Pre-producción', [])).toBe('pre-produccion')
    expect(environmentId('DEV', DEFAULT_ENVIRONMENTS)).toBe('dev-2')
    expect(environmentId('···', [])).toBe('env')
  })
})

describe('a note’s environment', () => {
  it('is matched to the project’s by name, and kept as written when the project lacks it', () => {
    const workspace = board({
      notes: [
        { id: 'a', environment: 'PRE', environmentAt: '2026-10-20T10:00:00Z' },
        { id: 'b', environment: 'qa', environmentAt: 'yesterday' },
        { id: 'c', environment: '  ' },
      ],
    })

    expect(workspace.notes[0]).toMatchObject({
      environment: 'pre',
      environmentAt: '2026-10-20T10:00:00Z',
    })
    expect(workspace.notes[1].environment).toBe('qa')
    expect(workspace.notes[1].environmentAt).toBeUndefined()
    expect(workspace.notes[2].environment).toBeUndefined()
  })

  it('starts its clock when it changes, and leaves no trace when cleared', () => {
    const workspace = board({ notes: [{ id: 'a' }] })
    const moved = updateNotes(workspace, ['a'], { environment: 'dev' })
    const at = moved.notes[0].environmentAt

    expect(Date.parse(at!)).not.toBeNaN()
    expect(updateNotes(moved, ['a'], { environment: 'dev' }).notes[0].environmentAt).toBe(at)

    const cleared = updateNotes(moved, ['a'], { environment: undefined }).notes[0]

    expect('environment' in cleared || 'environmentAt' in cleared).toBe(false)
  })

  it('isn’t copied: a copy is a new task whose change hasn’t got anywhere', () => {
    const workspace = board({ notes: [{ id: 'a', title: 'Login', environment: 'pro' }] })
    const { workspace: next, ids } = duplicateNotes(workspace, ['a'], 'copy')

    expect(next.notes.find((note) => note.id === ids[0])?.environment).toBeUndefined()
  })

  it('filters the search', () => {
    const workspace = board({
      notes: [
        { id: 'a', status: 'done', environment: 'dev' },
        { id: 'b', status: 'done', environment: 'pro' },
        { id: 'c', status: 'done' },
      ],
    })

    const found = searchNotes(workspace.notes, {
      query: '',
      statuses: ['done'],
      environments: ['dev', 'pre'],
    })

    expect(found.map((note) => note.id)).toEqual(['a'])
  })

  it('reaches the AI by name, with its instruction only once the project uses environments', () => {
    const quiet = board({ notes: [{ id: 'aaaaaa', title: 'Login', status: 'todo' }] })

    expect(buildAiContext(quiet, 'entire', [])).not.toContain('Environment')

    const used = updateNotes(quiet, ['aaaaaa'], {
      environment: 'pre',
      environmentAt: '2026-10-20T10:00:00Z',
    })
    const context = buildAiContext(used, 'entire', [])

    expect(context).toContain('Environment: PRE (since 2026-10-20)')
    expect(context).toContain('production last: LOCAL → DEV → PRE → PRO')
    expect(context).toContain('PRE and PRO: only the user moves notes there')
  })

  it('travels with ghosts by its project’s name, marked when it is production', () => {
    const api = board({
      environments: [
        { id: 'int', name: 'INT' },
        { id: 'live', name: 'LIVE' },
      ],
      notes: [
        {
          id: 'n1',
          environment: 'live',
          crossLinks: [{ kind: 'blocks', project: 'front', noteId: 'f1' }],
        },
        {
          id: 'n2',
          environment: 'int',
          crossLinks: [{ kind: 'blocks', project: 'front', noteId: 'f2' }],
        },
      ],
    })
    const zones = zonesFrom({ project: 'api', workspace: api }, { project: 'front' }, '')
    const ghosts = zones.flatMap((zone) => zone.notes)

    expect(ghosts.find((ghost) => ghost.id === 'n1')).toMatchObject({
      environment: 'LIVE',
      live: true,
    })
    expect(ghosts.find((ghost) => ghost.id === 'n2')).toMatchObject({ environment: 'INT' })
    expect(ghosts.find((ghost) => ghost.id === 'n2')?.live).toBeUndefined()
  })
})
