import { SQL } from 'bun'

export const DEFAULT_DATABASE_URL = 'postgresql://xatxoot:xatxoot_secret@localhost:5432/xatxoot_dev'

export function createDb(url?: string): SQL {
  const connectionUrl = url || process.env.DATABASE_URL || DEFAULT_DATABASE_URL
  return new SQL(connectionUrl)
}

export const db: SQL = createDb()
export const sql = db

export default db
