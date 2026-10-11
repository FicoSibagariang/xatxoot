import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Macros Database Migration (Task 2.5)', () => {
  const rootDir = join(import.meta.dir, '..')
  const migrationPath = join(rootDir, 'apps', 'api', 'migrations', '003_phase2_productivity.sql')

  it('should exist at apps/api/migrations/003_phase2_productivity.sql', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('should define macros and macro_actions tables conforming to DATABASE_SCHEMA.md & PHASE_2_CHECKLIST.md', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?macros/i)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?macro_actions/i)
  })

  it('should strictly NOT contain account_id (Single Organization Rule)', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql).not.toContain('account_id')
  })

  it('should include required columns and constraints for macros', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/id UUID PRIMARY KEY/i)
    expect(sql).toContain('name')
    expect(sql).toContain('visibility')
    expect(sql).toContain('created_by')
    expect(sql).toContain('REFERENCES users(id)')
    expect(sql).toContain('created_at')
    expect(sql).toContain('updated_at')
  })

  it('should include required columns, foreign keys, and constraints for macro_actions', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toContain('REFERENCES macros(id)')
    expect(sql).toContain('action_type')
    expect(sql).toMatch(/action_payload JSONB/i)
    expect(sql).toContain('created_at')
  })

  it('should include performance indexes for macros and macro_actions', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/CREATE INDEX (IF NOT EXISTS )?idx_macros_created_by ON macros/i)
    expect(sql).toMatch(/CREATE INDEX (IF NOT EXISTS )?idx_macros_visibility ON macros/i)
    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?idx_macro_actions_macro_id ON macro_actions/i,
    )
  })

  it('should verify Phase 2 checklist marks Task 2.5 as completed', () => {
    const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_2_CHECKLIST.md'), 'utf-8')
    expect(checklistContent).toContain('- [x] **Task 2.5**: Buat tabel `macros` & `macro_actions`.')
  })
})
