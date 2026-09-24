import { describe, expect, it } from 'vitest'
import { layoutEr } from './erLayout'
import type { Relation, Table } from './plsql'

const table = (name: string, columns = 3): Table => ({
  name,
  path: 'db.sql',
  columns: Array.from({ length: columns }, (_, index) => ({
    name: `C${index}`,
    type: 'NUMBER',
    primaryKey: index === 0,
    nullable: true,
  })),
})

const relation = (from: string, to: string): Relation => ({
  from,
  fromColumns: [],
  to,
  toColumns: [],
})

describe('layoutEr', () => {
  const tables = ['LINES', 'ORDERS', 'CUSTOMERS', 'PRODUCTS', 'LOG'].map((name) => table(name, 14))
  const relations = [
    relation('ORDERS', 'CUSTOMERS'),
    relation('LINES', 'ORDERS'),
    relation('LINES', 'PRODUCTS'),
    relation('LOG', 'LOG'),
  ]
  const layout = layoutEr(tables, relations)
  const at = (name: string) => layout.tables.find((placed) => placed.table.name === name)!

  it('puts referenced tables above the ones pointing at them', () => {
    expect(at('CUSTOMERS').y).toBeLessThan(at('ORDERS').y)
    expect(at('ORDERS').y).toBeLessThan(at('LINES').y)
    expect(at('PRODUCTS').y).toBe(at('CUSTOMERS').y)
  })

  it('never overlaps two tables and fits them all in its size', () => {
    for (const [index, a] of layout.tables.entries()) {
      expect(a.x + a.width).toBeLessThanOrEqual(layout.width)
      expect(a.y + a.height).toBeLessThanOrEqual(layout.height)

      for (const b of layout.tables.slice(index + 1)) {
        const apart =
          a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y

        expect(apart).toBe(true)
      }
    }
  })

  it('survives cycles of foreign keys', () => {
    const cyclic = layoutEr([table('A'), table('B')], [relation('A', 'B'), relation('B', 'A')])

    expect(cyclic.tables).toHaveLength(2)
  })
})
