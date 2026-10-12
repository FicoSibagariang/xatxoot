import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  AutomationRuleActionSchema,
  AutomationRuleActionTypeSchema,
  AutomationRuleConditionSchema,
  AutomationRuleEventSchema,
  AutomationRuleOperatorSchema,
  AutomationRuleSchema,
  CreateAutomationRuleInputSchema,
  UpdateAutomationRuleInputSchema,
} from './schemas'

describe('Automation Rules DSL Conditions & Actions (Task 4.7 - packages/shared)', () => {
  const rootDir = join(import.meta.dir, '..', '..', '..')
  const validTeamId = '123e4567-e89b-12d3-a456-426614174001'
  const validAgentId = '123e4567-e89b-12d3-a456-426614174002'
  const validInboxId = '123e4567-e89b-12d3-a456-426614174003'

  describe('AutomationRuleEventSchema', () => {
    it('should accept valid event names', () => {
      const validEvents = [
        'conversation_created',
        'conversation_updated',
        'conversation_opened',
        'conversation_resolved',
        'message_created',
      ]
      for (const event of validEvents) {
        expect(AutomationRuleEventSchema.safeParse(event).success).toBe(true)
      }
    })

    it('should reject invalid event names', () => {
      expect(AutomationRuleEventSchema.safeParse('invalid_event').success).toBe(false)
      expect(AutomationRuleEventSchema.safeParse('').success).toBe(false)
      expect(AutomationRuleEventSchema.safeParse(123).success).toBe(false)
    })
  })

  describe('AutomationRuleOperatorSchema', () => {
    it('should accept valid operators', () => {
      const validOperators = [
        'equal_to',
        'not_equal_to',
        'contains',
        'does_not_contain',
        'starts_with',
        'ends_with',
        'is_present',
        'is_not_present',
        'in_list',
      ]
      for (const op of validOperators) {
        expect(AutomationRuleOperatorSchema.safeParse(op).success).toBe(true)
      }
    })

    it('should reject invalid operators', () => {
      expect(AutomationRuleOperatorSchema.safeParse('like').success).toBe(false)
      expect(AutomationRuleOperatorSchema.safeParse('regex').success).toBe(false)
    })
  })

  describe('AutomationRuleConditionSchema', () => {
    it('should validate valid condition instances', () => {
      const c1 = {
        attribute: 'content',
        operator: 'contains',
        value: 'Billing',
      }
      expect(AutomationRuleConditionSchema.safeParse(c1).success).toBe(true)

      const c2 = {
        attribute: 'inbox_id',
        operator: 'equal_to',
        value: validInboxId,
      }
      expect(AutomationRuleConditionSchema.safeParse(c2).success).toBe(true)

      const c3 = {
        attribute: 'labels',
        operator: 'in_list',
        value: ['vip', 'urgent'],
      }
      expect(AutomationRuleConditionSchema.safeParse(c3).success).toBe(true)

      const c4 = {
        attribute: 'assignee_id',
        operator: 'is_not_present',
      }
      expect(AutomationRuleConditionSchema.safeParse(c4).success).toBe(true)
    })

    it('should reject condition with empty attribute or invalid operator', () => {
      expect(
        AutomationRuleConditionSchema.safeParse({ attribute: '', operator: 'contains', value: 'x' })
          .success,
      ).toBe(false)
      expect(
        AutomationRuleConditionSchema.safeParse({
          attribute: 'content',
          operator: 'invalid_op',
          value: 'x',
        }).success,
      ).toBe(false)
    })
  })

  describe('AutomationRuleActionSchema', () => {
    it('should validate valid action instances', () => {
      const a1 = {
        actionName: 'assign_team',
        actionParams: { teamId: validTeamId },
      }
      expect(AutomationRuleActionSchema.safeParse(a1).success).toBe(true)

      const a2 = {
        actionName: 'add_label',
        actionParams: { labels: ['invoice', 'finance'] },
      }
      expect(AutomationRuleActionSchema.safeParse(a2).success).toBe(true)

      const a3 = {
        actionName: 'change_status',
        actionParams: { status: 'resolved' },
      }
      expect(AutomationRuleActionSchema.safeParse(a3).success).toBe(true)

      const a4 = {
        actionName: 'send_message',
        actionParams: { message: 'Halo, tim kami akan segera membantu Anda.' },
      }
      expect(AutomationRuleActionSchema.safeParse(a4).success).toBe(true)

      const a5 = {
        actionName: 'mute_conversation',
      }
      expect(AutomationRuleActionSchema.safeParse(a5).success).toBe(true)
    })

    it('should reject invalid action names', () => {
      expect(
        AutomationRuleActionSchema.safeParse({
          actionName: 'delete_database',
          actionParams: {},
        }).success,
      ).toBe(false)
    })
  })

  describe('CreateAutomationRuleInputSchema & AutomationRuleSchema', () => {
    it('should validate complete automation rule creation input', () => {
      const rule = {
        name: 'Auto Assign Billing Tickets to Finance',
        eventName: 'message_created',
        conditions: [
          {
            attribute: 'content',
            operator: 'contains',
            value: 'Invoice',
          },
          {
            attribute: 'inbox_id',
            operator: 'equal_to',
            value: validInboxId,
          },
        ],
        actions: [
          {
            actionName: 'assign_team',
            actionParams: { teamId: validTeamId },
          },
          {
            actionName: 'add_label',
            actionParams: { labels: ['billing', 'invoice'] },
          },
        ],
        active: true,
      }
      const result = CreateAutomationRuleInputSchema.safeParse(rule)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Auto Assign Billing Tickets to Finance')
        expect(result.data.conditions).toHaveLength(2)
        expect(result.data.actions).toHaveLength(2)
      }
    })

    it('should reject rule without conditions or without actions', () => {
      const noConditions = {
        name: 'Rule Tanpa Kondisi',
        eventName: 'message_created',
        conditions: [],
        actions: [{ actionName: 'mute_conversation' }],
      }
      expect(CreateAutomationRuleInputSchema.safeParse(noConditions).success).toBe(false)

      const noActions = {
        name: 'Rule Tanpa Aksi',
        eventName: 'message_created',
        conditions: [{ attribute: 'content', operator: 'contains', value: 'help' }],
        actions: [],
      }
      expect(CreateAutomationRuleInputSchema.safeParse(noActions).success).toBe(false)
    })

    it('should validate update automation rule input', () => {
      const update = {
        name: 'Nama Rule Diperbarui',
        active: false,
      }
      expect(UpdateAutomationRuleInputSchema.safeParse(update).success).toBe(true)
    })

    it('should validate full automation rule entity', () => {
      const ruleEntity = {
        id: '123e4567-e89b-12d3-a456-426614174099',
        name: 'Auto Assign VIP',
        eventName: 'conversation_created',
        conditions: [
          {
            attribute: 'labels',
            operator: 'contains',
            value: 'vip',
          },
        ],
        actions: [
          {
            actionName: 'assign_agent',
            actionParams: { agentId: validAgentId },
          },
        ],
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      expect(AutomationRuleSchema.safeParse(ruleEntity).success).toBe(true)
    })
  })

  describe('Single Organization Rule', () => {
    it('should strictly NOT contain account_id or accountId in Automation Rules schemas', () => {
      const ruleShape = CreateAutomationRuleInputSchema.shape as Record<string, unknown>
      const conditionShape = AutomationRuleConditionSchema.shape as Record<string, unknown>
      const actionShape = AutomationRuleActionSchema.shape as Record<string, unknown>

      expect(ruleShape.accountId).toBeUndefined()
      expect(ruleShape.account_id).toBeUndefined()
      expect(conditionShape.accountId).toBeUndefined()
      expect(conditionShape.account_id).toBeUndefined()
      expect(actionShape.accountId).toBeUndefined()
      expect(actionShape.account_id).toBeUndefined()
    })
  })

  describe('Checklist Verification', () => {
    it('should verify Phase 4 checklist marks Task 4.7 as completed', () => {
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_4_CHECKLIST.md'), 'utf-8')
      expect(checklistContent).toContain(
        '- [x] **Task 4.7**: Definisi DSL kondisi & aksi untuk Automation Rules Engine.',
      )
    })
  })
})
