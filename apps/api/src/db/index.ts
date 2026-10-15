import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SQL } from 'bun'

export const DEFAULT_DATABASE_URL = 'postgresql://xatxoot:xatxoot_secret@localhost:5432/xatxoot_dev'

function resolveDatabaseUrl(url?: string): string {
  if (url) return url
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL

  const rootEnvPath = join(import.meta.dir, '..', '..', '..', '..', '.env')
  if (existsSync(rootEnvPath)) {
    try {
      const content = readFileSync(rootEnvPath, 'utf-8')
      const match = content.match(/^DATABASE_URL=(.+)$/m)
      if (match?.[1]) {
        return match[1].trim().replace(/^["']|["']$/g, '')
      }
    } catch {
      // ignore
    }
  }

  return DEFAULT_DATABASE_URL
}

export function createDb(url?: string): SQL {
  const isTestRunner =
    typeof (globalThis as unknown as { describe?: unknown }).describe === 'function' ||
    process.env.NODE_ENV === 'test'

  if (isTestRunner && !process.env.TEST_DATABASE_URL) {
    return new SQL(DEFAULT_DATABASE_URL)
  }

  const connectionUrl = resolveDatabaseUrl(url)
  return new SQL(connectionUrl)
}

export const db: SQL = createDb()
export const sql = db

export default db
