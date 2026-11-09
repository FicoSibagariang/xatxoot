import { describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { runMigrations } from '../src/db/migrate'

describe('Transactional Atomic Migration Runner & Locking Mechanism (apps/api/src/db/migrate.ts)', () => {
  const scratchDir = join(import.meta.dir, '..', '..', '..', 'scratch', 'atomic-test-migrations')

  it('should acquire and release advisory lock during migration execution', async () => {
    if (existsSync(scratchDir)) {
      rmSync(scratchDir, { recursive: true, force: true })
    }
    mkdirSync(scratchDir, { recursive: true })
    writeFileSync(join(scratchDir, '001_initial.sql'), 'CREATE TABLE atomic_test (id INT);')

    const callLogs: string[] = []
    const appliedVersions: string[] = []

    interface MockSQL {
      (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>
      unsafe: (statement: string) => Promise<unknown[]>
      file: (filePath: string) => Promise<unknown[]>
      begin?: (cb: (tx: unknown) => Promise<unknown>) => Promise<unknown>
    }

    const mockDb = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const raw = strings.join('?')
      callLogs.push(raw.trim())
      if (raw.includes('SELECT version FROM schema_migrations')) {
        return appliedVersions.map((v) => ({ version: v }))
      }
      if (raw.includes('INSERT INTO schema_migrations')) {
        appliedVersions.push(String(values[0]))
        return []
      }
      return []
    }) as unknown as MockSQL

    mockDb.unsafe = async (statement: string) => {
      callLogs.push(`UNSAFE:${statement.trim()}`)
      return []
    }
    mockDb.file = async (filePath: string) => {
      callLogs.push(`FILE:${filePath}`)
      return []
    }

    const applied = await runMigrations({
      db: mockDb as unknown as import('bun').SQL,
      migrationsDir: scratchDir,
    })

    expect(applied).toEqual(['001_initial.sql'])

    // Verify advisory lock was acquired and released
    const lockAcquired = callLogs.some((log) => log.includes('pg_advisory_lock'))
    const lockReleased = callLogs.some((log) => log.includes('pg_advisory_unlock'))
    expect(lockAcquired).toBe(true)
    expect(lockReleased).toBe(true)

    rmSync(scratchDir, { recursive: true, force: true })
  })

  it('should execute migration within a transaction and rollback completely on statement failure', async () => {
    if (existsSync(scratchDir)) {
      rmSync(scratchDir, { recursive: true, force: true })
    }
    mkdirSync(scratchDir, { recursive: true })

    // Migration with a bad statement that causes an error
    writeFileSync(join(scratchDir, '001_valid.sql'), 'CREATE TABLE good_table (id INT);')
    writeFileSync(
      join(scratchDir, '002_fail.sql'),
      'CREATE TABLE bad_table (id INT);\nSYNTAX ERROR TRIGGERING FAILURE;\nCREATE TABLE never_reached (id INT);',
    )

    const callLogs: string[] = []
    const appliedVersions: string[] = []

    interface MockSQL {
      (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>
      unsafe: (statement: string) => Promise<unknown[]>
      file: (filePath: string) => Promise<unknown[]>
      begin?: (cb: (tx: unknown) => Promise<unknown>) => Promise<unknown>
    }

    const mockDb = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const raw = strings.join('?')
      callLogs.push(raw.trim())
      if (raw.includes('SELECT version FROM schema_migrations')) {
        return appliedVersions.map((v) => ({ version: v }))
      }
      if (raw.includes('INSERT INTO schema_migrations')) {
        appliedVersions.push(String(values[0]))
        return []
      }
      return []
    }) as unknown as MockSQL

    // Mock sql.begin that handles transactions
    mockDb.begin = async (cb: (tx: unknown) => Promise<unknown>) => {
      callLogs.push('TRANSACTION_BEGIN')
      const txMock = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const raw = strings.join('?')
        callLogs.push(`TX:${raw.trim()}`)
        if (raw.includes('INSERT INTO schema_migrations')) {
          appliedVersions.push(String(values[0]))
        }
        return []
      }) as unknown as MockSQL

      txMock.unsafe = async (statement: string) => {
        callLogs.push(`TX_UNSAFE:${statement.trim()}`)
        if (statement.includes('SYNTAX ERROR TRIGGERING FAILURE')) {
          throw new Error('Postgres syntax error simulated')
        }
        return []
      }

      txMock.file = async (filePath: string) => {
        const content = await Bun.file(filePath).text()
        return txMock.unsafe(content)
      }

      try {
        const result = await cb(txMock)
        callLogs.push('TRANSACTION_COMMIT')
        return result
      } catch (err) {
        callLogs.push('TRANSACTION_ROLLBACK')
        throw err
      }
    }

    // Running migrations should throw on 002_fail.sql
    let caughtError: Error | null = null
    try {
      await runMigrations({
        db: mockDb as unknown as import('bun').SQL,
        migrationsDir: scratchDir,
      })
    } catch (err) {
      caughtError = err as Error
    }

    expect(caughtError).not.toBeNull()
    expect(caughtError?.message).toContain('Postgres syntax error simulated')

    // 001_valid should be recorded, but 002_fail should NOT be recorded in schema_migrations
    expect(appliedVersions).toContain('001_valid.sql')
    expect(appliedVersions).not.toContain('002_fail.sql')

    // Verify rollback was triggered for the failed transaction
    expect(callLogs).toContain('TRANSACTION_ROLLBACK')

    // Verify lock is released even when migration fails
    const lockReleased = callLogs.some((log) => log.includes('pg_advisory_unlock'))
    expect(lockReleased).toBe(true)

    rmSync(scratchDir, { recursive: true, force: true })
  })
})
