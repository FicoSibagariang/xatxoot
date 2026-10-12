import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('SLA Tables Database Migration (Task 5.4 - apps/api/migrations/006_phase5_advanced.sql)', () => {
  const rootDir = join(import.meta.dir, '..')
  const migrationPath = join(rootDir, 'apps', 'api', 'migrations', '006_phase5_advanced.sql')

  it('should exist at apps/api/migrations/006_phase5_advanced.sql', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('should strictly NOT contain account_id (Single Organization Rule)', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql.toLowerCase()).not.toContain('account_id')
  })

  it('should define sla_policies table with required columns conforming to DATABASE_SCHEMA.md & PHASE_5_CHECKLIST.md', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?sla_policies/i)
    expect(sql).toMatch(/id UUID PRIMARY KEY/i)
    expect(sql).toMatch(/name VARCHAR/i)
    expect(sql).toMatch(/inbox_id UUID REFERENCES inboxes\s*\(\s*id\s*\)/i)
    expect(sql).toContain('first_response_time_seconds')
    expect(sql).toContain('resolution_time_seconds')
  })

  it('should define ticket_sla_statuses table with foreign keys referencing tickets and sla_policies', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?ticket_sla_statuses/i)
    expect(sql).toMatch(/id UUID PRIMARY KEY/i)
    expect(sql).toMatch(
      /ticket_id UUID (NOT NULL )?REFERENCES tickets\s*\(\s*id\s*\)\s*ON DELETE CASCADE/i,
    )
    expect(sql).toMatch(/policy_id UUID REFERENCES sla_policies\s*\(\s*id\s*\)/i)
    expect(sql).toContain('first_response_deadline')
    expect(sql).toContain('resolution_deadline')
    expect(sql).toMatch(/is_breached BOOLEAN/i)
  })

  it('should include performance indexes for sla_policies and ticket_sla_statuses lookups', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/CREATE INDEX (IF NOT EXISTS )?idx_sla_policies_inbox_id ON sla_policies/i)
    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?idx_ticket_sla_statuses_ticket_id ON ticket_sla_statuses/i,
    )
    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?idx_ticket_sla_statuses_policy_id ON ticket_sla_statuses/i,
    )
    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?idx_ticket_sla_statuses_is_breached ON ticket_sla_statuses/i,
    )
  })

  it('should verify Phase 5 checklist marks Task 5.4 as completed', () => {
    const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_5_CHECKLIST.md'), 'utf-8')
    expect(checklistContent).toContain('- [x] **Task 5.4**: Buat tabel SLA:')
  })
})
