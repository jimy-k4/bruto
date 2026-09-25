import { describe, expect, it } from 'vitest'
import { hasCodeBlocks, parseRichText } from './richText'

describe('parseRichText', () => {
  it('leaves plain text as it is', () => {
    expect(parseRichText('Done.\nTested on mobile.')).toEqual([
      { kind: 'text', parts: [{ kind: 'text', value: 'Done.\nTested on mobile.' }] },
    ])
  })

  it('turns fenced code into blocks, with or without a language', () => {
    const text = [
      'Push it with:',
      '',
      '```bash',
      'git -C D:\\jllinares\\Personal\\portfolio push origin content/textos:main',
      '```',
      '',
      'Then check:',
      '~~~',
      'npm test',
      '~~~',
    ].join('\n')

    expect(parseRichText(text)).toEqual([
      { kind: 'text', parts: [{ kind: 'text', value: 'Push it with:' }] },
      {
        kind: 'code',
        language: 'bash',
        code: 'git -C D:\\jllinares\\Personal\\portfolio push origin content/textos:main',
      },
      { kind: 'text', parts: [{ kind: 'text', value: 'Then check:' }] },
      { kind: 'code', code: 'npm test' },
    ])
  })

  it('keeps inline code inside its sentence', () => {
    expect(parseRichText('Added `cancelBooking()` with the 2h rule.')).toEqual([
      {
        kind: 'text',
        parts: [
          { kind: 'text', value: 'Added ' },
          { kind: 'code', value: 'cancelBooking()' },
          { kind: 'text', value: ' with the 2h rule.' },
        ],
      },
    ])
  })

  it('treats a line that is only code as a block to copy', () => {
    expect(parseRichText('Run:\n`git push origin main`')).toEqual([
      { kind: 'text', parts: [{ kind: 'text', value: 'Run:' }] },
      { kind: 'code', code: 'git push origin main' },
    ])
  })

  it('runs an unclosed fence to the end and keeps shorter fences inside a longer one', () => {
    expect(parseRichText('````md\n```js\nx\n```\n````')).toEqual([
      { kind: 'code', language: 'md', code: '```js\nx\n```' },
    ])
    expect(parseRichText('```\nnever closed')).toEqual([{ kind: 'code', code: 'never closed' }])
  })

  it('says whether there is code to copy', () => {
    expect(hasCodeBlocks('Uses `x` inline only')).toBe(false)
    expect(hasCodeBlocks('```\nx\n```')).toBe(true)
    expect(hasCodeBlocks(undefined)).toBe(false)
  })
})
