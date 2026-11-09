import {
  type AuthenticationCreds,
  type AuthenticationState,
  BufferJSON,
  initAuthCreds,
  proto,
} from '@whiskeysockets/baileys'
import Redis from 'ioredis'
import { decryptData, encryptData, getDefaultEncryptionKey } from './session-crypto'

export { decryptData, encryptData }

export interface EncryptedAuthStorage {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string) => Promise<unknown>
  del: (key: string | string[]) => Promise<number | unknown>
  sadd?: (key: string, member: string) => Promise<number | unknown>
  srem?: (key: string, member: string) => Promise<number | unknown>
  smembers?: (key: string) => Promise<string[]>
  keys?: (pattern: string) => Promise<string[]>
}

export class InMemorySessionStorage implements EncryptedAuthStorage {
  private map = new Map<string, string>()
  private sets = new Map<string, Set<string>>()

  async get(key: string): Promise<string | null> {
    return this.map.get(key) ?? null
  }

  async set(key: string, value: string): Promise<void> {
    this.map.set(key, value)
  }

  async del(key: string | string[]): Promise<number> {
    const keys = Array.isArray(key) ? key : [key]
    let count = 0
    for (const k of keys) {
      if (this.map.delete(k)) count++
    }
    return count
  }

  async sadd(key: string, member: string): Promise<number> {
    let s = this.sets.get(key)
    if (!s) {
      s = new Set()
      this.sets.set(key, s)
    }
    const had = s.has(member)
    s.add(member)
    return had ? 0 : 1
  }

  async srem(key: string, member: string): Promise<number> {
    const s = this.sets.get(key)
    if (!s) return 0
    return s.delete(member) ? 1 : 0
  }

