import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Teams and Team Members Database Migration (apps/api/migrations/003_phase2_productivity.sql)', () => {
  const rootDir = join(import.meta.dir, '..')
  const migrationPath = join(rootDir, 'apps', 'api', 'migrations', '003_phase2_productivity.sql')

  it('should exist at apps/api/migrations/003_phase2_productivity.sql', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('should define teams and team_members tables conforming to DATABASE_SCHEMA.md & PHASE_2_CHECKLIST.md', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?teams/i)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?team_members/i)
  })

  it('should strictly NOT contain account_id (Single Organization Rule)', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql).not.toContain('account_id')
  })

  it('should include required columns and constraints for teams', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toContain('name')
    expect(sql).toContain('description')
    expect(sql).toContain('allow_auto_assign')
    expect(sql).toContain('created_at')
    expect(sql).toContain('updated_at')
  })

  it('should include required columns, foreign keys, and constraints for team_members', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toContain('REFERENCES teams(id)')
    expect(sql).toContain('REFERENCES users(id)')
    expect(sql).toMatch(/UNIQUE\s*\(\s*team_id\s*,\s*user_id\s*\)/i)
  })

  it('should include performance indexes for teams and team_members', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/CREATE INDEX (IF NOT EXISTS )?idx_team_members_team_id ON team_members/i)
    expect(sql).toMatch(/CREATE INDEX (IF NOT EXISTS )?idx_team_members_user_id ON team_members/i)
    expect(sql).toMatch(/CREATE INDEX (IF NOT EXISTS )?idx_teams_name ON teams/i)
  })

  it('should verify Phase 2 checklist marks Task 2.1 as completed', () => {
    const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_2_CHECKLIST.md'), 'utf-8')
    expect(checklistContent).toContain('- [x] **Task 2.1**: Buat tabel `teams` dan `team_members`.')
  })
})
