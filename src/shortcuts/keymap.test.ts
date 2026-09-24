import { describe, expect, it } from 'vitest'
import { matchShortcut } from './keymap'

/** Just the fields the matcher reads: tests run in Node, without DOM events. */
const key = (init: Partial<KeyboardEvent>) =>
  ({ ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...init }) as KeyboardEvent

describe('matchShortcut', () => {
  it('matches letters on a Latin layout by the letter itself', () => {
    expect(matchShortcut(key({ key: 'q', code: 'KeyA' }))?.action).toBe('copyCurrent') // AZERTY
  })

  it('falls back to the physical key on Cyrillic and CJK layouts', () => {
    expect(matchShortcut(key({ key: 'й', code: 'KeyQ' }))?.action).toBe('copyCurrent')
    expect(matchShortcut(key({ key: 'Process', code: 'KeyN' }))?.action).toBe('newNote')
  })

  it('tells modifiers apart', () => {
    expect(matchShortcut(key({ key: 'z', code: 'KeyZ', ctrlKey: true }))?.action).toBe('undo')
    expect(
      matchShortcut(key({ key: 'Z', code: 'KeyZ', ctrlKey: true, shiftKey: true }))?.action,
    ).toBe('redo')
    expect(matchShortcut(key({ key: 'a', code: 'KeyA', ctrlKey: true }))?.action).toBe('selectAll')
    expect(matchShortcut(key({ key: 'a', code: 'KeyA' }))?.action).toBe('openAiContext')
  })

  it('accepts ? however the layout produces it', () => {
    expect(matchShortcut(key({ key: '?', code: 'Minus', shiftKey: true }))?.action).toBe('help')
  })

  it('reads the project number from Alt+digit', () => {
    expect(matchShortcut(key({ key: '¡', code: 'Digit2', altKey: true }))).toMatchObject({
      action: 'switchProject',
      key: '2',
    })
  })

  it('ignores AltGr combinations used to type characters', () => {
    // AltGr+2 types "@" on Spanish keyboards and arrives as Ctrl+Alt.
    expect(matchShortcut(key({ key: '@', code: 'Digit2', altKey: true, ctrlKey: true }))).toBeNull()
  })
})
