import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { envSchema, validateConfig } from './config'

describe('Centralized Configuration & Validation (apps/api/src/config.ts)', () => {
  it('should validate valid environment configuration successfully', () => {
    const validEnv = {
      DATABASE_URL: 'postgresql://xatxoot:secret@localhost:5432/xatxoot_test',
      REDIS_URL: 'redis://localhost:6379',
      PORT_API: '3000',
      PORT_GATEWAY: '3001',
      PORT_SIMULATOR: '3002',
      PORT_WEB: '5173',
      JWT_SECRET: 'super_secret_jwt_key_xatxoot_dev_only',
      REFRESH_TOKEN_SECRET: 'super_secret_refresh_key_xatxoot_dev_only',
      NODE_ENV: 'test',
    }

    const parsed = validateConfig(validEnv)
    expect(parsed.DATABASE_URL).toBe('postgresql://xatxoot:secret@localhost:5432/xatxoot_test')
    expect(parsed.PORT_API).toBe(3000)
    expect(parsed.PORT_GATEWAY).toBe(3001)
    expect(parsed.REDIS_URL).toBe('redis://localhost:6379')
    expect(parsed.JWT_SECRET).toBe('super_secret_jwt_key_xatxoot_dev_only')
    expect(parsed.NODE_ENV).toBe('test')
  })

  it('should apply sane default values for optional configurations', () => {
    const minimalEnv = {
      DATABASE_URL: 'postgresql://xatxoot:secret@localhost:5432/xatxoot_test',
      JWT_SECRET: 'some_jwt_secret',
    }

    const parsed = validateConfig(minimalEnv)
    expect(parsed.PORT_API).toBe(3000)
    expect(parsed.HOST).toBe('0.0.0.0')
    expect(parsed.REDIS_URL).toBe('redis://localhost:6379')
    expect(parsed.NODE_ENV).toBe('development')
    expect(parsed.GOOGLE_CALLBACK_URL).toBe('http://localhost:3000/api/v1/auth/google/callback')
  })

  it('should fail-fast and throw descriptive error when DATABASE_URL is missing or empty', () => {
    expect(() => {
      validateConfig({
        DATABASE_URL: '',
        JWT_SECRET: 'secret',
      })
    }).toThrow(/DATABASE_URL/)

    expect(() => {
      validateConfig({
        JWT_SECRET: 'secret',
      })
    }).toThrow(/DATABASE_URL/)
  })

  it('should fail-fast and throw descriptive error when JWT_SECRET is missing or empty', () => {
    expect(() => {
      validateConfig({
        DATABASE_URL: 'postgresql://localhost:5432/db',
        JWT_SECRET: '',
      })
    }).toThrow(/JWT_SECRET/)

    expect(() => {
      validateConfig({
        DATABASE_URL: 'postgresql://localhost:5432/db',
      })
    }).toThrow(/JWT_SECRET/)
  })

  it('should coerce port strings into integer numbers', () => {
    const parsed = validateConfig({
      DATABASE_URL: 'postgresql://localhost:5432/db',
      JWT_SECRET: 'secret',
      PORT_API: '4000',
    })
    expect(parsed.PORT_API).toBe(4000)
    expect(typeof parsed.PORT_API).toBe('number')
  })

  it('should ensure no manual readFileSync of .env file exists in apps/api/src/db/connection.ts', () => {
    const connectionFilePath = join(import.meta.dir, 'db', 'connection.ts')
    const fileContent = readFileSync(connectionFilePath, 'utf-8')

    expect(fileContent).not.toMatch(/readFileSync.*\.env/i)
    expect(fileContent).not.toMatch(/rootEnvPath/)
  })
})
