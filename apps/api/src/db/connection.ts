import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SQL } from 'bun'

export const DEFAULT_DATABASE_URL = 'postgresql://xatxoot:xatxoot_secret@localhost:5432/xatxoot_dev'

export function resolveDatabaseUrl(url?: string): string {
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
  if (url) return new SQL(url)
  if (process.env.TEST_DATABASE_URL) return new SQL(process.env.TEST_DATABASE_URL)

  const connectionUrl = resolveDatabaseUrl()
  return new SQL(connectionUrl)
}

export function toValidUuid(val?: string | null): string {
  if (!val) return crypto.randomUUID()
  const cleaned = val.replace(/[^0-9a-f-]/gi, '0')
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleaned)) {
    return cleaned
  }
  let hex = ''
  for (let i = 0; i < val.length; i++) {
    const code = val.charCodeAt(i)
    hex += (code % 16).toString(16)
  }
  while (hex.length < 32) {
    hex += '0'
  }
  hex = hex.slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

export function parseJsonField<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback
  if (typeof val === 'object') return val as T
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T
    } catch {
      return fallback
    }
  }
  return fallback
}

export function toIsoString(val: unknown): string | null {
  if (!val) return null
  if (val instanceof Date) return val.toISOString()
  if (typeof val === 'string') return val
  return null
}

export const db: SQL = createDb()
export const sql = db
