import { beforeEach, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AutomationRule, CreateAutomationRuleInput } from '@xatxoot/shared'
import { Hono } from 'hono'
import { resetTicketStore, ticketService } from '../tickets/tickets.service'
import { automationRoutes } from './automation-rules.routes'
import {
  AutomationRulesEngine,
  automationRulesService,
  resetAutomationRulesStore,
} from './automation-rules.service'

describe('Automation Rules Evaluator & Action Executor (Task 4.11 - apps/api)', () => {
  const rootDir = join(import.meta.dir, '..', '..', '..', '..', '..')
  const validTeamId = '123e4567-e89b-12d3-a456-426614174001'
  const validAgentId = '123e4567-e89b-12d3-a456-426614174002'
  const validInboxId = '123e4567-e89b-12d3-a456-426614174003'
  const validConversationId = '123e4567-e89b-12d3-a456-426614174004'

  let app: Hono
  let engine: AutomationRulesEngine

  beforeEach(() => {
    resetAutomationRulesStore()
    resetTicketStore()
    engine = new AutomationRulesEngine()
    app = new Hono()
    app.route('/api/v1/automation-rules', automationRoutes)
  })

  describe('Condition Evaluator Logic', () => {
    it('should evaluate equal_to and not_equal_to operators', () => {
      expect(
        engine.evaluateCondition(
          { attribute: 'inbox_id', operator: 'equal_to', value: validInboxId },
          { inbox_id: validInboxId },
        ),
      ).toBe(true)

      expect(
        engine.evaluateCondition(
          { attribute: 'inbox_id', operator: 'equal_to', value: validInboxId },
          { inbox_id: 'other-inbox' },
        ),
      ).toBe(false)

      expect(
        engine.evaluateCondition(
          { attribute: 'status', operator: 'not_equal_to', value: 'resolved' },
          { status: 'open' },
        ),
      ).toBe(true)

      expect(
        engine.evaluateCondition(
          { attribute: 'status', operator: 'not_equal_to', value: 'resolved' },
          { status: 'resolved' },
        ),
      ).toBe(false)
    })

    it('should evaluate contains and does_not_contain operators (case-insensitive)', () => {
      expect(
        engine.evaluateCondition(
          { attribute: 'content', operator: 'contains', value: 'billing' },
          { content: 'Halo kak, saya mau tanya soal Billing invoice' },
        ),
      ).toBe(true)

      expect(
        engine.evaluateCondition(
          { attribute: 'content', operator: 'contains', value: 'refund' },
          { content: 'Halo kak, saya mau tanya soal Billing' },
        ),
      ).toBe(false)

      expect(
        engine.evaluateCondition(
          { attribute: 'content', operator: 'does_not_contain', value: 'urgent' },
          { content: 'Pertanyaan biasa saja' },
        ),
      ).toBe(true)
    })

    it('should evaluate starts_with and ends_with operators', () => {
      expect(
        engine.evaluateCondition(
          { attribute: 'content', operator: 'starts_with', value: '/help' },
          { content: '/help cara pesan' },
        ),
      ).toBe(true)

      expect(
        engine.evaluateCondition(
          { attribute: 'email', operator: 'ends_with', value: '@xatxoot.com' },
          { email: 'agent@xatxoot.com' },
        ),
      ).toBe(true)
    })

    it('should evaluate is_present and is_not_present operators', () => {
      expect(
        engine.evaluateCondition(
          { attribute: 'assignee_id', operator: 'is_present' },
          { assignee_id: validAgentId },
        ),
      ).toBe(true)

      expect(
        engine.evaluateCondition(
          { attribute: 'assignee_id', operator: 'is_not_present' },
          { assignee_id: null },
        ),
      ).toBe(true)
    })

    it('should evaluate in_list operator', () => {
      expect(
        engine.evaluateCondition(
          { attribute: 'priority', operator: 'in_list', value: ['urgent', 'high'] },
          { priority: 'urgent' },
        ),
      ).toBe(true)

      expect(
        engine.evaluateCondition(
          { attribute: 'priority', operator: 'in_list', value: ['urgent', 'high'] },
          { priority: 'low' },
        ),
      ).toBe(false)

      // Context array attribute contains value
      expect(
        engine.evaluateCondition(
          { attribute: 'labels', operator: 'in_list', value: ['finance', 'billing'] },
          { labels: ['billing', 'vip'] },
        ),
      ).toBe(true)
    })

    it('should evaluate multiple conditions with AND conjunction', () => {
      const conditions = [
        { attribute: 'content', operator: 'contains' as const, value: 'refund' },
        { attribute: 'inbox_id', operator: 'equal_to' as const, value: validInboxId },
      ]

      expect(
        engine.evaluateAllConditions(conditions, {
          content: 'Mohon info proses refund dana',
          inbox_id: validInboxId,
        }),
      ).toBe(true)

      expect(
        engine.evaluateAllConditions(conditions, {
          content: 'Mohon info proses refund dana',
          inbox_id: 'other-inbox',
        }),
      ).toBe(false)
    })
  })

  describe('Chained Action Execution (Eksekutor Aksi Berantai)', () => {
    it('should execute chained actions: assign_team, change_priority, and add_internal_note on ticket', async () => {
      const ticket = await ticketService.createTicket({
        conversationId: validConversationId,
        status: 'open',
        priority: 'low',
      })

      const rule: CreateAutomationRuleInput = {
        name: 'Escalate Billing Issues to Finance',
        eventName: 'message_created',
        conditions: [{ attribute: 'content', operator: 'contains', value: 'tagihan' }],
        actions: [
          { actionName: 'assign_team', actionParams: { teamId: validTeamId } },
          { actionName: 'change_priority', actionParams: { priority: 'urgent' } },
          {
            actionName: 'add_internal_note',
            actionParams: {
              note: 'Tiket dieskalasi otomatis oleh Automation Rules: masalah tagihan',
            },
          },
        ],
        active: true,
      }

      await automationRulesService.createRule(rule)

      // Trigger evaluation for message_created event
      const context = {
        content: 'Halo, ada kendala pada tagihan bulanan saya',
        conversationId: validConversationId,
        ticketId: ticket.id,
      }

      const results = await automationRulesService.evaluateAndExecute('message_created', context)
      expect(results.length).toBe(1)
      expect(results[0].ruleName).toBe('Escalate Billing Issues to Finance')
      expect(results[0].executedActions.length).toBe(3)

      // Verify ticket state updated in database/service
      const updatedTicket = await ticketService.getTicketById(ticket.id)
      expect(updatedTicket?.teamId).toBe(validTeamId)
      expect(updatedTicket?.priority).toBe('urgent')
      expect(updatedTicket?.internalNote).toContain('Tiket dieskalasi otomatis')
    })

    it('should not execute actions if conditions do not match', async () => {
      const ticket = await ticketService.createTicket({
        conversationId: validConversationId,
        status: 'open',
      })

      await automationRulesService.createRule({
        name: 'Auto Resolve Greetings',
        eventName: 'message_created',
        conditions: [{ attribute: 'content', operator: 'equal_to', value: 'selesai' }],
        actions: [{ actionName: 'change_status', actionParams: { status: 'resolved' } }],
        active: true,
      })

      const context = {
        content: 'Halo selamat pagi',
        ticketId: ticket.id,
      }

      const results = await automationRulesService.evaluateAndExecute('message_created', context)
      expect(results.length).toBe(0)

      const unchangedTicket = await ticketService.getTicketById(ticket.id)
      expect(unchangedTicket?.status).toBe('open')
    })

    it('should not execute inactive rules', async () => {
      const ticket = await ticketService.createTicket({
        conversationId: validConversationId,
        status: 'open',
      })

      await automationRulesService.createRule({
        name: 'Inactive Auto Close',
        eventName: 'message_created',
        conditions: [{ attribute: 'content', operator: 'contains', value: 'tutup' }],
        actions: [{ actionName: 'change_status', actionParams: { status: 'resolved' } }],
        active: false,
      })

      const context = {
        content: 'Tolong tutup tiket ini',
        ticketId: ticket.id,
      }

      const results = await automationRulesService.evaluateAndExecute('message_created', context)
      expect(results.length).toBe(0)

      const ticketState = await ticketService.getTicketById(ticket.id)
      expect(ticketState?.status).toBe('open')
    })
  })

  describe('Management REST API Endpoints', () => {
    it('should support full Automation Rules CRUD via HTTP API', async () => {
      // 1. Create rule
      const postRes = await app.request('/api/v1/automation-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Assign Sales',
          eventName: 'conversation_created',
          conditions: [{ attribute: 'inbox_id', operator: 'equal_to', value: validInboxId }],
          actions: [{ actionName: 'assign_team', actionParams: { teamId: validTeamId } }],
          active: true,
        }),
      })
      expect(postRes.status).toBe(201)
      const postJson = await postRes.json()
      expect(postJson.success).toBe(true)
      const ruleId = postJson.data.id

      // 2. List rules
      const listRes = await app.request('/api/v1/automation-rules')
      expect(listRes.status).toBe(200)
      const listJson = await listRes.json()
      expect(listJson.data.length).toBe(1)

      // 3. Get rule by ID
      const getRes = await app.request(`/api/v1/automation-rules/${ruleId}`)
      expect(getRes.status).toBe(200)
      const getJson = await getRes.json()
      expect(getJson.data.name).toBe('Assign Sales')

      // 4. Update rule
      const patchRes = await app.request(`/api/v1/automation-rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      })
      expect(patchRes.status).toBe(200)
      const patchJson = await patchRes.json()
      expect(patchJson.data.active).toBe(false)

      // 5. Delete rule
      const delRes = await app.request(`/api/v1/automation-rules/${ruleId}`, {
        method: 'DELETE',
      })
      expect(delRes.status).toBe(200)
      const afterDelList = await app.request('/api/v1/automation-rules')
      const afterDelJson = await afterDelList.json()
      expect(afterDelJson.data.length).toBe(0)
    })

    it('POST /api/v1/automation-rules/evaluate should evaluate context manually', async () => {
      await automationRulesService.createRule({
        name: 'Auto Tag VIP',
        eventName: 'conversation_created',
        conditions: [{ attribute: 'is_vip', operator: 'equal_to', value: true }],
        actions: [{ actionName: 'add_label', actionParams: { label: 'VIP' } }],
        active: true,
      })

      const evalRes = await app.request('/api/v1/automation-rules/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: 'conversation_created',
          context: { is_vip: true },
        }),
      })

      expect(evalRes.status).toBe(200)
      const evalJson = await evalRes.json()
      expect(evalJson.success).toBe(true)
      expect(evalJson.data.matchedRules.length).toBe(1)
      expect(evalJson.data.matchedRules[0].ruleName).toBe('Auto Tag VIP')
    })
  })

  describe('Single Organization Rule Guardrail', () => {
    it('must NOT require or contain account_id in Automation Rules model or parameters', async () => {
      const rule = await automationRulesService.createRule({
        name: 'Guardrail Rule',
        eventName: 'message_created',
        conditions: [{ attribute: 'x', operator: 'is_present' }],
        actions: [{ actionName: 'mute_conversation' }],
        active: true,
      })

      expect(Object.keys(rule)).not.toContain('account_id')
      expect(Object.keys(rule)).not.toContain('accountId')
    })
  })

  describe('Phase 4 Checklist Synchronization', () => {
    it('should mark Task 4.11 as completed in docs/PHASE_4_CHECKLIST.md', () => {
      const checklistPath = join(rootDir, 'docs', 'PHASE_4_CHECKLIST.md')
      const content = readFileSync(checklistPath, 'utf-8')
      expect(content).toContain('- [x] **Task 4.11 (TDD - Automation Rules Evaluator)**:')
    })
  })
})
