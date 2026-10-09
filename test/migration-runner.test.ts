import { describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Database Migration Runner (apps/api/src/db/migrate.ts)', () => {
  const migrateModulePath = join(import.meta.dir, '..', 'apps', 'api', 'src', 'db', 'migrate.ts')

  it('should exist at apps/api/src/db/migrate.ts', () => {
    expect(existsSync(migrateModulePath)).toBe(true)
  })

  it('should export runMigrations and execute pending migrations sequentially', async () => {
    const { runMigrations } = await import('../apps/api/src/db/migrate')
    expect(typeof runMigrations).toBe('function')

    const tempDir = join(import.meta.dir, '..', 'scratch', 'test-migrations')
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
    mkdirSync(tempDir, { recursive: true })

    writeFileSync(join(tempDir, '001_create_test.sql'), 'CREATE TABLE test_table (id INT);')
    writeFileSync(
      join(tempDir, '002_add_column.sql'),
      'ALTER TABLE test_table ADD COLUMN name TEXT;',
    )
    writeFileSync(join(tempDir, 'ignore.txt'), 'not sql')

    const executed: string[] = []
    const appliedVersions: string[] = []

    interface MockSQL {
      (strings: TemplateStringsArray, ...values: unknown[]): Promise<{ version: string }[]>
      unsafe: (statement: string) => Promise<unknown[]>
      file: (filePath: string) => Promise<unknown[]>
    }

    const mockFn = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const raw = strings.join('?')
      if (raw.includes('SELECT version FROM schema_migrations')) {
        return appliedVersions.map((v) => ({ version: v }))
      }
      if (raw.includes('INSERT INTO schema_migrations')) {
        appliedVersions.push(String(values[0]))
        return []
      }
      return []
    }) as unknown as MockSQL

    mockFn.unsafe = async (statement: string) => {
      executed.push(statement)
      return []
    }
    mockFn.file = async (filePath: string) => {
      executed.push(`FILE:${filePath}`)
      return []
    }

    const applied = await runMigrations({
      db: mockFn as unknown as import('bun').SQL,
      migrationsDir: tempDir,
    })

    expect(applied).toEqual(['001_create_test.sql', '002_add_column.sql'])
    expect(appliedVersions).toEqual(['001_create_test.sql', '002_add_column.sql'])

    // Running again should apply 0 pending migrations
    const secondRun = await runMigrations({
      db: mockFn as unknown as import('bun').SQL,
      migrationsDir: tempDir,
    })
    expect(secondRun).toEqual([])

    rmSync(tempDir, { recursive: true, force: true })
  })
})
