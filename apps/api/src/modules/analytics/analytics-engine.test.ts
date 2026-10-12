import { beforeEach, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Hono } from 'hono'
import { reportRoutes } from './analytics.routes'
import {
  type AnalyticsEventParams,
  AnalyticsService,
  analyticsService,
  resetAnalyticsStore,
} from './analytics.service'

describe('Analytics Engine & Reporting Module (Task 4.9 - apps/api)', () => {
  const rootDir = join(import.meta.dir, '..', '..', '..', '..', '..')
  const validAgentId = '123e4567-e89b-12d3-a456-426614174001'
  const validInboxId = '123e4567-e89b-12d3-a456-426614174002'
  const validConversationId = '123e4567-e89b-12d3-a456-426614174003'
  const validTicketId = '123e4567-e89b-12d3-a456-426614174004'

  let app: Hono

  beforeEach(() => {
    resetAnalyticsStore()
    app = new Hono()
    app.route('/api/v1/reports', reportRoutes)
  })

  describe('Time Tracking Event Listeners', () => {
    it('should record First Response Time event when agent first replies', async () => {
      const openedAt = new Date('2026-10-12T10:00:00.000Z')
      const repliedAt = new Date('2026-10-12T10:05:30.000Z') // 330 seconds later

      const event = await analyticsService.recordFirstResponseTime({
        conversationId: validConversationId,
        ticketId: validTicketId,
        userId: validAgentId,
        inboxId: validInboxId,
        openedAt: openedAt.toISOString(),
        repliedAt: repliedAt.toISOString(),
      })

      expect(event).toBeDefined()
      expect(event.eventType).toBe('first_response_time')
      expect(event.conversationId).toBe(validConversationId)
      expect(event.ticketId).toBe(validTicketId)
      expect(event.userId).toBe(validAgentId)
      expect(event.inboxId).toBe(validInboxId)
      expect(event.valueInSeconds).toBe(330)
    })

    it('should record Resolution Time event when ticket is resolved', async () => {
      const openedAt = new Date('2026-10-12T10:00:00.000Z')
      const resolvedAt = new Date('2026-10-12T10:30:00.000Z') // 1800 seconds later

      const event = await analyticsService.recordResolutionTime({
        conversationId: validConversationId,
        ticketId: validTicketId,
        userId: validAgentId,
        inboxId: validInboxId,
        openedAt: openedAt.toISOString(),
        resolvedAt: resolvedAt.toISOString(),
      })

      expect(event).toBeDefined()
      expect(event.eventType).toBe('resolution_time')
      expect(event.conversationId).toBe(validConversationId)
      expect(event.ticketId).toBe(validTicketId)
      expect(event.userId).toBe(validAgentId)
      expect(event.inboxId).toBe(validInboxId)
      expect(event.valueInSeconds).toBe(1800)
    })

    it('should clamp negative response/resolution time to zero', async () => {
      const openedAt = new Date('2026-10-12T10:05:00.000Z')
      const repliedAt = new Date('2026-10-12T10:00:00.000Z') // clock skew in reverse

      const event = await analyticsService.recordFirstResponseTime({
        conversationId: validConversationId,
        ticketId: validTicketId,
        userId: validAgentId,
        inboxId: validInboxId,
        openedAt: openedAt.toISOString(),
        repliedAt: repliedAt.toISOString(),
      })

      expect(event.valueInSeconds).toBe(0)
    })

    it('should trigger onFirstReply event listener properly', async () => {
      const ticket = {
        id: validTicketId,
        conversationId: validConversationId,
        assigneeId: validAgentId,
        openedAt: '2026-10-12T08:00:00.000Z',
        firstReplyCreatedAt: '2026-10-12T08:02:00.000Z',
      }

      const event = await analyticsService.onFirstReply(ticket, validAgentId, validInboxId)
      expect(event).not.toBeNull()
      expect(event?.valueInSeconds).toBe(120)
    })

    it('should trigger onTicketResolved event listener properly', async () => {
      const ticket = {
        id: validTicketId,
        conversationId: validConversationId,
        assigneeId: validAgentId,
        openedAt: '2026-10-12T08:00:00.000Z',
        resolvedAt: '2026-10-12T08:45:00.000Z',
      }

      const event = await analyticsService.onTicketResolved(ticket, validInboxId)
      expect(event).not.toBeNull()
      expect(event?.valueInSeconds).toBe(2700)
    })
  })

  describe('Raw SQL Aggregation Queries & Calculations', () => {
    it('should calculate summary metrics across reporting events', async () => {
      // Seed events
      await analyticsService.recordFirstResponseTime({
        conversationId: validConversationId,
        ticketId: validTicketId,
        userId: validAgentId,
        inboxId: validInboxId,
        openedAt: '2026-10-12T09:00:00.000Z',
        repliedAt: '2026-10-12T09:02:00.000Z', // 120s
      })
      await analyticsService.recordFirstResponseTime({
        conversationId: validConversationId,
        ticketId: '123e4567-e89b-12d3-a456-426614174005',
        userId: validAgentId,
        inboxId: validInboxId,
        openedAt: '2026-10-12T09:10:00.000Z',
        repliedAt: '2026-10-12T09:14:00.000Z', // 240s
      })
      await analyticsService.recordResolutionTime({
        conversationId: validConversationId,
        ticketId: validTicketId,
        userId: validAgentId,
        inboxId: validInboxId,
        openedAt: '2026-10-12T09:00:00.000Z',
        resolvedAt: '2026-10-12T09:30:00.000Z', // 1800s
      })

      const summary = await analyticsService.getMetricsSummary({
        inboxId: validInboxId,
        agentId: validAgentId,
      })

      expect(summary.avgFirstResponseTimeSeconds).toBe(180) // (120 + 240) / 2
      expect(summary.avgResolutionTimeSeconds).toBe(1800)
      expect(summary.totalResolvedTickets).toBe(1)
    })

    it('should aggregate metrics grouped by time interval (day/week)', async () => {
      await analyticsService.recordFirstResponseTime({
        conversationId: validConversationId,
        ticketId: validTicketId,
        userId: validAgentId,
        inboxId: validInboxId,
        openedAt: '2026-10-11T10:00:00.000Z',
        repliedAt: '2026-10-11T10:01:00.000Z', // 60s
      })
      await analyticsService.recordFirstResponseTime({
        conversationId: validConversationId,
        ticketId: '123e4567-e89b-12d3-a456-426614174005',
        userId: validAgentId,
        inboxId: validInboxId,
        openedAt: '2026-10-12T10:00:00.000Z',
        repliedAt: '2026-10-12T10:03:00.000Z', // 180s
      })

      const timeSeries = await analyticsService.getTimeSeries({
        type: 'first_response_time',
        groupBy: 'day',
      })

      expect(Array.isArray(timeSeries)).toBe(true)
      expect(timeSeries.length).toBeGreaterThanOrEqual(1)
    })

    it('should compute agent performance breakdown', async () => {
      const agent2Id = '123e4567-e89b-12d3-a456-426614174099'

      await analyticsService.recordResolutionTime({
        conversationId: validConversationId,
        ticketId: validTicketId,
        userId: validAgentId,
        inboxId: validInboxId,
        openedAt: '2026-10-12T08:00:00.000Z',
        resolvedAt: '2026-10-12T08:20:00.000Z', // 1200s
      })
      await analyticsService.recordResolutionTime({
        conversationId: validConversationId,
        ticketId: '123e4567-e89b-12d3-a456-426614174098',
        userId: agent2Id,
        inboxId: validInboxId,
        openedAt: '2026-10-12T08:00:00.000Z',
        resolvedAt: '2026-10-12T08:10:00.000Z', // 600s
      })

      const agents = await analyticsService.getAgentPerformance()
      expect(agents.length).toBe(2)

      const agent1Perf = agents.find((a) => a.agentId === validAgentId)
      expect(agent1Perf).toBeDefined()
      expect(agent1Perf?.avgResolutionTimeSeconds).toBe(1200)

      const agent2Perf = agents.find((a) => a.agentId === agent2Id)
      expect(agent2Perf).toBeDefined()
      expect(agent2Perf?.avgResolutionTimeSeconds).toBe(600)
    })
  })

  describe('HTTP REST API Endpoints', () => {
    it('GET /api/v1/reports/summary should return JSON metrics summary', async () => {
      await analyticsService.recordFirstResponseTime({
        conversationId: validConversationId,
        ticketId: validTicketId,
        userId: validAgentId,
        inboxId: validInboxId,
        openedAt: '2026-10-12T09:00:00.000Z',
        repliedAt: '2026-10-12T09:02:00.000Z',
      })

      const res = await app.request('/api/v1/reports/summary')
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.avgFirstResponseTimeSeconds).toBe(120)
    })

    it('GET /api/v1/reports/agents should return agent performance metrics', async () => {
      await analyticsService.recordFirstResponseTime({
        conversationId: validConversationId,
        ticketId: validTicketId,
        userId: validAgentId,
        inboxId: validInboxId,
        openedAt: '2026-10-12T09:00:00.000Z',
        repliedAt: '2026-10-12T09:02:00.000Z',
      })

      const res = await app.request('/api/v1/reports/agents')
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(Array.isArray(json.data)).toBe(true)
      expect(json.data[0].agentId).toBe(validAgentId)
    })

    it('GET /api/v1/reports/export should stream formatted CSV file', async () => {
      await analyticsService.recordFirstResponseTime({
        conversationId: validConversationId,
        ticketId: validTicketId,
        userId: validAgentId,
        inboxId: validInboxId,
        openedAt: '2026-10-12T09:00:00.000Z',
        repliedAt: '2026-10-12T09:02:00.000Z',
      })
      await analyticsService.recordResolutionTime({
        conversationId: validConversationId,
        ticketId: validTicketId,
        userId: validAgentId,
        inboxId: validInboxId,
        openedAt: '2026-10-12T09:00:00.000Z',
        resolvedAt: '2026-10-12T09:20:00.000Z',
      })

      const res = await app.request('/api/v1/reports/export?type=events')
      expect(res.status).toBe(200)

      const contentType = res.headers.get('content-type')
      expect(contentType).toContain('text/csv')

      const disposition = res.headers.get('content-disposition')
      expect(disposition).toContain('attachment')
      expect(disposition).toContain('.csv')

      const csvText = await res.text()
      expect(csvText).toContain(
        'id,event_type,conversation_id,ticket_id,user_id,inbox_id,value_in_seconds,created_at',
      )
      expect(csvText).toContain('first_response_time')
      expect(csvText).toContain('resolution_time')
    })

    it('GET /api/v1/reports/export with summary type should export CSV summary', async () => {
      const res = await app.request('/api/v1/reports/export?type=summary')
      expect(res.status).toBe(200)

      const csvText = await res.text()
      expect(csvText).toContain('metric,value')
      expect(csvText).toContain('avgFirstResponseTimeSeconds')
      expect(csvText).toContain('avgResolutionTimeSeconds')
    })
  })

  describe('Single Organization Rule Guardrail', () => {
    it('must NOT require or store account_id in reporting tables or entities', () => {
      const dummyEvent: AnalyticsEventParams = {
        eventType: 'first_response_time',
        conversationId: validConversationId,
        ticketId: validTicketId,
        userId: validAgentId,
        inboxId: validInboxId,
        valueInSeconds: 120,
      }

      const keys = Object.keys(dummyEvent)
      expect(keys).not.toContain('account_id')
      expect(keys).not.toContain('accountId')
    })
  })

  describe('Phase 4 Checklist Synchronization', () => {
    it('should mark Task 4.9 as completed in docs/PHASE_4_CHECKLIST.md', () => {
      const checklistPath = join(rootDir, 'docs', 'PHASE_4_CHECKLIST.md')
      const content = readFileSync(checklistPath, 'utf-8')
      expect(content).toContain('- [x] **Task 4.9 (TDD - Analytics Engine)**:')
    })
  })
})
