import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

describe('Test Suites Restructuring & Granular Scripts (Issue #313 - TDD RED)', () => {
  const rootDir = join(import.meta.dir, '..')
  const testDir = join(rootDir, 'test')
  const rootPkgPath = join(rootDir, 'package.json')

  it('root package.json must contain granular test scripts: test:unit, test:integration, test:e2e', () => {
    const pkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'))
    expect(pkg.scripts).toBeDefined()
    expect(pkg.scripts['test:unit']).toBeDefined()
    expect(pkg.scripts['test:integration']).toBeDefined()
    expect(pkg.scripts['test:e2e']).toBeDefined()

    expect(typeof pkg.scripts['test:unit']).toBe('string')
    expect(typeof pkg.scripts['test:integration']).toBe('string')
    expect(typeof pkg.scripts['test:e2e']).toBe('string')
  })

  it('root test/ directory must NOT contain SQL migration test files', () => {
    const files = readdirSync(testDir)
    const migrationTests = files.filter(
      (f) => f.includes('migration') || f === 'tickets-display-id-sequence-migration.test.ts',
    )
    expect(migrationTests).toHaveLength(0)
  })

  it('apps/api/migrations/ must house the SQL migration tests', () => {
    const migrationsDir = join(rootDir, 'apps', 'api', 'migrations')
    const files = readdirSync(migrationsDir)
    const migrationTests = files.filter((f) => f.endsWith('.test.ts'))
    expect(migrationTests.length).toBeGreaterThan(10)
  })

  it('root test/ directory must NOT contain wa-gateway test files', () => {
    const files = readdirSync(testDir)
    const gatewayTests = files.filter((f) => f.startsWith('wa-gateway-'))
    expect(gatewayTests).toHaveLength(0)
  })

  it('apps/wa-gateway/src/ must house the gateway tests', () => {
    const gatewaySrcDir = join(rootDir, 'apps', 'wa-gateway', 'src')
    const files = readdirSync(gatewaySrcDir)
    const gatewayTests = files.filter((f) => f.includes('gateway') && f.endsWith('.test.ts'))
    expect(gatewayTests.length).toBeGreaterThan(0)
  })

  it('root test/ directory must NOT contain wa-simulator test files', () => {
    const files = readdirSync(testDir)
    const simulatorTests = files.filter((f) => f.startsWith('wa-simulator-'))
    expect(simulatorTests).toHaveLength(0)
  })

  it('apps/wa-simulator/src/ must house the simulator tests', () => {
    const simulatorSrcDir = join(rootDir, 'apps', 'wa-simulator', 'src')
    const files = readdirSync(simulatorSrcDir)
    const simulatorTests = files.filter((f) => f.includes('simulator') && f.endsWith('.test.ts'))
    expect(simulatorTests.length).toBeGreaterThan(0)
  })

  it('root test/ directory must NOT contain specific web page/component tests (layout-shell, login-page, setup-page)', () => {
    const files = readdirSync(testDir)
    expect(files).not.toContain('layout-shell.test.ts')
    expect(files).not.toContain('login-page.test.ts')
    expect(files).not.toContain('setup-page.test.ts')
  })

  it('root test/ directory must NOT contain package-level schema tests', () => {
    const files = readdirSync(testDir)
    expect(files).not.toContain('contact-schemas.test.ts')
    expect(files).not.toContain('inbox-channel-schemas.test.ts')
    expect(files).not.toContain('message-ticket-schemas.test.ts')
  })

  it('root test/ directory must remain clean and only contain monorepo infrastructure and E2E smoke tests', () => {
    const files = readdirSync(testDir).filter((f) => f.endsWith('.ts'))
    // Root test folder should have at most 20 infrastructure and e2e test files
    expect(files.length).toBeLessThanOrEqual(20)
    expect(files).toContain('e2e-smoke-flow.test.ts')
    expect(files).toContain('monorepo-verification.test.ts')
  })
})
