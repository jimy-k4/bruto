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

const names = (query: string) =>
  findTables(tables, query).map(({ table, column }) =>
    column ? `${table.name}.${column}` : table.name,
  )

describe('findTables', () => {
  it('ranks the exact name, then names starting with it, then containing it, then columns', () => {
    expect(names('product')).toEqual(['PRODUCT_PRICES', 'PRODUCTS', 'ORDER_LINES.PRODUCT_ID'])
    expect(names('products')).toEqual(['PRODUCTS'])
    expect(names('lines')).toEqual(['ORDER_LINES'])
  })

  it('ignores case and accents, and finds a table by a column it has', () => {
    expect(names('customers')).toEqual(['CUSTOMERS'])
    expect(names('email')).toEqual(['CUSTOMERS.EMAIL'])
    expect(names('numero')).toEqual(['SOLICITUDES.NÚMERO_EXPEDIENTE'])
  })

  it('finds nothing for an empty query', () => {
    expect(findTables(tables, '  ')).toEqual([])
  })
})
