import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Chatbot Engine Database Migration (Task 2.4)', () => {
  const rootDir = join(import.meta.dir, '..')
  const migrationPath = join(rootDir, 'apps', 'api', 'migrations', '003_phase2_productivity.sql')

  it('should exist at apps/api/migrations/003_phase2_productivity.sql', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('should define bot_flows and bot_sessions tables conforming to DATABASE_SCHEMA.md & PHASE_2_CHECKLIST.md', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?bot_flows/i)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?bot_sessions/i)
  })

  it('should strictly NOT contain account_id (Single Organization Rule)', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql).not.toContain('account_id')
  })

  it('should include required columns and constraints for bot_flows', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/id UUID PRIMARY KEY/i)
    expect(sql).toContain('name')
    expect(sql).toContain('trigger_type')
    expect(sql).toContain('active')
    expect(sql).toMatch(/flow_definition JSONB/i)
    expect(sql).toContain('created_at')
    expect(sql).toContain('updated_at')
  })

  it('should include required columns, foreign keys, and constraints for bot_sessions', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toContain('REFERENCES conversations(id)')
    expect(sql).toContain('REFERENCES bot_flows(id)')
    expect(sql).toContain('current_node_id')
    expect(sql).toMatch(/context_data JSONB/i)
    expect(sql).toContain('created_at')
    expect(sql).toContain('updated_at')
  })

  it('should include performance indexes for bot_flows and bot_sessions', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/CREATE INDEX (IF NOT EXISTS )?idx_bot_flows_active ON bot_flows/i)
    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?idx_bot_sessions_conversation_id ON bot_sessions/i,
    )
    expect(sql).toMatch(/CREATE INDEX (IF NOT EXISTS )?idx_bot_sessions_flow_id ON bot_sessions/i)
  })

  it('should verify Phase 2 checklist marks Task 2.4 as completed', () => {
    const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_2_CHECKLIST.md'), 'utf-8')
    expect(checklistContent).toContain('- [x] **Task 2.4**: Buat tabel chatbot engine:')
  })
})
