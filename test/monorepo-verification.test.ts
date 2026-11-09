import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

describe('Monorepo Quality Gate Verification (Phase 0 Complete)', () => {
  const rootDir = join(import.meta.dir, '..')

  it('should verify all required workspace directories exist', () => {
    expect(existsSync(join(rootDir, 'apps', 'api'))).toBe(true)
    expect(existsSync(join(rootDir, 'apps', 'web'))).toBe(true)
    expect(existsSync(join(rootDir, 'packages', 'shared'))).toBe(true)
  })

  it('should verify root configuration and infrastructure files exist', () => {
    expect(existsSync(join(rootDir, 'package.json'))).toBe(true)
    expect(existsSync(join(rootDir, 'biome.json'))).toBe(true)
    expect(existsSync(join(rootDir, 'tsconfig.base.json'))).toBe(true)
    expect(existsSync(join(rootDir, 'docker-compose.dev.yml'))).toBe(true)
    expect(existsSync(join(rootDir, '.env.example'))).toBe(true)
  })

  it('should verify test directory contains all expected Phase 0 test suites', () => {
    const testDir = join(rootDir, 'test')
    const testFiles = readdirSync(testDir)

    expect(testFiles).toContain('root-package.test.ts')
    expect(testFiles).toContain('biome-config.test.ts')
    expect(testFiles).toContain('tsconfig-base.test.ts')
    expect(testFiles).toContain('docker-compose-dev.test.ts')
    expect(testFiles).toContain('env-example.test.ts')
    expect(testFiles).toContain('shared-package.test.ts')
    expect(testFiles).toContain('api-package.test.ts')
    expect(testFiles).toContain('db-connection.test.ts')
    expect(testFiles).toContain('web-package.test.ts')

    // Modularized test suites (Issue #313)
    const migrationFiles = readdirSync(join(rootDir, 'apps', 'api', 'migrations'))
    expect(migrationFiles).toContain('migration-runner.test.ts')
    expect(migrationFiles).toContain('init-migration.test.ts')

    const webPageFiles = readdirSync(join(rootDir, 'apps', 'web', 'src', 'pages'))
    expect(webPageFiles).toContain('setup-page.test.ts')
    expect(webPageFiles).toContain('login-page.test.ts')

    const webComponentFiles = readdirSync(join(rootDir, 'apps', 'web', 'src', 'components'))
    expect(webComponentFiles).toContain('layout-shell.test.ts')
  })
})
