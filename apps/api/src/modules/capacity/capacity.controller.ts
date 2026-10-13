import {
  CreateCapacityPolicyInputSchema,
  SetAgentCapacityOverrideInputSchema,
  UpdateCapacityPolicyInputSchema,
} from '@xatxoot/shared'
import type { Context } from 'hono'
import { capacityService } from './capacity.service'

export class CapacityController {
  async listPolicies(c: Context) {
    const policies = await capacityService.listPolicies()
    return c.json(policies)
  }

  async getPolicy(c: Context) {
    const id = c.req.param('id')
    const policy = await capacityService.getPolicyById(id)
    if (!policy) {
      return c.json({ error: 'Capacity policy not found' }, 404)
    }
    return c.json(policy)
  }

  async createPolicy(c: Context) {
    try {
      const body = await c.req.json()
      const parsed = CreateCapacityPolicyInputSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ error: 'Validation error', details: parsed.error.issues }, 400)
      }

      const policy = await capacityService.createPolicy(parsed.data)
      return c.json(policy, 201)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create capacity policy'
      return c.json({ error: message }, 500)
    }
  }

  async updatePolicy(c: Context) {
    try {
      const id = c.req.param('id')
      const body = await c.req.json()
      const parsed = UpdateCapacityPolicyInputSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ error: 'Validation error', details: parsed.error.issues }, 400)
      }

      const updated = await capacityService.updatePolicy(id, parsed.data)
      return c.json(updated)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update capacity policy'
      return c.json({ error: message }, 500)
    }
  }

  async deletePolicy(c: Context) {
    const id = c.req.param('id')
    const success = await capacityService.deletePolicy(id)
    return c.json({ success })
  }

  async getAgentCapacity(c: Context) {
    const agentId = c.req.param('agentId')
    const inboxId = c.req.query('inboxId')
    const status = await capacityService.getAgentCapacity(agentId, inboxId)
    return c.json(status)
  }

  async setAgentOverride(c: Context) {
    try {
      const agentId = c.req.param('agentId')
      const body = await c.req.json()
      const parsed = SetAgentCapacityOverrideInputSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ error: 'Validation error', details: parsed.error.issues }, 400)
      }

      const override = await capacityService.setAgentOverride(agentId, parsed.data)
      return c.json(override)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to set capacity override'
      return c.json({ error: message }, 500)
    }
  }

  async getWorkloadOverview(c: Context) {
    const workloads = await capacityService.listAllWorkloads()
    return c.json(workloads)
  }
}

export const capacityController = new CapacityController()
