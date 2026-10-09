import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('API App Initialization (apps/api)', () => {
  const apiDir = join(import.meta.dir, '..', 'apps', 'api')
  const pkgPath = join(apiDir, 'package.json')
  const tsconfigPath = join(apiDir, 'tsconfig.json')
  const indexPath = join(apiDir, 'src', 'index.ts')

  it('should have package.json in apps/api with required dependencies and scripts', () => {
    expect(existsSync(pkgPath)).toBe(true)

    const raw = readFileSync(pkgPath, 'utf-8')
    const pkg = JSON.parse(raw)

    expect(pkg.name).toBe('@xatxoot/api')
    expect(pkg.type).toBe('module')

    expect(pkg.scripts).toBeDefined()
    expect(pkg.scripts.test).toBeDefined()
    expect(pkg.scripts.dev).toBeDefined()

    expect(pkg.dependencies).toBeDefined()
    expect(pkg.dependencies.hono).toBeDefined()
    expect(pkg.dependencies['@hono/node-server']).toBeDefined()
    expect(pkg.dependencies.zod).toBeDefined()
    expect(pkg.dependencies['@xatxoot/shared']).toBeDefined()
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

  it('should export a working Hono app with /health route', async () => {
    const { default: app } = await import('../apps/api/src/index')
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('ok')
  })
})
