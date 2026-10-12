import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Enterprise SSO Providers Database Migration (Task 5.5 - apps/api/migrations/006_phase5_advanced.sql)', () => {
  const rootDir = join(import.meta.dir, '..')
  const migrationPath = join(rootDir, 'apps', 'api', 'migrations', '006_phase5_advanced.sql')

  it('should exist at apps/api/migrations/006_phase5_advanced.sql', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('should strictly NOT contain account_id (Single Organization Rule)', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql.toLowerCase()).not.toContain('account_id')
  })

  it('should define sso_providers table with required columns conforming to DATABASE_SCHEMA.md & PHASE_5_CHECKLIST.md', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?sso_providers/i)
    expect(sql).toMatch(/id UUID PRIMARY KEY/i)
    expect(sql).toMatch(/provider_type VARCHAR/i)
    expect(sql).toContain('issuer_url')
    expect(sql).toContain('client_id')
    expect(sql).toMatch(/(client_secret_encrypted|client_secret_enc)/i)
    expect(sql).toContain('cert_data')
    expect(sql).toMatch(/active BOOLEAN/i)
    expect(sql).toContain('created_at')
    expect(sql).toContain('updated_at')
  })

  it('should include performance indexes for sso_providers lookups', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?idx_sso_providers_provider_type ON sso_providers/i,
    )
    expect(sql).toMatch(/CREATE INDEX (IF NOT EXISTS )?idx_sso_providers_active ON sso_providers/i)
  })

  it('should verify Phase 5 checklist marks Task 5.5 as completed', () => {
    const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_5_CHECKLIST.md'), 'utf-8')
    expect(checklistContent).toContain('- [x] **Task 5.5**: Buat tabel konfigurasi SSO Enterprise:')
  })
})
