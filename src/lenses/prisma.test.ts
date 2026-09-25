import { describe, expect, it } from 'vitest'
import { buildPrismaModel } from './prisma'

const SCHEMA = `
// Bookings for climbing gyms
model User {
  id       String    @id @default(uuid())
  email    String    @unique
  name     String?
  bookings Booking[]
}

model Booking {
  id       Int      @id @default(autoincrement())
  user     User     @relation(fields: [userId], references: [id])
  userId   String
  status   Status   @default(PENDING)
  tags     String[]
}

model GymMember {
  gymId  Int
  userId String
  @@id([gymId, userId])
}

enum Status {
  PENDING
  CONFIRMED
}
`

describe('buildPrismaModel', () => {
  const model = buildPrismaModel([{ path: 'prisma/schema.prisma', text: SCHEMA }])

  it('reads models as tables with their scalar fields and keys', () => {
    expect(model.tables.map((table) => table.name)).toEqual(['Booking', 'GymMember', 'User'])
    expect(model.tables[0].columns).toEqual([
      { name: 'id', type: 'Int', primaryKey: true, nullable: false },
      { name: 'userId', type: 'String', primaryKey: false, nullable: false },
      { name: 'status', type: 'Status', primaryKey: false, nullable: false },
      { name: 'tags', type: 'String[]', primaryKey: false, nullable: false },
    ])
    expect(model.tables[1].columns.every((column) => column.primaryKey)).toBe(true)
    expect(model.tables[2].columns.find((column) => column.name === 'name')?.nullable).toBe(true)
  })

  it('turns @relation into a foreign key and enums into types', () => {
    expect(model.relations).toEqual([
      { from: 'Booking', fromColumns: ['userId'], to: 'User', toColumns: ['id'] },
    ])
    expect(model.programs).toEqual([
      { kind: 'type', name: 'Status', paths: ['prisma/schema.prisma'], tables: [] },
    ])
  })
})
