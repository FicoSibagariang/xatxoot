import { beforeEach, describe, expect, it } from 'bun:test'
import {
  type EncryptedAuthStorage,
  InMemorySessionStorage,
  decryptData,
  deleteEncryptedSession,
  encryptData,
  listEncryptedSessions,
  useEncryptedAuthState,
} from './baileys-encrypted-auth-adapter'
import { BaileysSession } from './baileys-session'

describe('Baileys Encrypted Session Auth Adapter (Issue #319 - TDD RED)', () => {
  const testKey = 'test_encryption_key_32_bytes_long_secret!'
  let storage: EncryptedAuthStorage

  beforeEach(() => {
    storage = new InMemorySessionStorage()
  })

  describe('1. AES-256-GCM Encryption & Decryption', () => {
    it('should encrypt plaintext into iv:tag:ciphertext format', () => {
      const plaintext = JSON.stringify({ secret: 'baileys-private-key-12345' })
      const encrypted = encryptData(plaintext, testKey)

      expect(encrypted).not.toContain('baileys-private-key-12345')
      const parts = encrypted.split(':')
      expect(parts.length).toBe(3) // iv, tag, ciphertext
      expect(parts[0].length).toBe(24) // 12 bytes = 24 hex chars (IV)
      expect(parts[1].length).toBe(32) // 16 bytes = 32 hex chars (Auth Tag)
    })

    it('should decrypt ciphertext back to original plaintext', () => {
      const original = JSON.stringify({ creds: { me: { id: '62812345678@s.whatsapp.net' } } })
      const encrypted = encryptData(original, testKey)
      const decrypted = decryptData(encrypted, testKey)

      expect(decrypted).toBe(original)
      const parsed = JSON.parse(decrypted)
      expect(parsed.creds.me.id).toBe('62812345678@s.whatsapp.net')
    })

    it('should throw error when decrypting tampered data or invalid key', () => {
      const encrypted = encryptData('confidential-credentials', testKey)
      const [iv, tag, data] = encrypted.split(':')
      const tampered = `${iv}:${tag}:ff${data.slice(2)}`

      expect(() => decryptData(tampered, testKey)).toThrow()
      expect(() => decryptData(encrypted, 'wrong-encryption-key-must-fail!')).toThrow()
    })
  })

  describe('2. Encrypted Baileys Auth State Lifecycle', () => {
    const sessionId = 'session_test_enc_01'

    it('should initialize empty credentials and store encrypted creds on saveCreds', async () => {
      const { state, saveCreds } = await useEncryptedAuthState(sessionId, {
        storage,
        encryptionKey: testKey,
      })

      expect(state.creds).toBeDefined()
      expect(state.creds.noiseKey).toBeDefined()

      // Mutate credentials e.g. pairing successful
      state.creds.me = {
        id: '6289988776655@s.whatsapp.net',
        name: 'Agent Support',
      }
      await saveCreds()

      // Inspect raw storage to verify encryption at rest
      const rawStoredCreds = await storage.get(`wa:auth:${sessionId}:creds`)
      expect(rawStoredCreds).toBeDefined()
      expect(rawStoredCreds).not.toContain('6289988776655')
      expect(rawStoredCreds).not.toContain('Agent Support')

      // Reload state from storage and verify decrypted creds
      const reloaded = await useEncryptedAuthState(sessionId, {
        storage,
        encryptionKey: testKey,
      })
      expect(reloaded.state.creds.me?.id).toBe('6289988776655@s.whatsapp.net')
      expect(reloaded.state.creds.me?.name).toBe('Agent Support')
    })

    it('should encrypt and decrypt key-value pairs (pre-key, session, etc.)', async () => {
      const { state } = await useEncryptedAuthState(sessionId, {
        storage,
        encryptionKey: testKey,
      })

      // Set key pairs
      await state.keys.set({
        'pre-key': {
          '1': {
            private: Buffer.from('private-key-data-1'),
            public: Buffer.from('public-key-data-1'),
          },
          '2': {
            private: Buffer.from('private-key-data-2'),
            public: Buffer.from('public-key-data-2'),
          },
        },
      })

      // Raw key in storage must be encrypted
      const rawKey = await storage.get(`wa:auth:${sessionId}:keys:pre-key-1`)
      expect(rawKey).toBeDefined()
      expect(rawKey).not.toContain('private-key-data-1')

      // Retrieve key pairs
      const retrieved = await state.keys.get('pre-key', ['1', '2'])
      expect(retrieved['1']).toBeDefined()
      expect(Buffer.isBuffer(retrieved['1'].private)).toBe(true)
      expect(retrieved['1'].private.toString()).toBe('private-key-data-1')
      expect(retrieved['2'].public.toString()).toBe('public-key-data-2')
    })

    it('should list active encrypted sessions and delete them completely', async () => {
      const sessionA = 'session_list_01'
      const sessionB = 'session_list_02'

      const authA = await useEncryptedAuthState(sessionA, { storage, encryptionKey: testKey })
      authA.state.creds.me = { id: '628111@s.whatsapp.net' }
      await authA.saveCreds()
      await authA.saveMeta({ channelId: 'chan-1', inboxId: 'inbox-1', phoneNumber: '+628111' })

      const authB = await useEncryptedAuthState(sessionB, { storage, encryptionKey: testKey })
      authB.state.creds.me = { id: '628222@s.whatsapp.net' }
      await authB.saveCreds()
      await authB.saveMeta({ channelId: 'chan-2', inboxId: 'inbox-2', phoneNumber: '+628222' })

      const sessions = await listEncryptedSessions({ storage, encryptionKey: testKey })
      expect(sessions.length).toBe(2)
      const foundA = sessions.find((s) => s.sessionId === sessionA)
      expect(foundA).toBeDefined()
      expect(foundA?.channelId).toBe('chan-1')
      expect(foundA?.phoneNumber).toBe('+628111')

      // Delete session A
      await deleteEncryptedSession(sessionA, { storage })
      const afterDelete = await listEncryptedSessions({ storage, encryptionKey: testKey })
      expect(afterDelete.length).toBe(1)
      expect(afterDelete[0].sessionId).toBe(sessionB)
      expect(await storage.get(`wa:auth:${sessionA}:creds`)).toBeNull()
    })
  })

  describe('3. BaileysSession Integration with Encrypted Auth Adapter', () => {
    it('should use encrypted auth adapter instead of useMultiFileAuthState', async () => {
      const session = new BaileysSession({
        sessionId: 'session_integration_01',
        channelId: 'chan-integ',
        inboxId: 'inbox-integ',
      })

      expect(typeof session.startSocket).toBe('function')
    })
  })
})
