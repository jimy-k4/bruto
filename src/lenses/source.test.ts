import { describe, expect, it } from 'vitest'
import { stripSqlComments } from './source'

describe('stripSqlComments', () => {
  it('drops line comments and blanks block comments, keeping the line breaks', () => {
    expect(stripSqlComments('SELECT 1 -- one\nFROM dual /* the\ntable */;')).toBe(
      'SELECT 1 \nFROM dual       \n        ;',
    )
  })

  it('keeps comment marks inside strings, with their doubled quotes', () => {
    expect(stripSqlComments("SELECT 'it''s -- not /* a */ comment', '' FROM t -- gone")).toBe(
      "SELECT 'it''s -- not /* a */ comment', '' FROM t ",
    )
  })

  it('runs to the end of the script when a string or comment is never closed', () => {
    expect(stripSqlComments("SELECT 'open -- string")).toBe("SELECT 'open -- string")
    expect(stripSqlComments("SELECT 'open''")).toBe("SELECT 'open''")
    expect(stripSqlComments('SELECT 1 /* open\ncomment')).toBe('SELECT 1        \n       ')
    expect(stripSqlComments('SELECT 1 -- last line')).toBe('SELECT 1 ')
  })
})
