import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('AI Settings Database Migration (Task 5.3 - apps/api/migrations/006_phase5_advanced.sql)', () => {
  const rootDir = join(import.meta.dir, '..')
  const migrationPath = join(rootDir, 'apps', 'api', 'migrations', '006_phase5_advanced.sql')

  it('should exist at apps/api/migrations/006_phase5_advanced.sql', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('should strictly NOT contain account_id (Single Organization Rule)', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql.toLowerCase()).not.toContain('account_id')
  })

  it('should define ai_settings table with required columns conforming to DATABASE_SCHEMA.md & PHASE_5_CHECKLIST.md', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?ai_settings/i)
    expect(sql).toMatch(/id UUID PRIMARY KEY/i)
    expect(sql).toMatch(/provider VARCHAR/i)
    expect(sql).toMatch(/(api_key_encrypted|api_key_enc)/i)
    expect(sql).toMatch(/model_name VARCHAR/i)
    expect(sql).toMatch(/temperature NUMERIC/i)
    expect(sql).toMatch(/active BOOLEAN/i)
    expect(sql).toContain('created_at')
    expect(sql).toContain('updated_at')
  })

  it('should include performance indexes for ai_settings lookups', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/CREATE INDEX (IF NOT EXISTS )?idx_ai_settings_provider ON ai_settings/i)
    expect(sql).toMatch(/CREATE INDEX (IF NOT EXISTS )?idx_ai_settings_active ON ai_settings/i)
  })

  it('should verify Phase 5 checklist marks Task 5.3 as completed', () => {
    const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_5_CHECKLIST.md'), 'utf-8')
    expect(checklistContent).toContain('- [x] **Task 5.3**: Buat tabel konfigurasi AI provider:')
  })
})
