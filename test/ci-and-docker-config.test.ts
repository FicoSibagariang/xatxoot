import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('CI/CD GitHub Actions Workflow & Production Docker Container Configuration (Issue #321 - TDD RED)', () => {
  const rootDir = resolve(import.meta.dir, '..')

  describe('1. GitHub Actions Workflow (.github/workflows/ci.yml)', () => {
    const workflowPath = resolve(rootDir, '.github/workflows/ci.yml')

    it('should have .github/workflows/ci.yml created and accessible', () => {
      expect(existsSync(workflowPath)).toBe(true)
    })

    it('should trigger on push to main and pull_request to main', () => {
      const content = readFileSync(workflowPath, 'utf-8')
      expect(content).toMatch(/push:\s+branches:\s+\[.*main.*\]/m)
      expect(content).toMatch(/pull_request:\s+branches:\s+\[.*main.*\]/m)
    })

    it('should include Biome check job or step (bun run check)', () => {
      const content = readFileSync(workflowPath, 'utf-8')
      expect(content).toContain('bun run check')
    })

    it('should include TypeScript type validation job or step (tsc --noEmit)', () => {
      const content = readFileSync(workflowPath, 'utf-8')
      expect(content).toContain('tsc --noEmit')
    })

    it('should include test job with PostgreSQL 16 and Redis 7 service containers', () => {
      const content = readFileSync(workflowPath, 'utf-8')
      expect(content).toMatch(/postgres:\s+image:\s+pgvector\/pgvector:pg16/m)
      expect(content).toMatch(/redis:\s+image:\s+redis:7-alpine/m)
      expect(content).toContain('bun test')
    })
  })

  describe('2. Production WhatsApp Gateway Dockerfile (AOT Compilation)', () => {
    const waDockerPath = resolve(rootDir, 'apps/wa-gateway/Dockerfile')

    it('should have builder stage that compiles TypeScript Ahead-of-Time (AOT)', () => {
      const content = readFileSync(waDockerPath, 'utf-8')
      expect(content).toMatch(/FROM .* AS builder/i)
      expect(content).toMatch(/bun build .*dist\/index\.js/m)
    })

    it('should execute pure compiled JavaScript in runner stage without npx tsx', () => {
      const content = readFileSync(waDockerPath, 'utf-8')
      expect(content).not.toContain('npx tsx')
      expect(content).toMatch(/CMD\s*\[\s*"node",\s*"(?:apps\/wa-gateway\/)?dist\/index\.js"\s*\]/)
    })
  })

  describe('3. Production Backend API Dockerfile & Migration Decoupling', () => {
    const apiDockerPath = resolve(rootDir, 'apps/api/Dockerfile')
    const composePath = resolve(rootDir, 'docker-compose.yml')

    it('should decouple db:migrate from API web server CMD in apps/api/Dockerfile', () => {
      const content = readFileSync(apiDockerPath, 'utf-8')
      expect(content).not.toContain('db:migrate &&')
      const cmdMatch = content.match(/CMD\s*(\[[^\]]+\])/)
      expect(cmdMatch).toBeTruthy()
      const cmdArr = JSON.parse(cmdMatch?.[1] || '[]')
      expect(cmdArr).toContain('src/index.ts')
      expect(cmdArr.join(' ')).not.toContain('db:migrate')
    })

    it('should have a dedicated api-migrate service in docker-compose.yml to avoid race conditions', () => {
      const content = readFileSync(composePath, 'utf-8')
      expect(content).toContain('api-migrate:')
      expect(content).toContain('db:migrate')
      expect(content).toMatch(/api-migrate:\s+condition:\s+service_completed_successfully/m)
    })
  })
})
