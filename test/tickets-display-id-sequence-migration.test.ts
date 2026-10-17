import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Tickets Display ID Sequence and Unique Constraint Migration (apps/api/migrations/007_fix_tickets_display_id_sequence.sql)', () => {
  const migrationPath = join(
    import.meta.dir,
    '..',
    'apps',
    'api',
    'migrations',
    '007_fix_tickets_display_id_sequence.sql',
  )

  it('should exist at apps/api/migrations/007_fix_tickets_display_id_sequence.sql', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('should strictly NOT contain account_id (Single Organization Rule)', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql).not.toContain('account_id')
  })

  it('should include renumbering for existing duplicate display_id values', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql).toMatch(/ROW_NUMBER\(\)\s+OVER/i)
    expect(sql).toMatch(/UPDATE\s+tickets/i)
  })

  it('should synchronize PostgreSQL sequence with highest display_id', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql).toMatch(/setval/i)
    expect(sql).toContain('tickets')
    expect(sql).toContain('display_id')
  })

  it('should enforce UNIQUE constraint on tickets.display_id', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql).toMatch(/UNIQUE\s*\(\s*display_id\s*\)/i)
  })
})
