import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { SQL } from 'bun'
import { db as defaultDb } from './index'

export const DEFAULT_MIGRATIONS_DIR = join(import.meta.dir, '..', '..', 'migrations')

export interface MigrationRunnerOptions {
  db?: SQL
  migrationsDir?: string
}

export async function runMigrations(options: MigrationRunnerOptions = {}): Promise<string[]> {
  const sql = options.db || defaultDb
  const dir = options.migrationsDir || DEFAULT_MIGRATIONS_DIR

  if (!existsSync(dir)) {
    return []
  }

  // Ensure schema_migrations table exists
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `

  // Get already applied migrations
  const rows = await sql`SELECT version FROM schema_migrations;`
  const appliedSet = new Set<string>(rows.map((r: { version: string }) => r.version))

  // Read and sort SQL migration files
  const files = readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

  const newlyApplied: string[] = []

  for (const file of files) {
    if (appliedSet.has(file)) {
      continue
    }

    const filePath = join(dir, file)

    if (typeof sql.file === 'function') {
      await sql.file(filePath)
    } else {
      const content = await Bun.file(filePath).text()
      if (typeof sql.unsafe === 'function') {
        await sql.unsafe(content)
      }
    }

    await sql`INSERT INTO schema_migrations (version) VALUES (${file});`
    newlyApplied.push(file)
  }

  return newlyApplied
}

if (import.meta.main) {
  runMigrations()
    .then((applied) => {
      console.log(`Migrations complete. Applied: ${applied.length}`)
      process.exit(0)
    })
    .catch((err) => {
      console.error('Migration failed:', err)
      process.exit(1)
    })
}
