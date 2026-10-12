import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Vector Extension Database Migration (Task 5.1 - apps/api/migrations/006_phase5_advanced.sql)', () => {
  const rootDir = join(import.meta.dir, '..')
  const migrationPath = join(rootDir, 'apps', 'api', 'migrations', '006_phase5_advanced.sql')

  it('should exist at apps/api/migrations/006_phase5_advanced.sql', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('should enable pgvector extension with CREATE EXTENSION IF NOT EXISTS vector', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql).toMatch(/CREATE EXTENSION IF NOT EXISTS "??vector"??;/i)
  })

  it('should strictly NOT contain account_id (Single Organization Rule)', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql.toLowerCase()).not.toContain('account_id')
  })

  it('should verify Phase 5 checklist marks Task 5.1 as completed', () => {
    const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_5_CHECKLIST.md'), 'utf-8')
    expect(checklistContent).toContain(
      '- [x] **Task 5.1**: Aktifkan ekstensi `CREATE EXTENSION IF NOT EXISTS vector;`.',
    )
  })
})
