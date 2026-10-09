import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

describe('Database Connection Module (apps/api/src/db/index.ts)', () => {
  const dbModulePath = join(import.meta.dir, '..', 'apps', 'api', 'src', 'db', 'index.ts')

  it('should exist at apps/api/src/db/index.ts', () => {
    expect(existsSync(dbModulePath)).toBe(true)
  })

  it('should export native Bun SQL connection and factory', async () => {
    const { createDb, db, sql, DEFAULT_DATABASE_URL } = await import('../apps/api/src/db/index')

    expect(DEFAULT_DATABASE_URL).toBe(
      'postgresql://xatxoot:xatxoot_secret@localhost:5432/xatxoot_dev',
    )
    expect(typeof createDb).toBe('function')
    expect(typeof db).toBe('function')
    expect(typeof db.close).toBe('function')
    expect(sql).toBe(db)

    const customDb = createDb('postgresql://user:pass@localhost:5432/test_db')
    expect(typeof customDb).toBe('function')
    expect(typeof customDb.close).toBe('function')
    customDb.close()
  })
})
