import type {
  AgentCapacityOverride,
  AgentWorkload,
  CapacityPolicy,
  CreateCapacityPolicyInput,
  SetAgentCapacityOverrideInput,
  UpdateCapacityPolicyInput,
} from '@xatxoot/shared'
import { sql } from '../../db'
import { realtimeService } from '../realtime/realtime.service'
import { ticketService } from '../tickets/tickets.service'

const DEFAULT_GLOBAL_MAX_CAPACITY = 10

interface CapacityMemoryStore {
  policies: Map<string, CapacityPolicy>
  overrides: Map<string, AgentCapacityOverride>
}

const memoryStore: CapacityMemoryStore = {
  policies: new Map(),
  overrides: new Map(),
}

export function resetCapacityStore(): void {
  memoryStore.policies.clear()
  memoryStore.overrides.clear()
}

export class CapacityPolicyService {
  /**
   * Create a capacity policy
   */
  async createPolicy(input: CreateCapacityPolicyInput): Promise<CapacityPolicy> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const policy: CapacityPolicy = {
      id,
      name: input.name,
      description: input.description ?? null,
      maxActiveTickets: input.maxActiveTickets,
      inboxId: input.inboxId ?? null,
      excludeSnoozed: input.excludeSnoozed ?? false,
      active: input.active ?? true,
      createdAt: now,
      updatedAt: now,
    }

    memoryStore.policies.set(id, policy)

    try {
      await sql`
        INSERT INTO capacity_policies (
          id, name, description, max_active_tickets, inbox_id, exclude_snoozed, active, created_at, updated_at
        ) VALUES (
          ${policy.id}, ${policy.name}, ${policy.description}, ${policy.maxActiveTickets},
          ${policy.inboxId}, ${policy.excludeSnoozed}, ${policy.active}, ${policy.createdAt}, ${policy.updatedAt}
        )
      `
    } catch {
      // Memory fallback
    }

