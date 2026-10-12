import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Reporting Events Database Migration (Task 4.1 - apps/api/migrations/005_phase4_insights.sql)', () => {
  const rootDir = join(import.meta.dir, '..')
  const migrationPath = join(rootDir, 'apps', 'api', 'migrations', '005_phase4_insights.sql')

  it('should exist at apps/api/migrations/005_phase4_insights.sql', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('should define reporting_events table conforming to DATABASE_SCHEMA.md & PHASE_4_CHECKLIST.md', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?reporting_events/i)
  })

  it('should strictly NOT contain account_id (Single Organization Rule)', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql.toLowerCase()).not.toContain('account_id')
  })

  it('should include required columns and constraints for reporting_events', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/id UUID PRIMARY KEY/i)
    expect(sql).toContain('event_type')
    expect(sql).toContain('conversation_id')
    expect(sql).toContain('ticket_id')
    expect(sql).toContain('user_id')
    expect(sql).toContain('inbox_id')
    expect(sql).toContain('value_in_seconds')
    expect(sql).toContain('created_at')
  })

  it('should reference foreign tables properly (conversations, tickets, users, inboxes)', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/REFERENCES conversations\s*\(\s*id\s*\)/i)
    expect(sql).toMatch(/REFERENCES tickets\s*\(\s*id\s*\)/i)
    expect(sql).toMatch(/REFERENCES users\s*\(\s*id\s*\)/i)
    expect(sql).toMatch(/REFERENCES inboxes\s*\(\s*id\s*\)/i)
  })

  it('should include performance indexes for analytics and reporting queries', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?idx_reporting_events_event_type ON reporting_events/i,
    )
    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?idx_reporting_events_created_at ON reporting_events/i,
    )
    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?idx_reporting_events_inbox_id ON reporting_events/i,
    )
    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?idx_reporting_events_user_id ON reporting_events/i,
    )
    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?idx_reporting_events_ticket_id ON reporting_events/i,
    )
  })

  it('should verify Phase 4 checklist marks Task 4.1 as completed', () => {
    const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_4_CHECKLIST.md'), 'utf-8')
    expect(checklistContent).toContain(
      '- [x] **Task 4.1**: Buat tabel agregasi pelaporan & event audit:',
    )
  })
})
