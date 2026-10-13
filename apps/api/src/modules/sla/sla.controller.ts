import { CreateSlaPolicyInputSchema, UpdateSlaPolicyInputSchema } from '@xatxoot/shared'
import type { Context } from 'hono'
import { slaService } from './sla.service'

export class SlaController {
  async listPolicies(c: Context) {
    const policies = await slaService.listPolicies()
    return c.json(policies)
  }

  async getPolicy(c: Context) {
    const id = c.req.param('id')
    const policy = await slaService.getPolicyById(id)
    if (!policy) {
      return c.json({ error: 'SLA policy not found' }, 404)
    }
    return c.json(policy)
  }

  async createPolicy(c: Context) {
    try {
      const body = await c.req.json()
      const parsed = CreateSlaPolicyInputSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ error: 'Validation error', details: parsed.error.issues }, 400)
      }

      const policy = await slaService.createPolicy(parsed.data)
      return c.json(policy, 201)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create SLA policy'
      return c.json({ error: message }, 500)
    }
  }

  async updatePolicy(c: Context) {
    try {
      const id = c.req.param('id')
      const body = await c.req.json()
      const parsed = UpdateSlaPolicyInputSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ error: 'Validation error', details: parsed.error.issues }, 400)
      }

      const updated = await slaService.updatePolicy(id, parsed.data)
      return c.json(updated)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update SLA policy'
      return c.json({ error: message }, 500)
    }
  }

  async deletePolicy(c: Context) {
    const id = c.req.param('id')
    const success = await slaService.deletePolicy(id)
    return c.json({ success })
  }

  async evaluate(c: Context) {
    try {
      const result = await slaService.evaluateAllActiveTickets()
      return c.json({ success: true, result })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to evaluate SLA'
      return c.json({ error: message }, 500)
    }
  }

  async getTicketSlaStatus(c: Context) {
    const ticketId = c.req.param('ticketId')
    const status = await slaService.getTicketSlaStatus(ticketId)
    if (!status) {
      return c.json({ error: 'Ticket SLA status not found' }, 404)
    }
    return c.json(status)
  }

  async attachSla(c: Context) {
    try {
      const ticketId = c.req.param('ticketId')
      const body = await c.req.json().catch(() => ({}))
      const status = await slaService.attachSlaToTicket({
        ticketId,
        policyId: body.policyId,
        priority: body.priority,
      })
      return c.json(status)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to attach SLA'
      return c.json({ error: message }, 500)
    }
  }
}

export const slaController = new SlaController()