    return policy
  }

  async getPolicyById(id: string): Promise<CapacityPolicy | null> {
    try {
      const rows = await sql`
        SELECT
          id, name, description,
          max_active_tickets as "maxActiveTickets",
          inbox_id as "inboxId",
          exclude_snoozed as "excludeSnoozed",
          active, created_at as "createdAt", updated_at as "updatedAt"
        FROM capacity_policies
        WHERE id = ${id}
        LIMIT 1
      `
      if (rows.length > 0) {
        return rows[0] as unknown as CapacityPolicy
      }
    } catch {
      // Memory fallback
    }

    return memoryStore.policies.get(id) || null
  }

  async getEffectivePolicyForInbox(inboxId?: string | null): Promise<CapacityPolicy | null> {
    const all = await this.listPolicies()
    const active = all.filter((p) => p.active)

    if (inboxId) {
      const inboxPolicy = active.find((p) => p.inboxId === inboxId)
      if (inboxPolicy) return inboxPolicy
    }

    const globalDefault = active.find((p) => !p.inboxId)
    if (globalDefault) return globalDefault

    return active[0] || null
  }

  async listPolicies(): Promise<CapacityPolicy[]> {
    try {
      const rows = await sql`
        SELECT
          id, name, description,
          max_active_tickets as "maxActiveTickets",
          inbox_id as "inboxId",
          exclude_snoozed as "excludeSnoozed",
          active, created_at as "createdAt", updated_at as "updatedAt"
        FROM capacity_policies
        ORDER BY created_at DESC
      `
      if (rows.length > 0) {
        return rows as unknown as CapacityPolicy[]
      }
    } catch {
      // Memory fallback
    }

    return Array.from(memoryStore.policies.values())
  }

  async updatePolicy(id: string, input: UpdateCapacityPolicyInput): Promise<CapacityPolicy> {
    const existing = await this.getPolicyById(id)
    if (!existing) {
      throw new Error(`Capacity policy not found: ${id}`)
    }

    const now = new Date().toISOString()
    const updated: CapacityPolicy = {
      ...existing,
      name: input.name ?? existing.name,
      description: input.description !== undefined ? input.description : existing.description,
      maxActiveTickets: input.maxActiveTickets ?? existing.maxActiveTickets,
      inboxId: input.inboxId !== undefined ? input.inboxId : existing.inboxId,
      excludeSnoozed: input.excludeSnoozed ?? existing.excludeSnoozed,
      active: input.active ?? existing.active,
      updatedAt: now,
    }

    memoryStore.policies.set(id, updated)

    try {
      await sql`
        UPDATE capacity_policies
        SET
          name = ${updated.name},
          description = ${updated.description},
          max_active_tickets = ${updated.maxActiveTickets},
          inbox_id = ${updated.inboxId},
          exclude_snoozed = ${updated.excludeSnoozed},
          active = ${updated.active},
          updated_at = ${now}
        WHERE id = ${id}
      `
    } catch {
      // Memory fallback
    }

    return updated
  }

  async deletePolicy(id: string): Promise<boolean> {
    memoryStore.policies.delete(id)
    try {
      await sql`DELETE FROM capacity_policies WHERE id = ${id}`
      return true
    } catch {
      return true
    }
  }

  /**
   * Set custom capacity limits or on-leave status for a specific agent
   */
  async setAgentOverride(
    userId: string,
    input: SetAgentCapacityOverrideInput,
  ): Promise<AgentCapacityOverride> {
    const now = new Date().toISOString()
    const override: AgentCapacityOverride = {
      userId,
      maxActiveTickets: input.maxActiveTickets ?? null,
      onLeave: input.onLeave ?? false,
      leaveReason: input.leaveReason ?? null,
      leaveUntil: input.leaveUntil ?? null,
      updatedAt: now,
    }

    memoryStore.overrides.set(userId, override)

    try {
      await sql`
        INSERT INTO agent_capacity_overrides (
          user_id, max_active_tickets, on_leave, leave_reason, leave_until, updated_at
        ) VALUES (
          ${override.userId}, ${override.maxActiveTickets}, ${override.onLeave},
          ${override.leaveReason}, ${override.leaveUntil}, ${override.updatedAt}
        )
        ON CONFLICT (user_id) DO UPDATE SET
          max_active_tickets = ${override.maxActiveTickets},
          on_leave = ${override.onLeave},
          leave_reason = ${override.leaveReason},
          leave_until = ${override.leaveUntil},
          updated_at = ${override.updatedAt}
      `
    } catch {
      // Memory fallback
    }

    realtimeService.broadcast({
      event: 'agent.capacity_updated',
      data: { userId, override },
    })

    return override
  }

  async getAgentOverride(userId: string): Promise<AgentCapacityOverride | null> {
    try {
      const rows = await sql`
        SELECT
          user_id as "userId",
          max_active_tickets as "maxActiveTickets",
          on_leave as "onLeave",
          leave_reason as "leaveReason",
          leave_until as "leaveUntil",
          updated_at as "updatedAt"
        FROM agent_capacity_overrides
        WHERE user_id = ${userId}
        LIMIT 1
      `
      if (rows.length > 0) {
        return rows[0] as unknown as AgentCapacityOverride
      }
    } catch {
      // Memory fallback
    }

    return memoryStore.overrides.get(userId) || null
  }

  /**
   * Count active tickets assigned to an agent
   */
  async getActiveTicketCount(
    agentId: string,
    options?: { inboxId?: string; excludeSnoozed?: boolean },
  ): Promise<number> {
    const tickets = await ticketService.listTickets({ assigneeId: agentId })

    const activeTickets = tickets.filter((t) => {
      if (t.status === 'resolved') return false
      if (options?.excludeSnoozed && t.status === 'snoozed') return false
      return t.status === 'open' || t.status === 'pending' || t.status === 'snoozed'
    })

    return activeTickets.length
  }

  /**
   * Get agent capacity details including active workload and available slots
   */
  async getAgentCapacity(
    agentId: string,
    inboxId?: string,
  ): Promise<{
    maxCapacity: number
    activeCount: number
    availableCapacity: number
    isFull: boolean
    onLeave: boolean
  }> {
    const override = await this.getAgentOverride(agentId)
    const onLeave = override?.onLeave ?? false

    if (onLeave) {
      const activeCount = await this.getActiveTicketCount(agentId)
      return {
        maxCapacity: 0,
        activeCount,
        availableCapacity: 0,
        isFull: true,
        onLeave: true,
      }
    }

    // Determine max active tickets
    let maxCapacity = DEFAULT_GLOBAL_MAX_CAPACITY

    if (override && override.maxActiveTickets !== null && override.maxActiveTickets !== undefined) {
      maxCapacity = override.maxActiveTickets
    } else {
      const policy = await this.getEffectivePolicyForInbox(inboxId)
      if (policy) {
        maxCapacity = policy.maxActiveTickets
      }
    }

    const policy = await this.getEffectivePolicyForInbox(inboxId)
    const excludeSnoozed = policy?.excludeSnoozed ?? false

    const activeCount = await this.getActiveTicketCount(agentId, {
      inboxId,
      excludeSnoozed,
    })

    const availableCapacity = Math.max(0, maxCapacity - activeCount)
    const isFull = activeCount >= maxCapacity

    return {
      maxCapacity,
      activeCount,
      availableCapacity,
      isFull,
      onLeave,
    }
  }

  /**
   * Checks whether an agent can be assigned another ticket
   */
  async canAssignTicket(
    agentId: string,
    inboxId?: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const capacity = await this.getAgentCapacity(agentId, inboxId)

    if (capacity.onLeave) {
      return { allowed: false, reason: 'agent_on_leave' }
    }

    if (capacity.isFull) {
      return { allowed: false, reason: 'agent_at_maximum_capacity' }
    }

    return { allowed: true }
  }

  /**
   * Get workload statistics for an agent
   */
  async getAgentWorkload(
    agentId: string,
    displayName = 'Agent',
    email = '',
  ): Promise<AgentWorkload> {
    const capacity = await this.getAgentCapacity(agentId)
    const utilizationPercentage =
      capacity.maxCapacity > 0
        ? Math.min(100, Math.round((capacity.activeCount / capacity.maxCapacity) * 100))
        : 100

    return {
      userId: agentId,
      displayName,
      email,
      activeTicketCount: capacity.activeCount,
      maxCapacity: capacity.maxCapacity,
      availableCapacity: capacity.availableCapacity,
      utilizationPercentage,
      isFull: capacity.isFull,
      onLeave: capacity.onLeave,
    }
  }

  /**
   * List workloads across agents
   */
  async listAllWorkloads(): Promise<AgentWorkload[]> {
    const workloads: AgentWorkload[] = []
    const userIds = new Set<string>()

    for (const userId of memoryStore.overrides.keys()) {
      userIds.add(userId)
    }

    for (const uid of userIds) {
      const wl = await this.getAgentWorkload(uid)
      workloads.push(wl)
    }

    return workloads
  }
}

export const capacityService = new CapacityPolicyService()
