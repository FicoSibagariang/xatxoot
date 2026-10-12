import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Automation Rules Database Migration (Task 4.3 - apps/api/migrations/005_phase4_insights.sql)', () => {
  const rootDir = join(import.meta.dir, '..')
  const migrationPath = join(rootDir, 'apps', 'api', 'migrations', '005_phase4_insights.sql')

  it('should exist at apps/api/migrations/005_phase4_insights.sql', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('should strictly NOT contain account_id (Single Organization Rule)', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql.toLowerCase()).not.toContain('account_id')
  })

  it('should define automation_rules table conforming to DATABASE_SCHEMA.md & PHASE_4_CHECKLIST.md', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?automation_rules/i)
    expect(sql).toMatch(/id UUID PRIMARY KEY/i)
    expect(sql).toMatch(/name VARCHAR/i)
    expect(sql).toContain('event_name')
    expect(sql).toMatch(/conditions JSONB/i)
    expect(sql).toMatch(/actions JSONB/i)
    expect(sql).toMatch(/active BOOLEAN/i)
    expect(sql).toContain('created_at')
    expect(sql).toContain('updated_at')
  })

  it('should include performance indexes for automation rules event_name and active status', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?idx_automation_rules_event_name ON automation_rules/i,
    )
    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?idx_automation_rules_active ON automation_rules/i,
    )
  })

  it('should verify Phase 4 checklist marks Task 4.3 as completed', () => {
    const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_4_CHECKLIST.md'), 'utf-8')
    expect(checklistContent).toContain('- [x] **Task 4.3**: Buat tabel Automation Rules:')
  })
})
