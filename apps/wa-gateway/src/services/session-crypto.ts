import crypto from 'node:crypto'

export function deriveKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest()
}

export function getDefaultEncryptionKey(): string {
  return (
    process.env.WA_SESSION_ENCRYPTION_KEY ||
    process.env.ENCRYPTION_KEY ||
    'xatxoot_default_session_encryption_key_32_bytes_super_secure!'
  )
}

/**
 * Mengenkripsi plaintext menggunakan AES-256-GCM.
 * Output format: iv(hex):tag(hex):ciphertext(hex)
 */
export function encryptData(plaintext: string, secretKey?: string): string {
  const secret = secretKey || getDefaultEncryptionKey()
  const key = deriveKey(secret)
  const iv = crypto.randomBytes(12) // 96-bit IV recommended for GCM

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Mendekripsi payload iv:tag:ciphertext menggunakan AES-256-GCM.
 */
export function decryptData(ciphertextPayload: string, secretKey?: string): string {
  const secret = secretKey || getDefaultEncryptionKey()
  const key = deriveKey(secret)

  const parts = ciphertextPayload.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted ciphertext format. Expected iv:tag:ciphertext')
  }

  const [ivHex, tagHex, dataHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const data = Buffer.from(dataHex, 'hex')

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return decrypted.toString('utf8')
}
