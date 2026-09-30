import { describe, expect, it } from 'vitest'
import { readSources, type IndexedFile } from './projectFiles'

/** An indexed file whose handle hands back `text`, or fails with it. */
const indexed = (path: string, text: string | Error): IndexedFile => ({
  path,
  handle: {
    getFile: async () => {
      if (text instanceof Error) throw text

      return new File([text], path)
    },
  } as unknown as FileSystemFileHandle,
})

describe('readSources', () => {
  it('reads the wanted files in index order, many at once, saying how far it is', async () => {
    const scripts = Array.from({ length: 70 }, (_, index) =>
      indexed(`db/${index}.sql`, `-- ${index}`),
    )
    const progress: [number, number][] = []
    const sources = await readSources(
      [indexed('README.md', '# not wanted'), ...scripts],
      (path) => path.endsWith('.sql'),
      (read, total) => progress.push([read, total]),
    )

    expect(sources.map((source) => source.path)).toEqual(scripts.map((script) => script.path))
    expect(sources.at(-1)).toEqual({ path: 'db/69.sql', text: '-- 69' })
    expect(progress).toEqual([
      [0, 70],
      [32, 70],
      [64, 70],
      [70, 70],
    ])
  })

  it('leaves out the files it cannot read and the huge ones', async () => {
    const sources = await readSources(
      [
        indexed('a.sql', 'SELECT 1'),
        indexed('locked.sql', new Error('locked')),
        indexed('dump.sql', 'x'.repeat(512 * 1024 + 1)),
        indexed('b.sql', 'SELECT 2'),
      ],
      () => true,
    )

    expect(sources).toEqual([
      { path: 'a.sql', text: 'SELECT 1' },
      { path: 'b.sql', text: 'SELECT 2' },
    ])
  })
})
