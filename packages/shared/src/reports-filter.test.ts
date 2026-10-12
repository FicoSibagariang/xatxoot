import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ReportFilterQueryRawSchema,
  ReportFilterQuerySchema,
  ReportGroupBySchema,
  ReportMetricTypeSchema,
  ReportingDataPointSchema,
  ReportingEventSchema,
  ReportingMetricSummarySchema,
} from './schemas'

describe('Reporting & Metrics Filter Schemas (Task 4.5 - packages/shared)', () => {
  const rootDir = join(import.meta.dir, '..', '..', '..')
  const validAgentId = '123e4567-e89b-12d3-a456-426614174001'
  const validInboxId = '123e4567-e89b-12d3-a456-426614174002'
  const validTeamId = '123e4567-e89b-12d3-a456-426614174003'
  const validLabelId = '123e4567-e89b-12d3-a456-426614174004'

  describe('ReportMetricTypeSchema', () => {
    it('should accept valid metric types', () => {
      const validTypes = [
        'conversations_count',
        'incoming_messages_count',
        'outgoing_messages_count',
        'first_response_time',
        'resolution_time',
        'csat_score',
      ]
      for (const type of validTypes) {
        const result = ReportMetricTypeSchema.safeParse(type)
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid metric types', () => {
      expect(ReportMetricTypeSchema.safeParse('invalid_metric').success).toBe(false)
      expect(ReportMetricTypeSchema.safeParse('').success).toBe(false)
      expect(ReportMetricTypeSchema.safeParse(123).success).toBe(false)
    })
  })

  describe('ReportGroupBySchema', () => {
    it('should accept valid group by options', () => {
      const validOptions = ['day', 'week', 'month', 'year', 'agent', 'inbox', 'team', 'label']
      for (const opt of validOptions) {
        const result = ReportGroupBySchema.safeParse(opt)
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid group by options', () => {
      expect(ReportGroupBySchema.safeParse('hour').success).toBe(false)
      expect(ReportGroupBySchema.safeParse('quarter').success).toBe(false)
    })
  })

  describe('ReportFilterQuerySchema', () => {
    it('should validate valid filter query with full options', () => {
      const input = {
        since: '2026-10-01T00:00:00.000Z',
        until: '2026-10-12T23:59:59.999Z',
        agentId: validAgentId,
        inboxId: validInboxId,
        teamId: validTeamId,
        labelId: validLabelId,
        type: 'first_response_time',
        groupBy: 'day',
      }
      const result = ReportFilterQuerySchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.agentId).toBe(validAgentId)
        expect(result.data.inboxId).toBe(validInboxId)
        expect(result.data.type).toBe('first_response_time')
        expect(result.data.groupBy).toBe('day')
      }
    })

    it('should accept date strings or timestamps for since and until', () => {
      const input = {
        since: '2026-10-01',
        until: '2026-10-10',
      }
      const result = ReportFilterQuerySchema.safeParse(input)
      expect(result.success).toBe(true)
    })

    it('should reject when since is after until', () => {
      const input = {
        since: '2026-10-15T00:00:00.000Z',
        until: '2026-10-01T00:00:00.000Z',
      }
      const result = ReportFilterQuerySchema.safeParse(input)
      expect(result.success).toBe(false)
    })

    it('should reject invalid UUIDs for agentId, inboxId, teamId, labelId', () => {
      expect(ReportFilterQuerySchema.safeParse({ agentId: 'not-a-uuid' }).success).toBe(false)
      expect(ReportFilterQuerySchema.safeParse({ inboxId: 'not-a-uuid' }).success).toBe(false)
      expect(ReportFilterQuerySchema.safeParse({ teamId: 'not-a-uuid' }).success).toBe(false)
      expect(ReportFilterQuerySchema.safeParse({ labelId: 'not-a-uuid' }).success).toBe(false)
    })

    it('should strictly NOT contain account_id or accountId (Single Organization Rule)', () => {
      const schemaShape = ReportFilterQueryRawSchema.shape as Record<string, unknown>
      expect(schemaShape.accountId).toBeUndefined()
      expect(schemaShape.account_id).toBeUndefined()
    })
  })

  describe('ReportingEventSchema', () => {
    it('should validate valid reporting event instance', () => {
      const event = {
        id: '123e4567-e89b-12d3-a456-426614174099',
        eventType: 'first_response_time',
        conversationId: '123e4567-e89b-12d3-a456-426614174001',
        ticketId: '123e4567-e89b-12d3-a456-426614174002',
        userId: validAgentId,
        inboxId: validInboxId,
        valueInSeconds: 120,
        createdAt: new Date().toISOString(),
      }
      const result = ReportingEventSchema.safeParse(event)
      expect(result.success).toBe(true)
    })
  })

  describe('ReportingMetricSummarySchema & ReportingDataPointSchema', () => {
    it('should validate metric summary structure', () => {
      const summary = {
        conversationsCount: 150,
        incomingMessagesCount: 420,
        outgoingMessagesCount: 380,
        avgFirstResponseTimeSeconds: 45.5,
        avgResolutionTimeSeconds: 310.2,
        avgCsatScore: 4.8,
        totalResolvedTickets: 120,
      }
      const result = ReportingMetricSummarySchema.safeParse(summary)
      expect(result.success).toBe(true)
    })

    it('should validate time-series data point', () => {
      const dataPoint = {
        timestamp: '2026-10-12T00:00:00.000Z',
        value: 42.5,
        count: 15,
        agentId: validAgentId,
      }
      const result = ReportingDataPointSchema.safeParse(dataPoint)
      expect(result.success).toBe(true)
    })
  })

  describe('Checklist Verification', () => {
    it('should verify Phase 4 checklist marks Task 4.5 as completed', () => {
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_4_CHECKLIST.md'), 'utf-8')
      expect(checklistContent).toContain(
        '- [x] **Task 4.5**: Tipe & skema validasi untuk query filter metrik laporan',
      )
    })
  })
})
