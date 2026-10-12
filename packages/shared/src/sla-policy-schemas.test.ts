import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CalculateSlaDeadlinesInputSchema,
  CreateSlaPolicyInputSchema,
  SlaPolicySchema,
  SlaPriorityRuleSchema,
  TicketSlaStatusSchema,
  UpdateSlaPolicyInputSchema,
} from './schemas'

describe('SLA Policy & Priority Rules Schemas (Task 5.7 - packages/shared)', () => {
  const rootDir = join(import.meta.dir, '..', '..', '..')
  const validUuid = '123e4567-e89b-12d3-a456-426614174000'
  const validInboxId = '123e4567-e89b-12d3-a456-426614174001'

  describe('1. SlaPriorityRuleSchema', () => {
    it('should validate valid priority rule', () => {
      const rule = {
        priority: 'urgent',
        firstResponseTimeSeconds: 300, // 5 menit
        resolutionTimeSeconds: 1800, // 30 menit
      }
      const result = SlaPriorityRuleSchema.safeParse(rule)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.priority).toBe('urgent')
        expect(result.data.firstResponseTimeSeconds).toBe(300)
        expect(result.data.resolutionTimeSeconds).toBe(1800)
      }
    })

    it('should reject when firstResponseTimeSeconds exceeds resolutionTimeSeconds', () => {
      const invalidRule = {
        priority: 'urgent',
        firstResponseTimeSeconds: 3600,
        resolutionTimeSeconds: 1800,
      }
      const result = SlaPriorityRuleSchema.safeParse(invalidRule)
      expect(result.success).toBe(false)
    })

    it('should reject non-positive or float threshold values', () => {
      expect(
        SlaPriorityRuleSchema.safeParse({
          priority: 'high',
          firstResponseTimeSeconds: 0,
          resolutionTimeSeconds: 3600,
        }).success,
      ).toBe(false)

      expect(
        SlaPriorityRuleSchema.safeParse({
          priority: 'high',
          firstResponseTimeSeconds: 120.5,
          resolutionTimeSeconds: 3600,
        }).success,
      ).toBe(false)
    })
  })

  describe('2. CreateSlaPolicyInputSchema & UpdateSlaPolicyInputSchema', () => {
    it('should validate valid SLA policy creation with priority rules', () => {
      const input = {
        name: 'Standard Customer SLA',
        description: 'SLA default untuk semua tiket umum',
        inboxId: validInboxId,
        firstResponseTimeSeconds: 3600,
        resolutionTimeSeconds: 86400,
        onlyDuringBusinessHours: true,
        priorityRules: [
          {
            priority: 'urgent',
            firstResponseTimeSeconds: 900,
            resolutionTimeSeconds: 7200,
          },
          {
            priority: 'high',
            firstResponseTimeSeconds: 1800,
            resolutionTimeSeconds: 14400,
          },
          {
            priority: 'medium',
            firstResponseTimeSeconds: 3600,
            resolutionTimeSeconds: 43200,
          },
          {
            priority: 'low',
            firstResponseTimeSeconds: 7200,
            resolutionTimeSeconds: 86400,
          },
        ],
      }
      const result = CreateSlaPolicyInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Standard Customer SLA')
        expect(result.data.priorityRules?.length).toBe(4)
        expect(result.data.onlyDuringBusinessHours).toBe(true)
      }
    })

    it('should accept global SLA policy without inboxId', () => {
      const globalInput = {
        name: 'Global Default SLA',
        firstResponseTimeSeconds: 1800,
        resolutionTimeSeconds: 7200,
      }
      const result = CreateSlaPolicyInputSchema.safeParse(globalInput)
      expect(result.success).toBe(true)
    })

    it('should reject when baseline firstResponseTimeSeconds exceeds resolutionTimeSeconds', () => {
      const invalidInput = {
        name: 'Faulty SLA',
        firstResponseTimeSeconds: 86400,
        resolutionTimeSeconds: 3600,
      }
      const result = CreateSlaPolicyInputSchema.safeParse(invalidInput)
      expect(result.success).toBe(false)
    })

    it('should reject empty name', () => {
      const emptyName = {
        name: '',
        firstResponseTimeSeconds: 300,
        resolutionTimeSeconds: 1800,
      }
      expect(CreateSlaPolicyInputSchema.safeParse(emptyName).success).toBe(false)
    })

    it('should validate partial update input', () => {
      const update = {
        firstResponseTimeSeconds: 1200,
        active: false,
      }
      const result = UpdateSlaPolicyInputSchema.safeParse(update)
      expect(result.success).toBe(true)
    })
  })

  describe('3. SlaPolicySchema (Persisted Entity)', () => {
    it('should validate full persisted SLA policy entity', () => {
      const policy = {
        id: validUuid,
        name: 'Enterprise VIP SLA',
        description: 'SLA untuk pelanggan enterprise tier 1',
        inboxId: validInboxId,
        firstResponseTimeSeconds: 600,
        resolutionTimeSeconds: 3600,
        priorityRules: [
          {
            priority: 'urgent',
            firstResponseTimeSeconds: 300,
            resolutionTimeSeconds: 1800,
          },
        ],
        onlyDuringBusinessHours: false,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const result = SlaPolicySchema.safeParse(policy)
      expect(result.success).toBe(true)
    })
  })

  describe('4. TicketSlaStatusSchema & CalculateSlaDeadlinesInputSchema', () => {
    it('should validate persisted ticket SLA tracking status', () => {
      const status = {
        id: validUuid,
        ticketId: validUuid,
        policyId: validUuid,
        firstResponseDeadline: new Date(Date.now() + 1800000).toISOString(),
        resolutionDeadline: new Date(Date.now() + 14400000).toISOString(),
        isBreached: false,
        breachedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const result = TicketSlaStatusSchema.safeParse(status)
      expect(result.success).toBe(true)
    })

    it('should validate input for calculating SLA deadlines', () => {
      const calcInput = {
        ticketId: validUuid,
        policyId: validUuid,
        priority: 'urgent',
        openedAt: new Date().toISOString(),
      }
      const result = CalculateSlaDeadlinesInputSchema.safeParse(calcInput)
      expect(result.success).toBe(true)
    })
  })

  describe('5. Single Organization Guardrail (No account_id)', () => {
    it('should strictly NOT contain account_id or accountId in SLA schemas', () => {
      const createShape = CreateSlaPolicyInputSchema.shape as Record<string, unknown>
      const policyShape = SlaPolicySchema.shape as Record<string, unknown>
      const statusShape = TicketSlaStatusSchema.shape as Record<string, unknown>

      expect(createShape.accountId).toBeUndefined()
      expect(createShape.account_id).toBeUndefined()
      expect(policyShape.accountId).toBeUndefined()
      expect(policyShape.account_id).toBeUndefined()
      expect(statusShape.accountId).toBeUndefined()
      expect(statusShape.account_id).toBeUndefined()
    })
  })

  describe('6. Phase 5 Checklist Verification', () => {
    it('should verify Phase 5 checklist marks Task 5.7 as completed', () => {
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_5_CHECKLIST.md'), 'utf-8')
      expect(checklistContent).toContain(
        '- [x] **Task 5.7**: Skema validasi aturan SLA Policy per tingkat prioritas.',
      )
    })
  })
})
