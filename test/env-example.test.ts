import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Master .env.example configuration', () => {
  const envExamplePath = join(import.meta.dir, '..', '.env.example')

  it('should exist at repository root', () => {
    expect(existsSync(envExamplePath)).toBe(true)
  })

  it('should document Database and Redis environment variables', () => {
    const raw = readFileSync(envExamplePath, 'utf-8')

    expect(raw).toMatch(/^DATABASE_URL=/m)
    expect(raw).toMatch(/^REDIS_URL=/m)
  })

  it('should document service port variables', () => {
    const raw = readFileSync(envExamplePath, 'utf-8')

    expect(raw).toMatch(/^PORT_API=/m)
    expect(raw).toMatch(/^PORT_GATEWAY=/m)
    expect(raw).toMatch(/^PORT_SIMULATOR=/m)
    expect(raw).toMatch(/^PORT_WEB=/m)
  })

  it('should document Authentication and Google SSO variables', () => {
    const raw = readFileSync(envExamplePath, 'utf-8')

    expect(raw).toMatch(/^JWT_SECRET=/m)
    expect(raw).toMatch(/^REFRESH_TOKEN_SECRET=/m)
    expect(raw).toMatch(/^GOOGLE_CLIENT_ID=/m)
    expect(raw).toMatch(/^GOOGLE_CLIENT_SECRET=/m)
    expect(raw).toMatch(/^GOOGLE_CALLBACK_URL=/m)
    expect(raw).toMatch(/^GOOGLE_ALLOWED_DOMAINS=/m)
  })

  it('should document WhatsApp Cloud API variables', () => {
    const raw = readFileSync(envExamplePath, 'utf-8')

    expect(raw).toMatch(/^WHATSAPP_CLOUD_API_URL=/m)
    expect(raw).toMatch(/^WHATSAPP_CLOUD_ACCESS_TOKEN=/m)
    expect(raw).toMatch(/^WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN=/m)
  })
})