  async smembers(key: string): Promise<string[]> {
    const s = this.sets.get(key)
    return s ? Array.from(s) : []
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`)
    const matched: string[] = []
    for (const k of this.map.keys()) {
      if (regex.test(k)) matched.push(k)
    }
    return matched
  }

  clear(): void {
    this.map.clear()
    this.sets.clear()
  }
}

export class RedisSessionStorage implements EncryptedAuthStorage {
  private redis: Redis

  constructor(redisUrl?: string, client?: Redis) {
    if (client) {
      this.redis = client
    } else {
      const url = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379'
      this.redis = new Redis(url, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
      })
      this.redis.on('error', (err) => {
        console.warn('[RedisSessionStorage] Redis connection error:', (err as Error).message)
      })
    }
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key)
  }

  async set(key: string, value: string): Promise<unknown> {
    return this.redis.set(key, value)
  }

  async del(key: string | string[]): Promise<number> {
    const keys = Array.isArray(key) ? key : [key]
    if (keys.length === 0) return 0
    return this.redis.del(...keys)
  }

  async sadd(key: string, member: string): Promise<number> {
    return this.redis.sadd(key, member)
  }

  async srem(key: string, member: string): Promise<number> {
    return this.redis.srem(key, member)
  }

  async smembers(key: string): Promise<string[]> {
    return this.redis.smembers(key)
  }

  async keys(pattern: string): Promise<string[]> {
    return this.redis.keys(pattern)
  }
}

let defaultStorage: EncryptedAuthStorage | null = null

export function getDefaultStorage(): EncryptedAuthStorage {
  if (defaultStorage) return defaultStorage

  const isTest =
    typeof process !== 'undefined' &&
    (process.env.NODE_ENV === 'test' ||
      process.env.BUN_ENV === 'test' ||
      Boolean(process.env.BUN_TEST) ||
      (Array.isArray(process.argv) &&
        process.argv.some((a) => typeof a === 'string' && a.includes('test'))))

  if (isTest) {
    defaultStorage = new InMemorySessionStorage()
  } else {
    try {
      defaultStorage = new RedisSessionStorage()
    } catch {
      defaultStorage = new InMemorySessionStorage()
    }
  }

  return defaultStorage
}

export interface SessionMetadata {
  sessionId: string
  channelId?: string
  inboxId?: string
  phoneNumber?: string | null
  updatedAt?: string
}

export interface AuthAdapterOptions {
  storage?: EncryptedAuthStorage
  encryptionKey?: string
}

export interface EncryptedAuthStateResult {
  state: AuthenticationState
  saveCreds: () => Promise<void>
  saveMeta: (meta: Partial<SessionMetadata>) => Promise<void>
  getMeta: () => Promise<SessionMetadata | null>
  clearSession: () => Promise<void>
}

const REDIS_SESSIONS_SET = 'wa:auth:sessions'

export async function useEncryptedAuthState(
  sessionId: string,
  options?: AuthAdapterOptions,
): Promise<EncryptedAuthStateResult> {
  const storage = options?.storage || getDefaultStorage()
  const encryptionKey = options?.encryptionKey || getDefaultEncryptionKey()

  const credsKey = `wa:auth:${sessionId}:creds`
  const metaKey = `wa:auth:${sessionId}:meta`
  const keyPrefix = `wa:auth:${sessionId}:keys:`

  // Helper untuk enkripsi & penyimpanan data
  const writeEncrypted = async (key: string, data: unknown): Promise<void> => {
    const serialized = JSON.stringify(data, BufferJSON.replacer)
    const encrypted = encryptData(serialized, encryptionKey)
    await storage.set(key, encrypted)
  }

  // Helper untuk membaca & dekripsi data
  const readEncrypted = async <T>(key: string): Promise<T | null> => {
    try {
      const raw = await storage.get(key)
      if (!raw) return null
      const decrypted = decryptData(raw, encryptionKey)
      return JSON.parse(decrypted, BufferJSON.reviver) as T
    } catch (err) {
      console.warn(`[EncryptedAuthAdapter] Error reading key ${key}:`, (err as Error).message)
      return null
    }
  }

  // Helper untuk menghapus data
  const removeData = async (key: string): Promise<void> => {
    await storage.del(key)
  }

  // 1. Muat atau inisialisasi credentials
  const loadedCreds = await readEncrypted<AuthenticationCreds>(credsKey)
  const creds: AuthenticationCreds = loadedCreds || initAuthCreds()

  // 2. Fungsi simpan credentials
  const saveCreds = async (): Promise<void> => {
    await writeEncrypted(credsKey, creds)
    if (storage.sadd) {
      await storage.sadd(REDIS_SESSIONS_SET, sessionId)
    }
  }

  // 3. Simpan & ambil metadata sesi
  const saveMeta = async (meta: Partial<SessionMetadata>): Promise<void> => {
    const existing = (await readEncrypted<SessionMetadata>(metaKey)) || { sessionId }
    const merged: SessionMetadata = {
      ...existing,
      ...meta,
      sessionId,
      updatedAt: new Date().toISOString(),
    }
    await writeEncrypted(metaKey, merged)
    if (storage.sadd) {
      await storage.sadd(REDIS_SESSIONS_SET, sessionId)
    }
  }

  const getMeta = async (): Promise<SessionMetadata | null> => {
    return readEncrypted<SessionMetadata>(metaKey)
  }

  // 4. Hapus seluruh data sesi
  const clearSession = async (): Promise<void> => {
    await deleteEncryptedSession(sessionId, { storage, encryptionKey })
  }

  return {
    state: {
      creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const result: Record<string, unknown> = {}
          await Promise.all(
            ids.map(async (id) => {
              const fullKey = `${keyPrefix}${type}-${id}`
              let value = await readEncrypted<unknown>(fullKey)
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value)
              }
              result[id] = value
            }),
          )
          return result
        },
        set: async (data: Record<string, Record<string, unknown>>) => {
          const tasks: Promise<unknown>[] = []
          for (const category of Object.keys(data)) {
            for (const id of Object.keys(data[category])) {
              const value = data[category][id]
              const fullKey = `${keyPrefix}${category}-${id}`
              if (value) {
                tasks.push(writeEncrypted(fullKey, value))
              } else {
                tasks.push(removeData(fullKey))
              }
            }
          }
          await Promise.all(tasks)
        },
      },
    },
    saveCreds,
    saveMeta,
    getMeta,
    clearSession,
  }
}

export async function listEncryptedSessions(
  options?: AuthAdapterOptions,
): Promise<SessionMetadata[]> {
  const storage = options?.storage || getDefaultStorage()
  const encryptionKey = options?.encryptionKey || getDefaultEncryptionKey()

  let sessionIds: string[] = []
  if (storage.smembers) {
    sessionIds = await storage.smembers(REDIS_SESSIONS_SET)
  }

  if (sessionIds.length === 0 && storage.keys) {
    const credKeys = await storage.keys('wa:auth:*:creds')
    sessionIds = credKeys
      .map((k) => k.replace(/^wa:auth:/, '').replace(/:creds$/, ''))
      .filter(Boolean)
  }

  const results: SessionMetadata[] = []
  for (const sId of sessionIds) {
    try {
      const metaRaw = await storage.get(`wa:auth:${sId}:meta`)
      if (metaRaw) {
        const decrypted = decryptData(metaRaw, encryptionKey)
        const meta = JSON.parse(decrypted, BufferJSON.reviver) as SessionMetadata
        results.push(meta)
      } else {
        results.push({ sessionId: sId })
      }
    } catch {
      results.push({ sessionId: sId })
    }
  }

  return results
}

export async function deleteEncryptedSession(
  sessionId: string,
  options?: AuthAdapterOptions,
): Promise<void> {
  const storage = options?.storage || getDefaultStorage()
  const credsKey = `wa:auth:${sessionId}:creds`
  const metaKey = `wa:auth:${sessionId}:meta`

  if (storage.srem) {
    await storage.srem(REDIS_SESSIONS_SET, sessionId)
  }

  await storage.del(credsKey)
  await storage.del(metaKey)

  if (storage.keys) {
    const keyPattern = `wa:auth:${sessionId}:keys:*`
    const matchingKeys = await storage.keys(keyPattern)
    if (matchingKeys.length > 0) {
      await storage.del(matchingKeys)
    }
  }
}
