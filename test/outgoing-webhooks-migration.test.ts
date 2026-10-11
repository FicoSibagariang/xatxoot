import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Outgoing Webhooks Database Migration (Task 2.7)', () => {
  const rootDir = join(import.meta.dir, '..')
  const migrationPath = join(rootDir, 'apps', 'api', 'migrations', '003_phase2_productivity.sql')

  it('should exist at apps/api/migrations/003_phase2_productivity.sql', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('should define outgoing_webhooks and outgoing_webhook_deliveries tables conforming to DATABASE_SCHEMA.md & PHASE_2_CHECKLIST.md', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?outgoing_webhooks/i)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?outgoing_webhook_deliveries/i)
  })

  it('should strictly NOT contain account_id (Single Organization Rule)', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql).not.toContain('account_id')
  })

  it('should include required columns and constraints for outgoing_webhooks', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/id UUID PRIMARY KEY/i)
    expect(sql).toMatch(/url TEXT NOT NULL/i)
    expect(sql).toMatch(/subscriptions TEXT\[\]/i)
    expect(sql).toContain('secret')
    expect(sql).toContain('active')
    expect(sql).toContain('created_at')
    expect(sql).toContain('updated_at')
  })

  it('should include required columns, foreign keys, and constraints for outgoing_webhook_deliveries', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toContain('REFERENCES outgoing_webhooks(id)')
    expect(sql).toContain('event_name')
    expect(sql).toMatch(/payload JSONB/i)
    expect(sql).toContain('response_status_code')
    expect(sql).toContain('response_body')
    expect(sql).toContain('attempt_count')
    expect(sql).toContain('status')
    expect(sql).toContain('created_at')
  })

  it('should include performance indexes for outgoing webhooks and delivery logs', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?idx_outgoing_webhooks_active ON outgoing_webhooks/i,
    )
    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?idx_outgoing_webhook_deliveries_webhook_id ON outgoing_webhook_deliveries/i,
    )
    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?idx_outgoing_webhook_deliveries_status ON outgoing_webhook_deliveries/i,
    )
  })

  it('should verify Phase 2 checklist marks Task 2.7 as completed', () => {
    const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_2_CHECKLIST.md'), 'utf-8')
    expect(checklistContent).toContain(
      '- [x] **Task 2.7**: Buat tabel `outgoing_webhooks` & riwayat log delivery.',
    )
  })
})
