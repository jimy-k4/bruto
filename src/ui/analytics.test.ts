import { describe, expect, it } from 'vitest'

/** Source of every component, by path. */
const components = import.meta.glob<string>('../**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** Each <button> in a file, from its name to where it closes (its attributes come first). */
const buttons = (source: string) =>
  source
    .split(/<button\b/)
    .slice(1)
    .map((rest) => rest.split(/<\/button>|\/>/)[0])

describe('button click counting', () => {
  // Superveil only counts clicks on elements carrying data-superveil.
  it('tags every button with data-superveil', () => {
    const untagged = Object.entries(components).flatMap(([file, source]) =>
      buttons(source)
        .filter((button) => !button.includes('data-superveil='))
        .map(() => file),
    )
    expect(untagged).toEqual([])
  })

  // Names travel as they are: letters, digits and _:.- only, at most 50 characters.
  it('uses names Superveil accepts', () => {
    const names = Object.values(components).flatMap((source) =>
      [...source.matchAll(/data-superveil="([^"]*)"/g)].map((match) => match[1]),
    )
    expect(names.length).toBeGreaterThan(100)
    expect(names.filter((name) => !/^[\w:.-]{1,50}$/.test(name))).toEqual([])
  })
})
