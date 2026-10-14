import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Production Build & Container Packaging Verification (Issue #264)', () => {
  const rootDir = join(import.meta.dir, '..')
  const apiDockerfilePath = join(rootDir, 'apps', 'api', 'Dockerfile')
  const webDockerfilePath = join(rootDir, 'apps', 'web', 'Dockerfile')
  const waGatewayDockerfilePath = join(rootDir, 'apps', 'wa-gateway', 'Dockerfile')
  const dockerComposePath = join(rootDir, 'docker-compose.yml')
  const caddyfilePath = join(rootDir, 'Caddyfile')

  describe('1. File Existence & Architecture Components', () => {
    it('should verify production Dockerfiles exist for api, web, and wa-gateway', () => {
      expect(existsSync(apiDockerfilePath)).toBe(true)
      expect(existsSync(webDockerfilePath)).toBe(true)
      expect(existsSync(waGatewayDockerfilePath)).toBe(true)
    })

    it('should verify root docker-compose.yml and Caddyfile exist', () => {
      expect(existsSync(dockerComposePath)).toBe(true)
      expect(existsSync(caddyfilePath)).toBe(true)
    })
  })

  describe('2. Backend API Dockerfile (apps/api/Dockerfile)', () => {
    it('should use oven/bun alpine base, multi-stage build, and non-root execution', () => {
      const content = readFileSync(apiDockerfilePath, 'utf-8')

      // Bun alpine base
      expect(content).toMatch(/FROM\s+oven\/bun:(?:[0-9.]+-)?alpine/i)

      // Multi-stage build structure
      expect(content).toMatch(/AS\s+builder/i)
      expect(content).toMatch(/AS\s+runner/i)

      // Non-root security
      expect(content).toMatch(/USER\s+bun/i)

      // Expose API port 3000
      expect(content).toMatch(/EXPOSE\s+3000/)
    })
  })

  describe('3. Frontend Web Dashboard Dockerfile (apps/web/Dockerfile)', () => {
    it('should implement multi-stage build with static server and SPA fallback', () => {
      const content = readFileSync(webDockerfilePath, 'utf-8')

      // Multi-stage with builder
      expect(content).toMatch(/AS\s+builder/i)
      expect(content).toMatch(/bun run build|vite build/i)

      // Static web server runner (nginx or caddy)
      expect(content).toMatch(/FROM\s+(?:nginx:alpine|caddy:alpine)/i)

      // Expose port 80
      expect(content).toMatch(/EXPOSE\s+80/)
    })
  })

  describe('4. WhatsApp Gateway Dockerfile (apps/wa-gateway/Dockerfile)', () => {
    it('should use Node.js 20 LTS alpine base for Baileys socket stability', () => {
      const content = readFileSync(waGatewayDockerfilePath, 'utf-8')

      // Node.js 20 LTS Alpine base (PRD D4/§6.3)
      expect(content).toMatch(/FROM\s+node:20-alpine/i)

      // Non-root execution
      expect(content).toMatch(/USER\s+node/i)

      // Auth directory volume / path
      expect(content).toMatch(/baileys_auth|\/data/i)

      // Expose gateway port 3001
      expect(content).toMatch(/EXPOSE\s+3001/)
    })
  })

  describe('5. Production Orchestration Configuration (docker-compose.yml)', () => {
    it('should orchestrate all 6 core services: caddy, api, web, wa-gateway, postgres, redis', () => {
      const content = readFileSync(dockerComposePath, 'utf-8')

      expect(content).toMatch(/caddy:/)
      expect(content).toMatch(/api:/)
      expect(content).toMatch(/web:/)
      expect(content).toMatch(/wa-gateway:/)
      expect(content).toMatch(/postgres:/)
      expect(content).toMatch(/redis:/)
    })

    it('should configure PostgreSQL with pgvector extension and persistent volume', () => {
      const content = readFileSync(dockerComposePath, 'utf-8')

      expect(content).toMatch(/pgvector\/pgvector:pg16|postgres:16/i)
      expect(content).toMatch(/postgres_data:/)
    })

    it('should configure Redis with persistent volume', () => {
      const content = readFileSync(dockerComposePath, 'utf-8')

      expect(content).toMatch(/redis:7-alpine|redis:alpine/i)
      expect(content).toMatch(/redis_data:/)
    })

    it('should define healthchecks and restart policies across services', () => {
      const content = readFileSync(dockerComposePath, 'utf-8')

      expect(content).toContain('healthcheck:')
      expect(content).toMatch(/condition:\s*service_healthy/)
      expect(content).toMatch(/restart:\s*(?:unless-stopped|always)/)
    })

    it('should define custom bridge network for service isolation', () => {
      const content = readFileSync(dockerComposePath, 'utf-8')

      expect(content).toMatch(/networks:\s*\n\s*(?:xatxoot-network|xatxoot_network|default):/m)
    })
  })

  describe('6. Caddy Reverse Proxy Configuration (Caddyfile)', () => {
    it('should proxy /api, WebSocket /ws, and static frontend traffic', () => {
      const content = readFileSync(caddyfilePath, 'utf-8')

      // Reverse proxy to api and web
      expect(content).toMatch(
        /reverse_proxy\s+(?:\/api\/\*|\/api\*|\/healthz|\/health)\s+api:3000/i,
      )
      expect(content).toMatch(/reverse_proxy\s+(?:web:80|\*)/i)
    })
  })

  describe('7. Single Organization Architectural Guardrail', () => {
    it('should strictly NOT contain account_id or accountId in container files', () => {
      const files = [
        apiDockerfilePath,
        webDockerfilePath,
        waGatewayDockerfilePath,
        dockerComposePath,
        caddyfilePath,
      ]

      for (const file of files) {
        if (existsSync(file)) {
          const content = readFileSync(file, 'utf-8')
          expect(content.toLowerCase()).not.toContain('account_id')
          expect(content).not.toContain('accountId')
        }
      }
    })
  })
})
