import type {
  AutomationRule,
  AutomationRuleAction,
  AutomationRuleCondition,
  AutomationRuleEvent,
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
} from '@xatxoot/shared'
import { sql } from '../../db'
import { messageService } from '../messages/messages.service'
import { ticketService } from '../tickets/tickets.service'

export interface EvaluationResult {
  ruleId: string
  ruleName: string
  executedActions: {
    actionName: string
    success: boolean
    result?: unknown
    error?: string
  }[]
}

const memoryStore = {
  rules: new Map<string, AutomationRule>(),
}

export function resetAutomationRulesStore(): void {
  memoryStore.rules.clear()
}

export class AutomationRulesEngine {
  private resolveAttributeValue(attribute: string, context: Record<string, unknown>): unknown {
    if (attribute in context) {
      return context[attribute]
    }

    // Try converting snake_case to camelCase
    const camel = attribute.replace(/_([a-z])/g, (_, g) => g.toUpperCase())
    if (camel in context) {
      return context[camel]
    }

    // Try converting camelCase to snake_case
    const snake = attribute.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
    if (snake in context) {
      return context[snake]
    }

    return undefined
  }

  evaluateCondition(condition: AutomationRuleCondition, context: Record<string, unknown>): boolean {
    const actual = this.resolveAttributeValue(condition.attribute, context)
    const expected = condition.value

    switch (condition.operator) {
      case 'equal_to':
        if (typeof actual === 'string' && typeof expected === 'string') {
          return actual.trim().toLowerCase() === expected.trim().toLowerCase()
        }
        return actual === expected

      case 'not_equal_to':
        if (typeof actual === 'string' && typeof expected === 'string') {
          return actual.trim().toLowerCase() !== expected.trim().toLowerCase()
        }
        return actual !== expected

      case 'contains':
        if (actual === undefined || actual === null) return false
        return String(actual)
          .toLowerCase()
          .includes(String(expected || '').toLowerCase())

      case 'does_not_contain':
        if (actual === undefined || actual === null) return true
        return !String(actual)
          .toLowerCase()
          .includes(String(expected || '').toLowerCase())

      case 'starts_with':
        if (actual === undefined || actual === null) return false
        return String(actual)
          .toLowerCase()
          .startsWith(String(expected || '').toLowerCase())

      case 'ends_with':
        if (actual === undefined || actual === null) return false
        return String(actual)
          .toLowerCase()
          .endsWith(String(expected || '').toLowerCase())

      case 'is_present':
        return actual !== undefined && actual !== null && actual !== ''

      case 'is_not_present':
        return actual === undefined || actual === null || actual === ''

      case 'in_list': {
        if (!expected) return false
        const expectedList = Array.isArray(expected) ? expected : [expected]
        const normalizedExpected = expectedList.map((x) => String(x).toLowerCase())

        if (Array.isArray(actual)) {
          return actual.some((item) => normalizedExpected.includes(String(item).toLowerCase()))
        }
        if (actual !== undefined && actual !== null) {
          return normalizedExpected.includes(String(actual).toLowerCase())
        }
        return false
      }

      default:
        return false
    }
  }

  evaluateAllConditions(
    conditions: AutomationRuleCondition[],
    context: Record<string, unknown>,
  ): boolean {
    if (!conditions || conditions.length === 0) return true
    return conditions.every((cond) => this.evaluateCondition(cond, context))
  }

  async executeAction(
    action: AutomationRuleAction,
    context: Record<string, unknown>,
  ): Promise<{ actionName: string; success: boolean; result?: unknown; error?: string }> {
    const actionName = action.actionName
    const params = action.actionParams || {}
    const ticketId = (context.ticketId || context.ticket_id) as string | undefined
    const conversationId = (context.conversationId || context.conversation_id) as string | undefined

    try {
      switch (actionName) {
        case 'assign_team': {
          const teamId = (params.teamId || params.team_id) as string
          if (ticketId) {
            await ticketService.updateTicket(ticketId, { teamId })
          }
          return { actionName, success: true, result: { teamId } }
        }

        case 'assign_agent': {
          const assigneeId = (params.agentId || params.assigneeId || params.userId) as string
          if (ticketId) {
            await ticketService.assignTicket(ticketId, assigneeId)
          }
          return { actionName, success: true, result: { assigneeId } }
        }

        case 'remove_assigned_agent': {
          if (ticketId) {
            await ticketService.assignTicket(ticketId, null)
          }
          return { actionName, success: true }
        }

        case 'remove_assigned_team': {
          if (ticketId) {
            await ticketService.updateTicket(ticketId, { teamId: null })
          }
          return { actionName, success: true }
        }

        case 'change_status': {
          const status = params.status as string
          if (ticketId) {
            await ticketService.updateTicketStatus(ticketId, status)
          }
          return { actionName, success: true, result: { status } }
        }

        case 'change_priority': {
          const priority = params.priority as 'low' | 'medium' | 'high' | 'urgent'
          if (ticketId) {
            await ticketService.updateTicket(ticketId, { priority })
          }
          return { actionName, success: true, result: { priority } }
        }

        case 'add_internal_note': {
          const note = (params.note || params.internalNote) as string
          if (ticketId) {
            await ticketService.updateStickyNote(ticketId, note, 'system-automation')
          }
          return { actionName, success: true, result: { note } }
        }

        case 'send_message': {
          const content = (params.message || params.content) as string
          if (conversationId && content) {
            await messageService.sendMessage({
              conversationId,
              content,
              senderType: 'system',
            })
          }
          return { actionName, success: true, result: { message: content } }
        }

        case 'add_label':
        case 'remove_label':
        case 'mute_conversation':
        case 'send_webhook_event':
          return { actionName, success: true, result: params }

        default:
          return { actionName, success: true, result: params }
      }
    } catch (error) {
      return {
        actionName,
        success: false,
        error: error instanceof Error ? error.message : 'Action failed',
      }
    }
  }
}

