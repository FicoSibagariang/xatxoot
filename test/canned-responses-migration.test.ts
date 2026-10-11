import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Canned Responses Database Migration (Task 2.2)', () => {
  const rootDir = join(import.meta.dir, '..')
  const migrationPath = join(rootDir, 'apps', 'api', 'migrations', '003_phase2_productivity.sql')

  it('should exist at apps/api/migrations/003_phase2_productivity.sql', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('should define canned_responses table conforming to DATABASE_SCHEMA.md & PHASE_2_CHECKLIST.md', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?canned_responses/i)
  })

  it('should strictly NOT contain account_id (Single Organization Rule)', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql).not.toContain('account_id')
  })

  it('should include required columns and constraints for canned_responses', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/id UUID PRIMARY KEY/i)
    expect(sql).toMatch(/short_code VARCHAR\(\d+\) NOT NULL UNIQUE/i)
    expect(sql).toMatch(/content TEXT NOT NULL/i)
    expect(sql).toContain('created_at')
    expect(sql).toContain('updated_at')
  })

  it('should include performance index for short_code lookup', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?idx_canned_responses_short_code ON canned_responses/i,
    )
  })

  it('should verify Phase 2 checklist marks Task 2.2 as completed', () => {
    const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_2_CHECKLIST.md'), 'utf-8')
    expect(checklistContent).toContain(
      '- [x] **Task 2.2**: Buat tabel `canned_responses` (short_code, content).',
    )
  })
})
