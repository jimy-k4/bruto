import { describe, expect, it } from 'vitest'
import { codeBlocks, hasCode, hasCodeBlocks, parseInline, parseRichText } from './richText'

const text = (value: string) => ({ kind: 'text', value })
const paragraph = (value: string) => ({ kind: 'paragraph', parts: [text(value)] })
const item = (value: string, lists: unknown[] = []) => ({ parts: [text(value)], lists })

describe('parseRichText', () => {
  it('leaves plain text as it is, line breaks included', () => {
    expect(parseRichText('Done.\nTested on mobile.')).toEqual([
      paragraph('Done.\nTested on mobile.'),
    ])
  })

  it('splits paragraphs at blank lines', () => {
    expect(parseRichText('One.\n\n\nTwo.')).toEqual([paragraph('One.'), paragraph('Two.')])
  })

  it('turns fenced code into blocks, with or without a language', () => {
    const markdown = [
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

    expect(parseRichText(markdown)).toEqual([
      paragraph('Push it with:'),
      {
        kind: 'code',
        language: 'bash',
        code: 'git -C D:\\jllinares\\Personal\\portfolio push origin content/textos:main',
      },
      paragraph('Then check:'),
      { kind: 'code', code: 'npm test' },
    ])
  })

  it('keeps inline code inside its sentence', () => {
    expect(parseRichText('Added `cancelBooking()` with the 2h rule.')).toEqual([
      {
        kind: 'paragraph',
        parts: [
          text('Added '),
          { kind: 'code', value: 'cancelBooking()' },
          text(' with the 2h rule.'),
        ],
      },
    ])
  })

  it('treats a line that is only code as a block to copy', () => {
    expect(parseRichText('Run:\n`git push origin main`')).toEqual([
      paragraph('Run:'),
      { kind: 'code', code: 'git push origin main' },
    ])
  })

  it('runs an unclosed fence to the end and keeps shorter fences inside a longer one', () => {
    expect(parseRichText('````md\n```js\nx\n```\n````')).toEqual([
      { kind: 'code', language: 'md', code: '```js\nx\n```' },
    ])
    expect(parseRichText('```\nnever closed')).toEqual([{ kind: 'code', code: 'never closed' }])
  })

  it('reads headings, without the closing hashes', () => {
    expect(parseRichText('## Diagnóstico\nCausa: custodia.\n### Flujo ###')).toEqual([
      { kind: 'heading', level: 2, parts: [text('Diagnóstico')] },
      paragraph('Causa: custodia.'),
      { kind: 'heading', level: 3, parts: [text('Flujo')] },
    ])
    // Not headings: a hash stuck to the word, or an issue number.
    expect(parseRichText('#tag and #192')).toEqual([paragraph('#tag and #192')])
  })

  it('reads a list right after a sentence, and ends it at a line that is not indented', () => {
    expect(parseRichText('Fallos:\n1. Toque fantasma.\n2) Decimales.\nSe abre solo.')).toEqual([
      paragraph('Fallos:'),
      { kind: 'list', ordered: true, items: [item('Toque fantasma.'), item('Decimales.')] },
      paragraph('Se abre solo.'),
    ])
  })

  it('nests lists by indentation and carries indented lines on the item above', () => {
    const markdown = [
      '- Web',
      '  - React',
      '    and Vue',
      '- API',
      '',
      '  more on API',
      '3. Third',
    ].join('\n')

    expect(parseRichText(markdown)).toEqual([
      {
        kind: 'list',
        ordered: false,
        items: [
          item('Web', [{ kind: 'list', ordered: false, items: [item('React\nand Vue')] }]),
          item('API\n\nmore on API'),
        ],
      },
      { kind: 'list', ordered: true, start: 3, items: [item('Third')] },
    ])
  })

  it('takes code out of a list, so it can still be copied', () => {
    expect(parseRichText('- Link:\n```\nhttps://x.dev\n```\n  (change the end)\n- Next')).toEqual([
      { kind: 'list', ordered: false, items: [item('Link:')] },
      { kind: 'code', code: 'https://x.dev' },
      paragraph('  (change the end)'),
      { kind: 'list', ordered: false, items: [item('Next')] },
    ])
  })

  it('reads quotes, with Markdown inside', () => {
    expect(parseRichText('> Said:\n> - one\n\nAfter')).toEqual([
      {
        kind: 'quote',
        blocks: [paragraph('Said:'), { kind: 'list', ordered: false, items: [item('one')] }],
      },
      paragraph('After'),
    ])
  })

  it('reads rules, and does not take them for lists', () => {
    expect(parseRichText('Above\n---\n- - -\n***\nBelow')).toEqual([
      paragraph('Above'),
      { kind: 'rule' },
      { kind: 'rule' },
      { kind: 'rule' },
      paragraph('Below'),
    ])
  })

  it('reads tables with their alignment, keeping | inside code and escaped', () => {
    const table = [
      '| Stack | Files | Note |',
      '| :--- | ---: | :-: |',
      '| **Next** | 12 | `a | b` |',
      '| Vue | 3 |',
      '| Escaped \\| pipe | 1 | x |',
      'After',
    ].join('\n')

    expect(parseRichText(table)).toEqual([
      {
        kind: 'table',
        align: ['left', 'right', 'center'],
        head: [[text('Stack')], [text('Files')], [text('Note')]],
        rows: [
          [
            [{ kind: 'strong', children: [text('Next')] }],
            [text('12')],
            [{ kind: 'code', value: 'a | b' }],
          ],
          [[text('Vue')], [text('3')], []],
          [[text('Escaped | pipe')], [text('1')], [text('x')]],
        ],
      },
      paragraph('After'),
    ])
  })

  it('needs a divider row for a table: a lone | is just text', () => {
    expect(parseRichText('a | b\nc | d')).toEqual([paragraph('a | b\nc | d')])
  })

  it('reads the Markdown AI answers use, as in a real one', () => {
    const answer = [
      '## Diagnóstico',
      '',
      '**Causa: fallo en custodia/backend, no en la vista.** `RYN/AportarDocumentos` devuelve un 403.',
      '',
      '### Flujo de subida',
      '1. `GET /Arq/GetDatosCustodia` → URL prefirmada.',
      '2. `PUT` del fichero.',
    ].join('\n')

    expect(parseRichText(answer).map((block) => block.kind)).toEqual([
      'heading',
      'paragraph',
      'heading',
      'list',
    ])
  })
})

describe('parseInline', () => {
  it('reads bold, italic and struck text, nested too', () => {
    expect(parseInline('**Papel** y *a **b** c* y ~~no~~ y __sí__ y _cursiva_')).toEqual([
      { kind: 'strong', children: [text('Papel')] },
      text(' y '),
      {
        kind: 'em',
        children: [text('a '), { kind: 'strong', children: [text('b')] }, text(' c')],
      },
      text(' y '),
      { kind: 'strike', children: [text('no')] },
      text(' y '),
      { kind: 'strong', children: [text('sí')] },
      text(' y '),
      { kind: 'em', children: [text('cursiva')] },
    ])
    expect(parseInline('***both***')).toEqual([
      { kind: 'strong', children: [{ kind: 'em', children: [text('both')] }] },
    ])
  })

  it('leaves alone stars and underscores that are not formatting', () => {
    for (const plain of [
      '*.service, *.guard…',
      'src/**/*.ts',
      '2 * 3 * 4',
      'snake_case_name and my_var',
      'a ** b',
      '**never closed',
    ])
      expect(parseInline(plain)).toEqual([text(plain)])
  })

  it('never reads formatting inside code', () => {
    expect(parseInline('**`a*b*`** and ``x ` y``')).toEqual([
      { kind: 'strong', children: [{ kind: 'code', value: 'a*b*' }] },
      text(' and '),
      { kind: 'code', value: 'x ` y' },
    ])
  })

  it('reads links and bare addresses, without the punctuation after them', () => {
    expect(
      parseInline(
        'Ver [la **web**](https://x.dev/a_(b)) o https://jimy.dev/bruto/. (https://y.dev)',
      ),
    ).toEqual([
      text('Ver '),
      {
        kind: 'link',
        href: 'https://x.dev/a_(b)',
        children: [text('la '), { kind: 'strong', children: [text('web')] }],
      },
      text(' o '),
      {
        kind: 'link',
        href: 'https://jimy.dev/bruto/',
        children: [text('https://jimy.dev/bruto/')],
      },
      text('. ('),
      { kind: 'link', href: 'https://y.dev', children: [text('https://y.dev')] },
      text(')'),
    ])
  })

  it('keeps only the text of a link that is not a web address', () => {
    expect(parseInline('[foo.ts](src/foo.ts) and [x](javascript:alert(1))')).toEqual([
      text('foo.ts and x'),
    ])
  })

  it('takes backslash escapes, but keeps Windows paths as written', () => {
    expect(parseInline('\\*not em\\* in C:\\Users\\jl\\.claude\\CLAUDE.md')).toEqual([
      text('*not em* in C:\\Users\\jl\\.claude\\CLAUDE.md'),
    ])
  })
})

describe('code in a text', () => {
  it('says whether there is code to copy', () => {
    expect(hasCodeBlocks('Uses `x` inline only')).toBe(false)
    expect(hasCodeBlocks('```\nx\n```')).toBe(true)
    expect(hasCodeBlocks('> quoted\n> ```\n> x\n> ```')).toBe(true)
    expect(hasCodeBlocks(undefined)).toBe(false)
  })

  it('says whether there is any code, inline included', () => {
    expect(hasCode('Uses `x` inline only')).toBe(true)
    expect(hasCode('`npm test`')).toBe(true)
    expect(hasCode('- run **`npm test`**')).toBe(true)
    expect(hasCode('| a |\n| - |\n| `b` |')).toBe(true)
    expect(hasCode('No code, not even a stray ` backtick')).toBe(false)
    expect(hasCode(undefined)).toBe(false)
  })

  it('lists every block of code, quoted ones included', () => {
    expect(codeBlocks('```sh\na\n```\n> ```\n> b\n> ```')).toEqual([
      { kind: 'code', language: 'sh', code: 'a' },
      { kind: 'code', code: 'b' },
    ])
  })
})
