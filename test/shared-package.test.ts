import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Shared package initialization (packages/shared)', () => {
  const sharedDir = join(import.meta.dir, '..', 'packages', 'shared')
  const pkgPath = join(sharedDir, 'package.json')
  const tsconfigPath = join(sharedDir, 'tsconfig.json')
  const indexPath = join(sharedDir, 'src', 'index.ts')

  it('should have package.json in packages/shared', () => {
    expect(existsSync(pkgPath)).toBe(true)

    const raw = readFileSync(pkgPath, 'utf-8')
    const pkg = JSON.parse(raw)

    expect(pkg.name).toBe('@xatxoot/shared')
    expect(pkg.type).toBe('module')
  })

  it('should have tsconfig.json extending tsconfig.base.json', () => {
    expect(existsSync(tsconfigPath)).toBe(true)

    const raw = readFileSync(tsconfigPath, 'utf-8')
    const tsconfig = JSON.parse(raw)

    expect(tsconfig.extends).toBe('../../tsconfig.base.json')
  })

  it('should have src/index.ts entrypoint', () => {
    expect(existsSync(indexPath)).toBe(true)
  })
})
