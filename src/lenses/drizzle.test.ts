import { describe, expect, it } from 'vitest'
import { buildDrizzleModel } from './drizzle'

const SCHEMA = `
import { integer, pgEnum, pgTable, primaryKey, serial, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const status = pgEnum('booking_status', ['pending', 'confirmed'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text(),
})

// A booking belongs to a user.
export const bookings = pgTable('bookings', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  startsAt: timestamp('starts_at').notNull(),
})

export const gymMembers = pgTable(
  'gym_members',
  { gymId: integer('gym_id').notNull(), userId: uuid('user_id').notNull() },
  (t) => [primaryKey({ columns: [t.gymId, t.userId] })],
)
`

describe('buildDrizzleModel', () => {
  const model = buildDrizzleModel([{ path: 'src/db/schema.ts', text: SCHEMA }])

  it('reads tables with their SQL names, columns and keys', () => {
    expect(model.tables.map((table) => table.name)).toEqual(['bookings', 'gym_members', 'users'])
    expect(model.tables[2].columns).toEqual([
      { name: 'id', type: 'uuid', primaryKey: true, nullable: false },
      { name: 'email', type: 'text', primaryKey: false, nullable: false },
      { name: 'name', type: 'text', primaryKey: false, nullable: true },
    ])
    expect(model.tables[1].columns.every((column) => column.primaryKey)).toBe(true)
  })

  it('turns references into foreign keys and enums into types', () => {
    expect(model.relations).toEqual([
      { from: 'bookings', fromColumns: ['user_id'], to: 'users', toColumns: ['id'] },
    ])
    expect(model.programs).toEqual([
      { kind: 'type', name: 'booking_status', paths: ['src/db/schema.ts'], tables: [] },
    ])
  })
})
