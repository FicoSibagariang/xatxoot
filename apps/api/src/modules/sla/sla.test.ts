import { beforeEach, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Hono } from 'hono'
import { conversationService } from '../conversations/conversations.service'
import { inboxService } from '../inboxes/inboxes.service'
import { type RealtimeEvent, realtimeService } from '../realtime/realtime.service'
import { resetTicketStore, ticketService } from '../tickets/tickets.service'
import { slaRoutes } from './sla.routes'
import {
  type SlaEvaluationResult,
  SlaMonitoringWorker,
  SlaService,
  resetSlaStore,
  slaMonitoringWorker,
  slaService,
} from './sla.service'

describe('SLA Monitoring Worker & Escalation Engine (Task 5.11 - apps/api)', () => {
  const rootDir = join(import.meta.dir, '..', '..', '..', '..', '..')
  const validInboxId = '123e4567-e89b-12d3-a456-426614174001'

  let app: Hono
  let capturedEvents: RealtimeEvent[] = []

  beforeEach(async () => {
    resetTicketStore()
    resetSlaStore()
    capturedEvents = []

    // Hook realtimeService broadcast to capture emitted SSE events
    const originalBroadcast = realtimeService.broadcast.bind(realtimeService)
    realtimeService.broadcast = (event: RealtimeEvent) => {
      capturedEvents.push(event)
      originalBroadcast(event)
    }

    app = new Hono()
    app.route('/api/v1/sla', slaRoutes)
  })

  describe('1. SLA Policy Management (CRUD & Priority Rules)', () => {
    it('should create an SLA policy with baseline thresholds and priority rules', async () => {
      const created = await slaService.createPolicy({
        name: 'Enterprise VIP SLA',
        description: 'SLA untuk penanganan tier enterprise',
        inboxId: validInboxId,
        firstResponseTimeSeconds: 1800, // 30 min default
        resolutionTimeSeconds: 14400, // 4 hours default
        onlyDuringBusinessHours: false,
        priorityRules: [
          {
            priority: 'urgent',
            firstResponseTimeSeconds: 300, // 5 min
            resolutionTimeSeconds: 1800, // 30 min
          },
          {
            priority: 'high',
            firstResponseTimeSeconds: 900, // 15 min
            resolutionTimeSeconds: 7200, // 2 hours
          },
        ],
      })

      expect(created.id).toBeDefined()
      expect(created.name).toBe('Enterprise VIP SLA')
      expect(created.firstResponseTimeSeconds).toBe(1800)
      expect(created.resolutionTimeSeconds).toBe(14400)
      expect(created.priorityRules?.length).toBe(2)
      expect(created.active).toBe(true)

      const fetched = await slaService.getPolicyById(created.id)
      expect(fetched).not.toBeNull()
      expect(fetched?.name).toBe('Enterprise VIP SLA')
    })

    it('should support global default SLA policy when inboxId is not provided', async () => {
      const globalPolicy = await slaService.createPolicy({
        name: 'Global Default SLA',
        firstResponseTimeSeconds: 3600,
        resolutionTimeSeconds: 28800,
      })

      expect(globalPolicy.inboxId).toBeNull()

      // When querying for an inbox without a specific policy, fall back to global default
      const effectivePolicy = await slaService.getEffectivePolicyForInbox('non-existent-inbox')
      expect(effectivePolicy).not.toBeNull()
      expect(effectivePolicy?.id).toBe(globalPolicy.id)
      expect(effectivePolicy?.name).toBe('Global Default SLA')
    })

    it('should update and delete SLA policies', async () => {
      const policy = await slaService.createPolicy({
        name: 'Standard SLA',
        firstResponseTimeSeconds: 3600,
        resolutionTimeSeconds: 86400,
      })

      const updated = await slaService.updatePolicy(policy.id, {
        name: 'Standard SLA Updated',
        firstResponseTimeSeconds: 2400,
        active: false,
      })

      expect(updated.name).toBe('Standard SLA Updated')
      expect(updated.firstResponseTimeSeconds).toBe(2400)
      expect(updated.active).toBe(false)

      const deleted = await slaService.deletePolicy(policy.id)
      expect(deleted).toBe(true)

      const check = await slaService.getPolicyById(policy.id)
      expect(check).toBeNull()
    })
  })

  describe('2. SLA Deadline Calculations', () => {
    it('should calculate deadlines using priority rule overrides', async () => {
      const policy = await slaService.createPolicy({
        name: 'Tiered SLA',
        firstResponseTimeSeconds: 3600,
        resolutionTimeSeconds: 14400,
        priorityRules: [
          {
            priority: 'urgent',
            firstResponseTimeSeconds: 600, // 10 min
            resolutionTimeSeconds: 3600, // 1 hour
          },
        ],
      })

      const baseTime = new Date('2026-10-13T10:00:00.000Z')

      // Urgent priority calculation
      const urgentDeadlines = slaService.calculateDeadlines(policy, 'urgent', baseTime)
      expect(new Date(urgentDeadlines.firstResponseDeadline).toISOString()).toBe(
        '2026-10-13T10:10:00.000Z',
      )
      expect(new Date(urgentDeadlines.resolutionDeadline).toISOString()).toBe(
        '2026-10-13T11:00:00.000Z',
      )

      // Medium priority falls back to baseline policy
      const mediumDeadlines = slaService.calculateDeadlines(policy, 'medium', baseTime)
      expect(new Date(mediumDeadlines.firstResponseDeadline).toISOString()).toBe(
        '2026-10-13T11:00:00.000Z',
      )
      expect(new Date(mediumDeadlines.resolutionDeadline).toISOString()).toBe(
        '2026-10-13T14:00:00.000Z',
      )
    })
  })

  describe('3. Ticket SLA Attachment & Synchronization', () => {
    it('should attach SLA policy to a ticket and synchronize tickets.deadline_at', async () => {
      const policy = await slaService.createPolicy({
        name: 'Inbox SLA',
        inboxId: validInboxId,
        firstResponseTimeSeconds: 1200, // 20 min
        resolutionTimeSeconds: 7200, // 2 hours
      })

      const ticket = await ticketService.createTicket({
        conversationId: crypto.randomUUID(),
        priority: 'high',
      })

      const status = await slaService.attachSlaToTicket({
        ticketId: ticket.id,
        policyId: policy.id,
        priority: 'high',
      })

      expect(status.ticketId).toBe(ticket.id)
      expect(status.policyId).toBe(policy.id)
      expect(status.firstResponseDeadline).toBeDefined()
      expect(status.resolutionDeadline).toBeDefined()
      expect(status.isBreached).toBe(false)

      // Verify that ticket's deadlineAt is synchronized with first response deadline
      const updatedTicket = await ticketService.getTicketById(ticket.id)
      expect(updatedTicket?.deadlineAt).toBe(status.firstResponseDeadline)
    })
  })

  describe('4. SLA Breach Detection & Realtime Broadcast', () => {
    it('should detect first response SLA breach and broadcast sla.breached SSE event', async () => {
      const policy = await slaService.createPolicy({
        name: 'Fast SLA',
        firstResponseTimeSeconds: 60,
        resolutionTimeSeconds: 3600,
      })

      // Ticket opened in the past, no first reply yet
      const pastTime = new Date(Date.now() - 120 * 1000) // 2 minutes ago
      const ticket = await ticketService.createTicket({
        conversationId: crypto.randomUUID(),
        priority: 'urgent',
      })

      // Attach SLA with past deadlines
      await slaService.attachSlaToTicket({
        ticketId: ticket.id,
        policyId: policy.id,
        priority: 'urgent',
        baseTime: pastTime,
      })

      // Run evaluation
      const result = await slaService.evaluateAllActiveTickets()
      expect(result.breachedCount).toBeGreaterThanOrEqual(1)

      const status = await slaService.getTicketSlaStatus(ticket.id)
      expect(status?.isBreached).toBe(true)
      expect(status?.breachedAt).toBeDefined()

      // Verify SSE event sla.breached was broadcasted
      const breachEvent = capturedEvents.find(
        (e) =>
          e.event === 'sla.breached' && (e.data as Record<string, unknown>)?.ticketId === ticket.id,
      )
      expect(breachEvent).toBeDefined()
      expect((breachEvent?.data as Record<string, unknown>)?.breachType).toBe('first_response')
    })

    it('should detect resolution deadline breach if ticket is still open past resolution deadline', async () => {
      const policy = await slaService.createPolicy({
        name: 'Resolution SLA',
        firstResponseTimeSeconds: 300,
        resolutionTimeSeconds: 600,
      })

      const pastTime = new Date(Date.now() - 800 * 1000) // 800 seconds ago
      const ticket = await ticketService.createTicket({
        conversationId: crypto.randomUUID(),
        priority: 'medium',
      })

      // Simulate that first reply WAS already created in time
      ticket.firstReplyCreatedAt = new Date(Date.now() - 700 * 1000).toISOString()

      await slaService.attachSlaToTicket({
        ticketId: ticket.id,
        policyId: policy.id,
        priority: 'medium',
        baseTime: pastTime,
      })

      const result = await slaService.evaluateAllActiveTickets()
      expect(result.breachedCount).toBeGreaterThanOrEqual(1)

      const breachEvent = capturedEvents.find(
        (e) =>
          e.event === 'sla.breached' && (e.data as Record<string, unknown>)?.ticketId === ticket.id,
      )
      expect(breachEvent).toBeDefined()
      expect((breachEvent?.data as Record<string, unknown>)?.breachType).toBe('resolution')
    })

    it('should not breach tickets that are already resolved', async () => {
      const policy = await slaService.createPolicy({
        name: 'Resolved SLA',
        firstResponseTimeSeconds: 60,
        resolutionTimeSeconds: 120,
      })

      const ticket = await ticketService.createTicket({
        conversationId: crypto.randomUUID(),
        status: 'open',
      })

      await slaService.attachSlaToTicket({
        ticketId: ticket.id,
        policyId: policy.id,
        priority: 'medium',
        baseTime: new Date(Date.now() - 200 * 1000),
      })

      // Resolve the ticket
      await ticketService.updateTicketStatus(ticket.id, 'resolved')

      capturedEvents = []
      const result = await slaService.evaluateAllActiveTickets()
      expect(result.breachedCount).toBe(0)

      const breachEvent = capturedEvents.find((e) => e.event === 'sla.breached')
      expect(breachEvent).toBeUndefined()
    })
  })

  describe('5. SLA Warning / Approaching Deadline Detection', () => {
    it('should broadcast sla.warning SSE event when ticket deadline is within warning window', async () => {
      const policy = await slaService.createPolicy({
        name: 'Warning SLA',
        firstResponseTimeSeconds: 600, // 10 min
        resolutionTimeSeconds: 3600,
      })

      // Ticket opened 6 minutes ago (4 minutes remaining <= 15 minutes warning window)
      const ticketTime = new Date(Date.now() - 360 * 1000)
      const ticket = await ticketService.createTicket({
        conversationId: crypto.randomUUID(),
        priority: 'high',
      })

      await slaService.attachSlaToTicket({
        ticketId: ticket.id,
        policyId: policy.id,
        priority: 'high',
        baseTime: ticketTime,
      })

      const result = await slaService.evaluateAllActiveTickets()
      expect(result.warnedCount).toBeGreaterThanOrEqual(1)

      const warningEvent = capturedEvents.find(
        (e) =>
          e.event === 'sla.warning' && (e.data as Record<string, unknown>)?.ticketId === ticket.id,
      )
      expect(warningEvent).toBeDefined()
      expect((warningEvent?.data as Record<string, unknown>)?.remainingSeconds).toBeGreaterThan(0)
      expect((warningEvent?.data as Record<string, unknown>)?.remainingSeconds).toBeLessThanOrEqual(
        900,
      )
    })
  })

  describe('6. Escalation Engine (Auto-Priority Escalation on Breach)', () => {
    it('should escalate ticket priority to urgent upon breach', async () => {
      const policy = await slaService.createPolicy({
        name: 'Escalation SLA',
        firstResponseTimeSeconds: 30,
        resolutionTimeSeconds: 60,
      })

      const pastTime = new Date(Date.now() - 100 * 1000)
      const ticket = await ticketService.createTicket({
        conversationId: crypto.randomUUID(),
        priority: 'low',
      })

      await slaService.attachSlaToTicket({
        ticketId: ticket.id,
        policyId: policy.id,
        priority: 'low',
        baseTime: pastTime,
      })

      const result = await slaService.evaluateAllActiveTickets()
      expect(result.escalatedCount).toBeGreaterThanOrEqual(1)

      // Ticket priority should have escalated to 'urgent'
      const updatedTicket = await ticketService.getTicketById(ticket.id)
      expect(updatedTicket?.priority).toBe('urgent')

      // ticket.updated event should be emitted
      const updateEvent = capturedEvents.find(
        (e) =>
          e.event === 'ticket.updated' &&
          ((e.data as Record<string, unknown>)?.ticket as Record<string, unknown>)?.id ===
            ticket.id,
      )
      expect(updateEvent).toBeDefined()
    })
  })

  describe('7. Outgoing Webhooks Triggering & Delivery Logging', () => {
    it('should trigger outgoing webhook and log delivery on SLA breach', async () => {
      // Register an active outgoing webhook
      await slaService.registerOutgoingWebhook({
        url: 'https://example.com/webhooks/sla',
        subscriptions: ['sla.breached', 'sla.warning'],
        secret: 'webhook-secret-123',
      })

      const policy = await slaService.createPolicy({
        name: 'Webhook SLA',
        firstResponseTimeSeconds: 30,
        resolutionTimeSeconds: 60,
      })

      const ticket = await ticketService.createTicket({
        conversationId: crypto.randomUUID(),
        priority: 'high',
      })

      await slaService.attachSlaToTicket({
        ticketId: ticket.id,
        policyId: policy.id,
        priority: 'high',
        baseTime: new Date(Date.now() - 100 * 1000),
      })

      await slaService.evaluateAllActiveTickets()

      const deliveries = await slaService.listWebhookDeliveries()
      expect(deliveries.length).toBeGreaterThanOrEqual(1)

      const breachDelivery = deliveries.find((d) => d.eventName === 'sla.breached')
      expect(breachDelivery).toBeDefined()
      expect(breachDelivery?.status).toBe('delivered')
      expect(breachDelivery?.payload?.ticketId).toBe(ticket.id)
    })
  })

  describe('8. SLA Monitoring Worker Lifecycle', () => {
    it('should run recurring checks and allow start/stop without leaking timers', async () => {
      const worker = new SlaMonitoringWorker(slaService)

      expect(worker.isRunning()).toBe(false)
      worker.start(5000)
      expect(worker.isRunning()).toBe(true)

      // Calling runOnce manually
      const runResult = await worker.runOnce()
      expect(runResult).toBeDefined()
      expect(typeof runResult.checkedCount).toBe('number')

      worker.stop()
      expect(worker.isRunning()).toBe(false)
    })
  })

  describe('9. HTTP API Endpoints (/api/v1/sla)', () => {
    it('POST /api/v1/sla/policies & GET /api/v1/sla/policies should manage policies via REST', async () => {
      const res = await app.request('/api/v1/sla/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'API SLA Policy',
          firstResponseTimeSeconds: 1200,
          resolutionTimeSeconds: 7200,
        }),
      })

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.id).toBeDefined()
      expect(data.name).toBe('API SLA Policy')

      const listRes = await app.request('/api/v1/sla/policies')
      expect(listRes.status).toBe(200)
      const listData = await listRes.json()
      expect(Array.isArray(listData)).toBe(true)
      expect(listData.some((p: Record<string, unknown>) => p.id === data.id)).toBe(true)
    })

    it('POST /api/v1/sla/evaluate should manually trigger evaluation', async () => {
      const res = await app.request('/api/v1/sla/evaluate', {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(typeof data.result.checkedCount).toBe('number')
    })

    it('GET & POST /api/v1/sla/tickets/:ticketId/status & attach should manage ticket SLA', async () => {
      const policy = await slaService.createPolicy({
        name: 'Attach SLA',
        firstResponseTimeSeconds: 1800,
        resolutionTimeSeconds: 7200,
      })

      const ticket = await ticketService.createTicket({
        conversationId: crypto.randomUUID(),
      })

      const attachRes = await app.request(`/api/v1/sla/tickets/${ticket.id}/attach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyId: policy.id,
          priority: 'medium',
        }),
      })

      expect(attachRes.status).toBe(200)
      const attachData = await attachRes.json()
      expect(attachData.ticketId).toBe(ticket.id)
      expect(attachData.policyId).toBe(policy.id)

      const statusRes = await app.request(`/api/v1/sla/tickets/${ticket.id}/status`)
      expect(statusRes.status).toBe(200)
      const statusData = await statusRes.json()
      expect(statusData.ticketId).toBe(ticket.id)
      expect(statusData.isBreached).toBe(false)
    })
  })

  describe('10. Single Organization Guardrail & Phase 5 Checklist', () => {
    it('should strictly NOT contain account_id or accountId anywhere in SLA models', async () => {
      const policy = await slaService.createPolicy({
        name: 'Guardrail SLA',
        firstResponseTimeSeconds: 300,
        resolutionTimeSeconds: 1800,
      })

      const policyKeys = Object.keys(policy)
      expect(policyKeys).not.toContain('account_id')
      expect(policyKeys).not.toContain('accountId')

      const ticket = await ticketService.createTicket({ conversationId: crypto.randomUUID() })
      const status = await slaService.attachSlaToTicket({
        ticketId: ticket.id,
        policyId: policy.id,
      })

      const statusKeys = Object.keys(status)
      expect(statusKeys).not.toContain('account_id')
      expect(statusKeys).not.toContain('accountId')
    })

    it('should verify docs/PHASE_5_CHECKLIST.md marks Task 5.11 as completed', () => {
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_5_CHECKLIST.md'), 'utf-8')
      expect(checklistContent).toContain('- [x] **Task 5.11 (TDD - SLA Monitoring Worker)**:')
    })
  })
})
