import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('CSAT Surveys Database Migration (Task 3.3 - apps/api/migrations/004_phase3_omnichannel.sql)', () => {
  const rootDir = join(import.meta.dir, '..')
  const migrationPath = join(rootDir, 'apps', 'api', 'migrations', '004_phase3_omnichannel.sql')

  it('should exist at apps/api/migrations/004_phase3_omnichannel.sql', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('should define csat_surveys table', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?csat_surveys/i)
  })

  it('should strictly NOT contain account_id (Single Organization Rule)', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql).not.toContain('account_id')
  })

  it('should include required columns and constraints for csat_surveys', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toContain('ticket_id')
    expect(sql).toContain('contact_id')
    expect(sql).toContain('rating')
    expect(sql).toContain('feedback_text')
    expect(sql).toContain('submitted_at')
    expect(sql).toContain('created_at')
    expect(sql).toContain('updated_at')
  })

  it('should reference tickets(id) and contacts(id) via foreign key constraints', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql).toMatch(/REFERENCES tickets\s*\(\s*id\s*\)/i)
    expect(sql).toMatch(/REFERENCES contacts\s*\(\s*id\s*\)/i)
  })

  it('should enforce rating check constraint between 1 and 5', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql).toMatch(/CHECK\s*\(\s*rating\s*>=\s*1\s*AND\s*rating\s*<=\s*5\s*\)/i)
  })

  it('should include performance indexes for csat_surveys query lookups', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql).toMatch(/CREATE INDEX (IF NOT EXISTS )?idx_csat_surveys_ticket_id ON csat_surveys/i)
    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?idx_csat_surveys_contact_id ON csat_surveys/i,
    )
    expect(sql).toMatch(/CREATE INDEX (IF NOT EXISTS )?idx_csat_surveys_rating ON csat_surveys/i)
  })

  it('should verify Phase 3 checklist marks Task 3.3 as completed', () => {
    const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_3_CHECKLIST.md'), 'utf-8')
    expect(checklistContent).toContain('- [x] **Task 3.3**: Buat tabel survei kepuasan pelanggan:')
  })
})
