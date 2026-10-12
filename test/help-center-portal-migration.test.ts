import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Help Center / Portal Database Migration (Task 4.2 - apps/api/migrations/005_phase4_insights.sql)', () => {
  const rootDir = join(import.meta.dir, '..')
  const migrationPath = join(rootDir, 'apps', 'api', 'migrations', '005_phase4_insights.sql')

  it('should exist at apps/api/migrations/005_phase4_insights.sql', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('should strictly NOT contain account_id (Single Organization Rule)', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql.toLowerCase()).not.toContain('account_id')
  })

  it('should define portals table conforming to DATABASE_SCHEMA.md & PHASE_4_CHECKLIST.md', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?portals/i)
    expect(sql).toMatch(/name VARCHAR/i)
    expect(sql).toMatch(/slug VARCHAR\(\d+\) NOT NULL UNIQUE/i)
    expect(sql).toContain('custom_domain')
    expect(sql).toContain('header_text')
    expect(sql).toContain('logo_url')
    expect(sql).toContain('created_at')
    expect(sql).toContain('updated_at')
  })

  it('should define categories table/view with foreign key referencing portals(id)', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    // Table portal_categories (or categories)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?portal_categories/i)
    expect(sql).toMatch(/portal_id UUID (NOT NULL )?REFERENCES portals\s*\(\s*id\s*\)/i)
    expect(sql).toContain('description')
    expect(sql).toContain('position')
    expect(sql).toMatch(/VIEW (IF NOT EXISTS )?categories/i)
  })

  it('should define articles table/view with foreign keys referencing categories and users', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    // Table portal_articles (or articles)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?portal_articles/i)
    expect(sql).toMatch(/category_id UUID (NOT NULL )?REFERENCES portal_categories\s*\(\s*id\s*\)/i)
    expect(sql).toMatch(/author_id UUID REFERENCES users\s*\(\s*id\s*\)/i)
    expect(sql).toContain('title')
    expect(sql).toContain('content_markdown')
    expect(sql).toContain('status')
    expect(sql).toContain('views_count')
    expect(sql).toMatch(/VIEW (IF NOT EXISTS )?articles/i)
  })

  it('should include performance indexes for portal, category, and article lookups', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/CREATE INDEX (IF NOT EXISTS )?idx_portals_slug ON portals/i)
    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?idx_portal_categories_portal_id ON portal_categories/i,
    )
    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?idx_portal_articles_category_id ON portal_articles/i,
    )
    expect(sql).toMatch(
      /CREATE INDEX (IF NOT EXISTS )?idx_portal_articles_slug ON portal_articles/i,
    )
  })

  it('should verify Phase 4 checklist marks Task 4.2 as completed', () => {
    const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_4_CHECKLIST.md'), 'utf-8')
    expect(checklistContent).toContain('- [x] **Task 4.2**: Buat tabel Help Center / Portal:')
  })
})
