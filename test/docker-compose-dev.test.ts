import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Docker Compose Dev configuration (docker-compose.dev.yml)', () => {
  const composePath = join(import.meta.dir, '..', 'docker-compose.dev.yml')

  it('should exist at repository root', () => {
    expect(existsSync(composePath)).toBe(true)
  })

  it('should configure PostgreSQL 16 service with persistent volume', () => {
    const raw = readFileSync(composePath, 'utf-8')

    expect(raw).toContain('postgres:')
    expect(raw).toMatch(/image:\s*postgres:16/)
    expect(raw).toContain('5432:5432')
    expect(raw).toContain('POSTGRES_USER: xatxoot')
    expect(raw).toContain('POSTGRES_PASSWORD: xatxoot_secret')
    expect(raw).toContain('POSTGRES_DB: xatxoot_dev')
    expect(raw).toContain('postgres_data:')
  })

  it('should configure Redis 7 service with persistent volume', () => {
    const raw = readFileSync(composePath, 'utf-8')

    expect(raw).toContain('redis:')
    expect(raw).toMatch(/image:\s*redis:7/)
    expect(raw).toContain('6379:6379')
    expect(raw).toContain('redis_data:')
  })

  it('should declare top-level persistent volumes', () => {
    const raw = readFileSync(composePath, 'utf-8')

    expect(raw).toMatch(/^volumes:\s*$/m)
    expect(raw).toMatch(/^\s+postgres_data:\s*$/m)
    expect(raw).toMatch(/^\s+redis_data:\s*$/m)
  })
})
