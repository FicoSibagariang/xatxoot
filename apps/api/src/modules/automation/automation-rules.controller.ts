import {
  type AutomationRuleEvent,
  CreateAutomationRuleInputSchema,
  UpdateAutomationRuleInputSchema,
} from '@xatxoot/shared'
import type { Context } from 'hono'
import { automationRulesService } from './automation-rules.service'

export class AutomationRulesController {
  async createRule(c: Context) {
    try {
      const body = await c.req.json()
      const parsed = CreateAutomationRuleInputSchema.safeParse(body)
      if (!parsed.success) {
        return c.json(
          { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' },
          400,
        )
      }
      const rule = await automationRulesService.createRule(parsed.data)
      return c.json({ success: true, data: rule }, 201)
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Error' },
        500,
      )
    }
  }

  async listRules(c: Context) {
    const eventName = c.req.query('eventName')
    const activeQuery = c.req.query('active')
    const active = activeQuery !== undefined ? activeQuery === 'true' : undefined

    const data = await automationRulesService.listRules({
      eventName: eventName || undefined,
      active,
    })
    return c.json({ success: true, data })
  }

  async getRule(c: Context) {
    const id = c.req.param('id')
    const rule = await automationRulesService.getRuleById(id)
    if (!rule) {
      return c.json({ success: false, error: 'Rule not found' }, 404)
    }
    return c.json({ success: true, data: rule })
  }

  async updateRule(c: Context) {
    try {
      const id = c.req.param('id')
      const body = await c.req.json()
      const parsed = UpdateAutomationRuleInputSchema.safeParse(body)
      if (!parsed.success) {
        return c.json(
          { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' },
          400,
        )
      }
      const updated = await automationRulesService.updateRule(id, parsed.data)
      return c.json({ success: true, data: updated })
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Error' },
        500,
      )
    }
  }

  async deleteRule(c: Context) {
    const id = c.req.param('id')
    await automationRulesService.deleteRule(id)
    return c.json({ success: true, message: 'Rule deleted' })
  }

  async evaluate(c: Context) {
    try {
      const body = await c.req.json()
      const eventName = body.eventName as AutomationRuleEvent
      const context = (body.context || {}) as Record<string, unknown>

      const results = await automationRulesService.evaluateAndExecute(eventName, context)
      return c.json({ success: true, data: { matchedRules: results } })
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Error' },
        500,
      )
    }
  }
}

export const automationRulesController = new AutomationRulesController()
