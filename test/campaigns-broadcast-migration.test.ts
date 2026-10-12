import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Campaigns & Broadcast Database Migration (Task 4.4 - apps/api/migrations/005_phase4_insights.sql)', () => {
  const rootDir = join(import.meta.dir, '..')
  const migrationPath = join(rootDir, 'apps', 'api', 'migrations', '005_phase4_insights.sql')

  it('should exist at apps/api/migrations/005_phase4_insights.sql', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('should strictly NOT contain account_id (Single Organization Rule)', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql.toLowerCase()).not.toContain('account_id')
  })

  it('should define campaigns table conforming to DATABASE_SCHEMA.md & PHASE_4_CHECKLIST.md', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?campaigns/i)
    expect(sql).toMatch(/id UUID PRIMARY KEY/i)
    expect(sql).toMatch(/inbox_id UUID (NOT NULL )?REFERENCES inboxes\s*\(\s*id\s*\)/i)
    expect(sql).toContain('title')
    expect(sql).toContain('message_content')
    expect(sql).toContain('scheduled_at')
    expect(sql).toContain('status')
    expect(sql).toContain('anti_ban_delay_min')
    expect(sql).toContain('anti_ban_delay_max')
    expect(sql).toContain('created_at')
    expect(sql).toContain('updated_at')
  })

  it('should define campaign_deliveries table with foreign keys referencing campaigns and contacts', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?campaign_deliveries/i)
    expect(sql).toMatch(/id UUID PRIMARY KEY/i)
    expect(sql).toMatch(/campaign_id UUID (NOT NULL )?REFERENCES campaigns\s*\(\s*id\s*\)/i)
    expect(sql).toMatch(/contact_id UUID (NOT NULL )?REFERENCES contacts\s*\(\s*id\s*\)/i)
    expect(sql).toContain('status')
    expect(sql).toContain('error_message')
    expect(sql).toContain('sent_at')
    expect(sql).toContain('created_at')
    expect(sql).toContain('updated_at')
  })

  it('should include performance indexes for campaigns and campaign_deliveries', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/CREATE INDEX (IF NOT EXISTS )?idx_campaigns_inbox_id ON campaigns/i)
    expect(sql).toMatch(/CREATE INDEX (IF NOT EXISTS )?idx_campaigns_status ON campaigns/i)
    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?idx_campaign_deliveries_campaign_id ON campaign_deliveries/i,
    )
    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?idx_campaign_deliveries_contact_id ON campaign_deliveries/i,
    )
    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?idx_campaign_deliveries_status ON campaign_deliveries/i,
    )
  })

  it('should verify Phase 4 checklist marks Task 4.4 as completed', () => {
    const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_4_CHECKLIST.md'), 'utf-8')
    expect(checklistContent).toContain('- [x] **Task 4.4**: Buat tabel Campaigns & Broadcast:')
  })
})
