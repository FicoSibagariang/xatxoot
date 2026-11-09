import { describe, expect, it } from 'bun:test'
import { sql } from './db'
import app from './index'
import {
  auditTicketBulkAssign,
  auditUserRoleChange,
  auditWebhookDelete,
  listAuditLogs,
} from './modules/audit/audit.service'
import { resetRateLimiter } from './modules/auth/auth.middleware'
import { ticketService } from './modules/tickets/tickets.service'
import { usersService } from './modules/users/users.service'

describe('Security Middlewares & Audit Trail (Issue #316 - TDD RED)', () => {
  describe('1. CORS Middleware', () => {
    it('should allow requests from whitelisted origin with proper CORS headers', async () => {
      const res = await app.request('/health', {
        method: 'GET',
        headers: {
          Origin: 'http://localhost:5173',
        },
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
      expect(res.headers.get('access-control-allow-credentials')).toBe('true')
    })

    it('should reject or not allow unlisted/malicious origin', async () => {
      const res = await app.request('/health', {
        method: 'GET',
        headers: {
          Origin: 'http://malicious-attacker.com',
        },
      })

      expect(res.headers.get('access-control-allow-origin')).not.toBe(
        'http://malicious-attacker.com',
      )
    })
  })

  describe('2. Secure Headers Middleware', () => {
    it('should inject standard security headers on API responses', async () => {
      const res = await app.request('/health', {
        method: 'GET',
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('x-content-type-options')).toBe('nosniff')
      expect(res.headers.get('x-frame-options')).toMatch(/SAMEORIGIN|DENY/)
      expect(res.headers.get('strict-transport-security')).toContain('max-age=')
      expect(res.headers.get('content-security-policy')).toBeDefined()
    })
  })

  describe('3. Rate Limiter on Sensitive Public Endpoints', () => {
    it('should return 429 Too Many Requests when login attempts exceed rate limit', async () => {
      resetRateLimiter?.()

      const clientIp = '192.168.1.100'

      // Simulate 5 rapid failed login attempts
      for (let i = 0; i < 5; i++) {
        const res = await app.request('/api/v1/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': clientIp,
          },
          body: JSON.stringify({
            email: 'nonexistent@xatxoot.test',
            password: 'wrong_password',
          }),
        })
        expect(res.status).toBe(401)
      }

      // The 6th attempt must be rejected with 429 Too Many Requests
      const blockedRes = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': clientIp,
        },
        body: JSON.stringify({
          email: 'nonexistent@xatxoot.test',
          password: 'wrong_password',
        }),
      })

      expect(blockedRes.status).toBe(429)
      const data = await blockedRes.json()
      expect(data.error).toBe('Too Many Requests')
      expect(blockedRes.headers.get('retry-after')).toBeDefined()
    })
  })

  describe('4. Administrative Audit Trail Logging', () => {
    it('should record user.role_change in audit_logs when a user role is changed', async () => {
      // Create user
      const user = await usersService.createUser({
        email: `audit.user.${Date.now()}@xatxoot.test`,
        password: 'Password123!',
        displayName: 'Audit User',
        role: 'agent',
      })

      // Update role to admin
      await usersService.updateUser(user.id, {
        role: 'admin',
      })

      const logs = await listAuditLogs({
        action: 'user.role_change',
        auditableId: user.id,
      })

      expect(logs.length).toBeGreaterThanOrEqual(1)
      const targetLog = logs[0]
      expect(targetLog.action).toBe('user.role_change')
      expect(targetLog.auditableType).toBe('users')
      expect(targetLog.auditableId).toBe(user.id)
      expect(targetLog.changes).toBeDefined()
    })

    it('should record webhook.delete in audit_logs when an outgoing webhook is deleted', async () => {
      const webhookId = crypto.randomUUID()
      await sql`
        INSERT INTO outgoing_webhooks (id, url, subscriptions, secret, active, created_at, updated_at)
        VALUES (${webhookId}, 'https://example.com/webhook', ARRAY['ticket.created'], 'secret123', true, NOW(), NOW())
      `

      await auditWebhookDelete(null, webhookId, { url: 'https://example.com/webhook' })

      const logs = await listAuditLogs({
        action: 'webhook.delete',
        auditableId: webhookId,
      })

      expect(logs.length).toBeGreaterThanOrEqual(1)
      expect(logs[0].action).toBe('webhook.delete')
      expect(logs[0].auditableType).toBe('outgoing_webhooks')
    })

    it('should record ticket.bulk_assign in audit_logs when bulk assigning tickets', async () => {
      expect(typeof ticketService.bulkAssignTickets).toBe('function')

      // Create dummy agent and ticket
      const agent = await usersService.createUser({
        email: `bulk.agent.${Date.now()}@xatxoot.test`,
        password: 'Password123!',
        displayName: 'Bulk Agent',
        role: 'agent',
      })

      const ticketId = crypto.randomUUID()
      const convId = crypto.randomUUID()
      const inboxId = crypto.randomUUID()
      const contactId = crypto.randomUUID()
      await sql`
        INSERT INTO inboxes (id, name, channel_type, channel_id)
        VALUES (${inboxId}, 'Bulk Inbox', 'api', ${crypto.randomUUID()})
      `
      await sql`
        INSERT INTO contacts (id, name, identifier)
        VALUES (${contactId}, 'Bulk Contact', 'ident_bulk')
      `
      await sql`
        INSERT INTO conversations (id, inbox_id, contact_id)
        VALUES (${convId}, ${inboxId}, ${contactId})
      `
      await sql`
        INSERT INTO tickets (id, conversation_id, status)
        VALUES (${ticketId}, ${convId}, 'open')
      `

      await ticketService.bulkAssignTickets([ticketId], agent.id, null)

      const logs = await listAuditLogs({
        action: 'ticket.bulk_assign',
      })

      expect(logs.length).toBeGreaterThanOrEqual(1)
      expect(logs[0].action).toBe('ticket.bulk_assign')
      expect(logs[0].auditableType).toBe('tickets')
    })
  })
})
