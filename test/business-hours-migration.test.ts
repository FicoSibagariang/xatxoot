import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Business Hours Database Migration (Task 3.2 - apps/api/migrations/004_phase3_omnichannel.sql)', () => {
  const rootDir = join(import.meta.dir, '..')
  const migrationPath = join(rootDir, 'apps', 'api', 'migrations', '004_phase3_omnichannel.sql')

  it('should exist at apps/api/migrations/004_phase3_omnichannel.sql', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('should define business_hours table', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?business_hours/i)
  })

  it('should strictly NOT contain account_id (Single Organization Rule)', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql).not.toContain('account_id')
  })

  it('should include required columns and constraints for business_hours', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toContain('inbox_id')
    expect(sql).toContain('timezone')
    expect(sql).toContain('weekly_schedule')
    expect(sql).toContain('out_of_office_message')
    expect(sql).toContain('created_at')
    expect(sql).toContain('updated_at')
  })

  it('should reference inboxes(id) via foreign key constraint', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql).toMatch(/REFERENCES inboxes\s*\(\s*id\s*\)/i)
  })

  it('should include performance index for inbox_id on business_hours', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?idx_business_hours_inbox_id ON business_hours/i,
    )
  })

  it('should verify Phase 3 checklist marks Task 3.2 as completed', () => {
    const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_3_CHECKLIST.md'), 'utf-8')
    expect(checklistContent).toContain('- [x] **Task 3.2**: Buat tabel konfigurasi jam kerja:')
  })
})
