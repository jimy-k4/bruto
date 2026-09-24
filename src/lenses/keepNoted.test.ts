import { describe, expect, it } from 'vitest'
import type { ApiModel } from './dotnet'
import { keepNotedModel } from './keepNoted'
import type { DbModel } from './plsql'
import type { WebModel } from './web'

const noted = (wanted: string[]) => (paths: string[]) => paths.some((path) => wanted.includes(path))

describe('keepNotedModel', () => {
  it('keeps the web elements notes point at', () => {
    const model: WebModel = {
      framework: 'next',
      elements: [
        { path: 'app/page.tsx', name: 'Home', role: 'page', uses: [], usedBy: 0 },
        { path: 'app/Header.tsx', name: 'Header', role: 'component', uses: [], usedBy: 1 },
      ],
    }

    expect(keepNotedModel(model, noted(['app/page.tsx'])).elements.map((e) => e.name)).toEqual([
      'Home',
    ])
  })

  it('keeps API resources and parts on their own', () => {
    const model: ApiModel = {
      resources: [
        {
          name: 'Orders',
          route: '/api/orders',
          path: 'Orders.cs',
          kind: 'controller',
          auth: false,
          endpoints: [],
          uses: [],
        },
      ],
      parts: [{ name: 'OrderService', path: 'OrderService.cs', kind: 'service', types: [] }],
    }

    const kept = keepNotedModel(model, noted(['OrderService.cs']))

    expect(kept.resources).toEqual([])
    expect(kept.parts.map((part) => part.name)).toEqual(['OrderService'])
  })

  it('drops relations to tables that are gone', () => {
    const table = (name: string, path: string) => ({ name, path, columns: [] })
    const model: DbModel = {
      tables: [table('ORDERS', 'orders.sql'), table('CUSTOMERS', 'customers.sql')],
      relations: [{ from: 'ORDERS', fromColumns: ['C'], to: 'CUSTOMERS', toColumns: ['ID'] }],
      programs: [{ kind: 'package', name: 'PKG', paths: ['pkg.pks', 'pkg.pkb'], tables: [] }],
    }

    const kept = keepNotedModel(model, noted(['orders.sql', 'pkg.pkb']))

    expect(kept.tables.map((item) => item.name)).toEqual(['ORDERS'])
    expect(kept.relations).toEqual([])
    expect(kept.programs.map((item) => item.name)).toEqual(['PKG'])
  })
})
