import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Article Embeddings Database Migration (Task 5.2 - apps/api/migrations/006_phase5_advanced.sql)', () => {
  const rootDir = join(import.meta.dir, '..')
  const migrationPath = join(rootDir, 'apps', 'api', 'migrations', '006_phase5_advanced.sql')

  it('should exist at apps/api/migrations/006_phase5_advanced.sql', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('should strictly NOT contain account_id (Single Organization Rule)', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql.toLowerCase()).not.toContain('account_id')
  })

  it('should define article_embeddings table with required columns conforming to DATABASE_SCHEMA.md & PHASE_5_CHECKLIST.md', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?article_embeddings/i)
    expect(sql).toMatch(/id UUID PRIMARY KEY/i)
    expect(sql).toContain('article_id')
    expect(sql).toContain('chunk_text')
    expect(sql).toMatch(/embedding VECTOR\((1536|768)\)/i)
    expect(sql).toContain('created_at')
  })

  it('should reference portal_articles table properly with ON DELETE CASCADE', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(
      /article_id UUID (NOT NULL )?REFERENCES portal_articles\s*\(\s*id\s*\)\s*ON DELETE CASCADE/i,
    )
  })

  it('should include performance indexes for article_embeddings', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?idx_article_embeddings_article_id ON article_embeddings/i,
    )
  })

  it('should verify Phase 5 checklist marks Task 5.2 as completed', () => {
    const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_5_CHECKLIST.md'), 'utf-8')
    expect(checklistContent).toContain(
      '- [x] **Task 5.2**: Buat tabel vector embeddings untuk basis pengetahuan:',
    )
  })
})
