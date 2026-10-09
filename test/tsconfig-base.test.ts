import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Base TypeScript configuration (tsconfig.base.json)', () => {
  const tsconfigBasePath = join(import.meta.dir, '..', 'tsconfig.base.json')

  it('should exist at repository root', () => {
    expect(existsSync(tsconfigBasePath)).toBe(true)
  })

  it('should have valid shared compilerOptions', () => {
    const raw = readFileSync(tsconfigBasePath, 'utf-8')
    const config = JSON.parse(raw)

    expect(config.compilerOptions).toBeDefined()
    const opts = config.compilerOptions

    expect(opts.target).toBe('ESNext')
    expect(opts.module).toBe('ESNext')
    expect(opts.moduleResolution).toBe('bundler')
    expect(opts.strict).toBe(true)
    expect(opts.skipLibCheck).toBe(true)
    expect(opts.noEmit).toBe(true)

    expect(Array.isArray(opts.lib)).toBe(true)
    expect(opts.lib).toContain('ESNext')
    expect(opts.lib).toContain('DOM')
  })
})
