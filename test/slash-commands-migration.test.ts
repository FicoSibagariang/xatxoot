import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Slash Commands Database Migration (Task 2.3)', () => {
  const rootDir = join(import.meta.dir, '..')
  const migrationPath = join(rootDir, 'apps', 'api', 'migrations', '003_phase2_productivity.sql')

  it('should exist at apps/api/migrations/003_phase2_productivity.sql', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('should define slash_commands table conforming to DATABASE_SCHEMA.md & PHASE_2_CHECKLIST.md', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?slash_commands/i)
  })

  it('should strictly NOT contain account_id (Single Organization Rule)', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql).not.toContain('account_id')
  })

  it('should include required columns and constraints for slash_commands', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/id UUID PRIMARY KEY/i)
    expect(sql).toMatch(/name VARCHAR\(\d+\) NOT NULL UNIQUE/i)
    expect(sql).toContain('description')
    expect(sql).toMatch(/endpoint_url TEXT NOT NULL/i)
    expect(sql).toContain('auth_header')
    expect(sql).toContain('created_at')
    expect(sql).toContain('updated_at')
  })

  it('should include performance index for slash command name lookup', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/CREATE INDEX (IF NOT EXISTS )?idx_slash_commands_name ON slash_commands/i)
  })

  it('should verify Phase 2 checklist marks Task 2.3 as completed', () => {
    const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_2_CHECKLIST.md'), 'utf-8')
    expect(checklistContent).toContain(
      '- [x] **Task 2.3**: Buat tabel `slash_commands` (name, description, endpoint_url, auth_header).',
    )
  })
})
