import { describe, expect, it } from 'vitest'
import type { Note, Workspace } from '../types'
import { buildAiContext } from './aiContext'
import { addConnection, createEmptyWorkspace } from './workspace'

const note = (id: string, patch: Partial<Note> = {}): Note => ({
  id,
  title: id.toUpperCase(),
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

function sample(): Workspace {
  let workspace: Workspace = {
    ...createEmptyWorkspace('SAMPLE'),
    description: 'Sample app',
    aiContext: 'Next.js + Supabase',
    notes: [
      note('aaaaaa-1', { status: 'todo', description: 'Fix login', filePaths: ['app/login.tsx'] }),
      note('bbbbbb-2', { status: 'review', aiResponse: 'Changed X', feedback: 'Still broken' }),
      note('cccccc-3', { status: 'done' }),
    ],
  }

  workspace = addConnection(workspace, 'aaaaaa-1', 'bbbbbb-2')
  workspace = addConnection(workspace, 'bbbbbb-2', 'aaaaaa-1')

  return workspace
}

describe('buildAiContext', () => {
  it('identifies notes with short ids and includes AI answers and feedback', () => {
    const text = buildAiContext(sample(), 'current', ['bbbbbb-2'])

    expect(text).toContain('### [bbbbbb] BBBBBB-2')
    expect(text).toContain('AI response:\n> Changed X')
    expect(text).toContain('Feedback:\n> Still broken')
    expect(text).not.toContain('AAAAAA-1')
  })

  it('lists the files the AI touched apart from the ones the user linked', () => {
    const workspace = sample()
    workspace.notes[0] = { ...workspace.notes[0], aiFilePaths: ['app/session.ts'] }

    const text = buildAiContext(workspace, 'current', ['aaaaaa-1'])

    expect(text).toContain('Files:\n- app/login.tsx')
    expect(text).toContain('Files changed by the AI:\n- app/session.ts')
    expect(text).toContain('`aiFilePaths`')
  })

  it('always explains how to answer', () => {
    expect(buildAiContext(sample(), 'current', ['aaaaaa-1'])).toContain(
      '## HOW TO USE THIS CONTEXT',
    )
  })

  it('follows connections and marks two-way relationships', () => {
    const text = buildAiContext(sample(), 'connected', ['aaaaaa-1'])

    expect(text).toContain('### [aaaaaa] AAAAAA-1')
    expect(text).toContain('### [bbbbbb] BBBBBB-2')
    expect(text).toContain('- [aaaaaa] AAAAAA-1 <-> [bbbbbb] BBBBBB-2')
  })

  it('lists finished notes briefly in a full copy', () => {
    const text = buildAiContext(sample(), 'entire', [])

    expect(text).not.toContain('### [cccccc]')
    expect(text).toContain('## CLOSED NOTES\n\n- [cccccc] CCCCCC-3 (done)')
    expect(text).toContain('## GLOBAL AI CONTEXT\n\nNext.js + Supabase')
  })

  describe('standing rules (status "loop")', () => {
    const withRule = (): Workspace => ({
      ...sample(),
      notes: [
        ...sample().notes,
        note('dddddd-4', {
          status: 'loop',
          title: 'UPDATE THE DOCS',
          description: 'On every change',
        }),
      ],
    })

    it('go in every copy, even when not selected, in their own section', () => {
      for (const scope of ['current', 'connected', 'entire'] as const) {
        const text = buildAiContext(withRule(), scope, ['aaaaaa-1'])
        const rules = text.indexOf('## STANDING RULES')

        expect(rules).toBeGreaterThan(-1)
        expect(text.indexOf('### [dddddd] UPDATE THE DOCS')).toBeGreaterThan(rules)
        expect(text.indexOf('### [dddddd] UPDATE THE DOCS')).toBeLessThan(text.indexOf('## NOTES'))
        expect(text.match(/\[dddddd\] UPDATE THE DOCS/g)).toHaveLength(1)
      }
    })

    it('are explained only when the project has some', () => {
      expect(buildAiContext(withRule(), 'current', ['aaaaaa-1'])).toContain('status "loop"')
      expect(buildAiContext(sample(), 'current', ['aaaaaa-1'])).not.toContain('STANDING RULES')
    })

    it('keep their connections to the notes being copied', () => {
      const workspace = addConnection(withRule(), 'dddddd-4', 'aaaaaa-1')

      expect(buildAiContext(workspace, 'current', ['aaaaaa-1'])).toContain(
        '- [dddddd] UPDATE THE DOCS -> [aaaaaa] AAAAAA-1',
      )
    })
  })
})
