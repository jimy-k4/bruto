import { describe, expect, it } from 'vitest'
import type { Table } from './sql'
import { findTables } from './tableSearch'

const table = (name: string, ...columns: string[]): Table => ({
  name,
  path: 'db/tables.sql',
  columns: columns.map((column) => ({
    name: column,
    type: 'NUMBER',
    primaryKey: false,
    nullable: true,
  })),
})

const tables = [
  table('ORDER_LINES', 'ORDER_ID', 'PRODUCT_ID'),
  table('PRODUCTS', 'ID', 'NAME'),
  table('PRODUCT_PRICES', 'PRODUCT_ID', 'PRICE'),
  table('CUSTOMERS', 'ID', 'NAME', 'EMAIL'),
  table('SOLICITUDES', 'ID', 'NÚMERO_EXPEDIENTE'),
]

const undeclared = [
  { name: 'PRODUCT_TAGS', paths: ['db/pkg_products.pkb'] },
  { name: 'TIED_TIPOS_ELEMENTOS_DOCU', paths: ['data/43_tied.sql', 'db/docs.pks'] },
]

const names = (query: string) =>
  findTables(tables, query, undeclared).map(({ name, column, usedIn }) =>
    column ? `${name}.${column}` : usedIn ? `${name}?` : name,
  )

describe('findTables', () => {
  it('ranks the exact name, then names starting with it, then containing it, then columns', () => {
    expect(names('product')).toEqual([
      'PRODUCT_PRICES',
      'PRODUCTS',
      'PRODUCT_TAGS?',
      'ORDER_LINES.PRODUCT_ID',
    ])
    expect(names('products')).toEqual(['PRODUCTS'])
    expect(names('lines')).toEqual(['ORDER_LINES'])
  })

  it('ignores case and accents, and finds a table by a column it has', () => {
    expect(names('customers')).toEqual(['CUSTOMERS'])
    expect(names('email')).toEqual(['CUSTOMERS.EMAIL'])
    expect(names('numero')).toEqual(['SOLICITUDES.NÚMERO_EXPEDIENTE'])
  })

  it('finds tables the code uses but never creates, with the files that use them', () => {
    expect(names('tied')).toEqual(['TIED_TIPOS_ELEMENTOS_DOCU?'])
    expect(findTables(tables, 'tied', undeclared)[0]).toEqual({
      name: 'TIED_TIPOS_ELEMENTOS_DOCU',
      usedIn: ['data/43_tied.sql', 'db/docs.pks'],
    })
  })

  it('finds nothing for an empty query', () => {
    expect(findTables(tables, '  ')).toEqual([])
  })
})