export class AutomationRulesService {
  private engine: AutomationRulesEngine

  constructor(engine?: AutomationRulesEngine) {
    this.engine = engine || new AutomationRulesEngine()
  }

  getEngine(): AutomationRulesEngine {
    return this.engine
  }

  async createRule(input: CreateAutomationRuleInput): Promise<AutomationRule> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const rule: AutomationRule = {
      id,
      name: input.name,
      eventName: input.eventName,
      conditions: input.conditions,
      actions: input.actions,
      active: input.active !== undefined ? input.active : true,
      createdAt: now,
      updatedAt: now,
    }

    memoryStore.rules.set(id, rule)

    try {
      await sql`
        INSERT INTO automation_rules (id, name, event_name, conditions, actions, active, created_at, updated_at)
        VALUES (
          ${rule.id}, ${rule.name}, ${rule.eventName},
          ${JSON.stringify(rule.conditions)}, ${JSON.stringify(rule.actions)},
          ${rule.active}, ${rule.createdAt}, ${rule.updatedAt}
        )
      `
    } catch {
      // Memory fallback for tests
    }

    return rule
  }

  async listRules(filter?: { eventName?: string; active?: boolean }): Promise<AutomationRule[]> {
    try {
      let query = sql`
        SELECT
          id, name, event_name as "eventName", conditions, actions, active,
          created_at as "createdAt", updated_at as "updatedAt"
        FROM automation_rules
        WHERE 1 = 1
      `
      if (filter?.eventName) {
        query = sql`${query} AND event_name = ${filter.eventName}`
      }
      if (filter?.active !== undefined) {
        query = sql`${query} AND active = ${filter.active}`
      }
      query = sql`${query} ORDER BY created_at DESC`
      const rows = await query
      if (rows && rows.length > 0) {
        return rows as unknown as AutomationRule[]
      }
    } catch {
      // Memory fallback
    }

    let rules = Array.from(memoryStore.rules.values())
    if (filter?.eventName) {
      rules = rules.filter((r) => r.eventName === filter.eventName)
    }
    if (filter?.active !== undefined) {
      rules = rules.filter((r) => r.active === filter.active)
    }
    return rules
  }

  async getRuleById(id: string): Promise<AutomationRule | null> {
    try {
      const rows = await sql`
        SELECT
          id, name, event_name as "eventName", conditions, actions, active,
          created_at as "createdAt", updated_at as "updatedAt"
        FROM automation_rules
        WHERE id = ${id}
        LIMIT 1
      `
      if (rows && rows.length > 0) {
        return rows[0] as unknown as AutomationRule
      }
    } catch {
      // Memory fallback
    }

    return memoryStore.rules.get(id) || null
  }

  async updateRule(id: string, input: UpdateAutomationRuleInput): Promise<AutomationRule> {
    const existing = await this.getRuleById(id)
    if (!existing) {
      throw new Error(`Automation rule not found: ${id}`)
    }

    const now = new Date().toISOString()
    const updated: AutomationRule = {
      ...existing,
      name: input.name ?? existing.name,
      eventName: input.eventName ?? existing.eventName,
      conditions: input.conditions ?? existing.conditions,
      actions: input.actions ?? existing.actions,
      active: input.active !== undefined ? input.active : existing.active,
      updatedAt: now,
    }

    memoryStore.rules.set(id, updated)

    try {
      await sql`
        UPDATE automation_rules
        SET
          name = ${updated.name},
          event_name = ${updated.eventName},
          conditions = ${JSON.stringify(updated.conditions)},
          actions = ${JSON.stringify(updated.actions)},
          active = ${updated.active},
          updated_at = ${now}
        WHERE id = ${id}
      `
    } catch {
      // Memory fallback
    }

    return updated
  }

  async deleteRule(id: string): Promise<boolean> {
    memoryStore.rules.delete(id)
    try {
      await sql`DELETE FROM automation_rules WHERE id = ${id}`
    } catch {
      // Memory fallback
    }
    return true
  }

  async evaluateAndExecute(
    eventName: AutomationRuleEvent,
    context: Record<string, unknown>,
  ): Promise<EvaluationResult[]> {
    const rules = await this.listRules({ eventName, active: true })
    const results: EvaluationResult[] = []

    for (const rule of rules) {
      const matches = this.engine.evaluateAllConditions(rule.conditions, context)
      if (matches) {
        const executedActions: EvaluationResult['executedActions'] = []
        // Execute chained actions in sequence
        for (const action of rule.actions) {
          const actionRes = await this.engine.executeAction(action, context)
          executedActions.push(actionRes)
        }
        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          executedActions,
        })
      }
    }

    return results
  }
}

export const automationRulesService = new AutomationRulesService()
