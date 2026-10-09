import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Root package.json configuration', () => {
  const rootPkgPath = join(import.meta.dir, '..', 'package.json')

  it('should exist at repository root', () => {
    expect(existsSync(rootPkgPath)).toBe(true)
  })

  it('should have valid monorepo package.json configuration', () => {
    const raw = readFileSync(rootPkgPath, 'utf-8')
    const pkg = JSON.parse(raw)

    expect(pkg.name).toBe('xatxoot')
    expect(pkg.private).toBe(true)
    expect(Array.isArray(pkg.workspaces)).toBe(true)
    expect(pkg.workspaces).toContain('apps/*')
    expect(pkg.workspaces).toContain('packages/*')
  })

  it('should contain required global monorepo scripts', () => {
    const raw = readFileSync(rootPkgPath, 'utf-8')
    const pkg = JSON.parse(raw)

    expect(pkg.scripts).toBeDefined()
    expect(typeof pkg.scripts.dev).toBe('string')
    expect(typeof pkg.scripts.build).toBe('string')
    expect(typeof pkg.scripts.test).toBe('string')
    expect(typeof pkg.scripts.check).toBe('string')
    expect(typeof pkg.scripts.lint).toBe('string')

    expect(pkg.scripts.test).toContain('bun test')
    expect(pkg.scripts.check).toContain('biome')
  })
})
