import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Deployment & Administrator Guide Verification (Issue #263)', () => {
  const rootDir = join(import.meta.dir, '..')
  const deploymentGuidePath = join(rootDir, 'docs', 'DEPLOYMENT.md')
  const envProdExamplePath = join(rootDir, '.env.production.example')

  describe('1. File Existence & Structure', () => {
    it('should verify docs/DEPLOYMENT.md exists', () => {
      expect(existsSync(deploymentGuidePath)).toBe(true)
    })

    it('should verify .env.production.example exists', () => {
      expect(existsSync(envProdExamplePath)).toBe(true)
    })
  })

  describe('2. System Requirements & Prerequisites Coverage', () => {
    it('should document hardware specs, Docker requirements, and port bindings', () => {
      const content = readFileSync(deploymentGuidePath, 'utf-8')

      // Specs
      expect(content).toMatch(/vCPU/i)
      expect(content).toMatch(/RAM/i)
      expect(content).toMatch(/SSD/i)

      // Prerequisites
      expect(content).toContain('Docker')
      expect(content).toMatch(/Docker Compose/i)

      // Network ports
      expect(content).toContain('80')
      expect(content).toContain('443')
    })
  })

  describe('3. Docker Compose Orchestration & Service Components', () => {
    it('should document all 6 production services in container architecture', () => {
      const content = readFileSync(deploymentGuidePath, 'utf-8')

      expect(content).toContain('`api`')
      expect(content).toContain('`web`')
      expect(content).toContain('`wa-gateway`')
      expect(content).toContain('`postgres`')
      expect(content).toContain('`redis`')
      expect(content).toContain('`caddy`')

      // Features
      expect(content).toContain('pgvector')
      expect(content).toMatch(/Let's Encrypt|SSL|TLS/i)
      expect(content).toContain('docker compose up -d')
    })
  })

  describe('4. Environment Configuration Reference (.env.production.example)', () => {
    it('should contain comprehensive production variables in .env.production.example', () => {
      const envContent = readFileSync(envProdExamplePath, 'utf-8')

      // Core connections
      expect(envContent).toMatch(/^DATABASE_URL=/m)
      expect(envContent).toMatch(/^REDIS_URL=/m)
      expect(envContent).toMatch(/^JWT_SECRET=/m)
      expect(envContent).toMatch(/^REFRESH_TOKEN_SECRET=/m)

      // WhatsApp Cloud API & Unofficial Gateway
      expect(envContent).toMatch(/^WHATSAPP_CLOUD_/m)
      expect(envContent).toMatch(/^WA_GATEWAY_/m)

      // Authentication & SSO
      expect(envContent).toMatch(/^GOOGLE_CLIENT_ID=/m)
      expect(envContent).toMatch(/^GOOGLE_CLIENT_SECRET=/m)
      expect(envContent).toMatch(/^GOOGLE_ALLOWED_DOMAINS=/m)

      // AI Copilot BYO-Key
      expect(envContent).toMatch(/^OPENAI_API_KEY=/m)

      // Omnichannel services (SMTP, Telegram, Twilio, Meta)
      expect(envContent).toMatch(/^SMTP_HOST=/m)
      expect(envContent).toMatch(/^TELEGRAM_BOT_TOKEN=/m)
      expect(envContent).toMatch(/^TWILIO_ACCOUNT_SID=/m)
    })

    it('should document all environment variable categories in DEPLOYMENT.md', () => {
      const content = readFileSync(deploymentGuidePath, 'utf-8')

      expect(content).toContain('DATABASE_URL')
      expect(content).toContain('REDIS_URL')
      expect(content).toContain('JWT_SECRET')
      expect(content).toContain('GOOGLE_CLIENT_ID')
      expect(content).toContain('OPENAI_API_KEY')
      expect(content).toContain('SMTP_HOST')
    })
  })

  describe('5. Administrator Setup, Onboarding & Channel Configuration', () => {
    it('should document setup wizard and single organization profile', () => {
      const content = readFileSync(deploymentGuidePath, 'utf-8')

      expect(content).toContain('/setup')
      expect(content).toMatch(/Single Organization|Organisasi/i)
      expect(content).toMatch(/Owner|Super Admin/i)
    })

    it('should cover all supported omnichannel inboxes', () => {
      const content = readFileSync(deploymentGuidePath, 'utf-8')

      expect(content).toMatch(/WhatsApp Cloud API|WABA/i)
      expect(content).toMatch(/Baileys|QR Code/i)
      expect(content).toMatch(/Live Chat|Widget/i)
      expect(content).toMatch(/Email|SMTP|IMAP/i)
      expect(content).toMatch(/Telegram/i)
      expect(content).toMatch(/Facebook Messenger|Instagram/i)
      expect(content).toMatch(/SMS|Twilio/i)
    })
  })

  describe('6. Operations, Maintenance, Backup & Disaster Recovery', () => {
    it('should provide actionable backup and restore commands', () => {
      const content = readFileSync(deploymentGuidePath, 'utf-8')

      expect(content).toContain('pg_dump')
      expect(content).toMatch(/psql|pg_restore/i)
    })

    it('should document migration, logs, healthchecks, and upgrade procedures', () => {
      const content = readFileSync(deploymentGuidePath, 'utf-8')

      expect(content).toContain('docker compose logs')
      expect(content).toMatch(/\/healthz|\/api\/healthz/i)
      expect(content).toMatch(/git pull|upgrade|update/i)
    })
  })

  describe('7. Single Organization Architectural Guardrail', () => {
    it('should strictly NOT contain account_id or accountId in docs or production env', () => {
      const docContent = readFileSync(deploymentGuidePath, 'utf-8')
      const envContent = readFileSync(envProdExamplePath, 'utf-8')

      // Case insensitive check for account_id / accountId
      expect(docContent.toLowerCase()).not.toContain('account_id')
      expect(docContent).not.toContain('accountId')
      expect(envContent.toLowerCase()).not.toContain('account_id')
      expect(envContent).not.toContain('accountId')
    })
  })
})
