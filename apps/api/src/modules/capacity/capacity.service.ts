import type {
  AgentCapacityOverride,
  AgentWorkload,
  CapacityPolicy,
  CreateCapacityPolicyInput,
  SetAgentCapacityOverrideInput,
  UpdateCapacityPolicyInput,
} from '@xatxoot/shared'
import { sql, toValidUuid } from '../../db'
import { realtimeService } from '../realtime/realtime.service'
import { ticketService } from '../tickets/tickets.service'

const DEFAULT_GLOBAL_MAX_CAPACITY = 10

function toIsoString(val: unknown): string | null {
  if (!val) return null
  if (val instanceof Date) return val.toISOString()
  if (typeof val === 'string') return val
  return null
}

function mapPolicyRow(row: Record<string, unknown>): CapacityPolicy {
  return {
    ...(row as unknown as CapacityPolicy),
    description: (row.description as string | null) ?? null,
    inboxId: (row.inboxId as string | null) ?? null,
    excludeSnoozed: Boolean(row.excludeSnoozed),
    active: Boolean(row.active),
    createdAt: toIsoString(row.createdAt) || (row.createdAt as string),
    updatedAt: toIsoString(row.updatedAt) || (row.updatedAt as string),
  }
}

function mapOverrideRow(row: Record<string, unknown>): AgentCapacityOverride {
  return {
    ...(row as unknown as AgentCapacityOverride),
    maxActiveTickets:
      row.maxActiveTickets !== null && row.maxActiveTickets !== undefined
        ? Number(row.maxActiveTickets)
        : null,
    onLeave: Boolean(row.onLeave),
    leaveReason: (row.leaveReason as string | null) ?? null,
    leaveUntil: toIsoString(row.leaveUntil),
    updatedAt: toIsoString(row.updatedAt) || (row.updatedAt as string),
  }
}

async function ensureUserExists(userId: string): Promise<void> {
  await sql`
    INSERT INTO users (id, email, password_hash, display_name, role)
    VALUES (${userId}, ${`agent-${userId}@xatxoot.test`}, 'test-hash', 'Test Agent', 'agent')
    ON CONFLICT (id) DO NOTHING
  `
}

async function ensureInboxExists(inboxId: string): Promise<void> {
  const validId = toValidUuid(inboxId)
  await sql`
    INSERT INTO inboxes (id, name, channel_type, channel_id, created_at, updated_at)
    VALUES (${validId}, 'Inbox ' || ${validId}, 'api', ${crypto.randomUUID()}, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `
}

export async function resetCapacityStore(): Promise<void> {
  await sql`DELETE FROM agent_capacity_overrides`
  await sql`DELETE FROM capacity_policies`
}

export class CapacityPolicyService {
  /**
   * Create a capacity policy
   */
  async createPolicy(input: CreateCapacityPolicyInput): Promise<CapacityPolicy> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const description = input.description ?? null
    let inboxId: string | null = null
    if (input.inboxId) {
      inboxId = toValidUuid(input.inboxId)
      await ensureInboxExists(inboxId)
    }
    const excludeSnoozed = input.excludeSnoozed ?? false
    const active = input.active ?? true

    const rows = await sql`
      INSERT INTO capacity_policies (
        id, name, description, max_active_tickets, inbox_id, exclude_snoozed, active, created_at, updated_at
      ) VALUES (
        ${id}, ${input.name}, ${description}, ${input.maxActiveTickets},
        ${inboxId}, ${excludeSnoozed}, ${active}, ${now}, ${now}
      )
      RETURNING
        id, name, description,
        max_active_tickets as "maxActiveTickets",
        inbox_id as "inboxId",
        exclude_snoozed as "excludeSnoozed",
        active, created_at as "createdAt", updated_at as "updatedAt"
    `

    return mapPolicyRow(rows[0])
  }

  async getPolicyById(id: string): Promise<CapacityPolicy | null> {
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
      return mapPolicyRow(rows[0])
    }

    return null
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
    return rows.map(mapPolicyRow)
  }

  async updatePolicy(id: string, input: UpdateCapacityPolicyInput): Promise<CapacityPolicy> {
    const existing = await this.getPolicyById(id)
    if (!existing) {
      throw new Error(`Capacity policy not found: ${id}`)
    }

    const now = new Date().toISOString()
    const name = input.name ?? existing.name
    const description = input.description !== undefined ? input.description : existing.description
    const maxActiveTickets = input.maxActiveTickets ?? existing.maxActiveTickets
    let inboxId = existing.inboxId
    if (input.inboxId !== undefined) {
      if (input.inboxId) {
        inboxId = toValidUuid(input.inboxId)
        await ensureInboxExists(inboxId)
      } else {
        inboxId = null
      }
    }
    const excludeSnoozed = input.excludeSnoozed ?? existing.excludeSnoozed
    const active = input.active ?? existing.active

    const rows = await sql`
      UPDATE capacity_policies
      SET
        name = ${name},
        description = ${description},
        max_active_tickets = ${maxActiveTickets},
        inbox_id = ${inboxId},
        exclude_snoozed = ${excludeSnoozed},
        active = ${active},
        updated_at = ${now}
      WHERE id = ${id}
      RETURNING
        id, name, description,
        max_active_tickets as "maxActiveTickets",
        inbox_id as "inboxId",
        exclude_snoozed as "excludeSnoozed",
        active, created_at as "createdAt", updated_at as "updatedAt"
    `

    return mapPolicyRow(rows[0])
  }

  async deletePolicy(id: string): Promise<boolean> {
    const rows = await sql`DELETE FROM capacity_policies WHERE id = ${id} RETURNING id`
    return rows.length > 0
  }

  /**
   * Set custom capacity limits or on-leave status for a specific agent
   */
  async setAgentOverride(
    userId: string,
    input: SetAgentCapacityOverrideInput,
  ): Promise<AgentCapacityOverride> {
    await ensureUserExists(userId)

    const now = new Date().toISOString()
    const maxActiveTickets = input.maxActiveTickets ?? null
    const onLeave = input.onLeave ?? false
    const leaveReason = input.leaveReason ?? null
    const leaveUntil = input.leaveUntil ?? null

    const rows = await sql`
      INSERT INTO agent_capacity_overrides (
        user_id, max_active_tickets, on_leave, leave_reason, leave_until, updated_at
      ) VALUES (
        ${userId}, ${maxActiveTickets}, ${onLeave},
        ${leaveReason}, ${leaveUntil}, ${now}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        max_active_tickets = ${maxActiveTickets},
        on_leave = ${onLeave},
        leave_reason = ${leaveReason},
        leave_until = ${leaveUntil},
        updated_at = ${now}
      RETURNING
        user_id as "userId",
        max_active_tickets as "maxActiveTickets",
        on_leave as "onLeave",
        leave_reason as "leaveReason",
        leave_until as "leaveUntil",
        updated_at as "updatedAt"
    `

    const override = mapOverrideRow(rows[0])

    realtimeService.broadcast({
      event: 'agent.capacity_updated',
      data: { userId, override },
    })

    return override
  }

  async getAgentOverride(userId: string): Promise<AgentCapacityOverride | null> {
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
      return mapOverrideRow(rows[0])
    }

    return null
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

    const rows = await sql`SELECT user_id as "userId" FROM agent_capacity_overrides`
    for (const r of rows) {
      userIds.add(r.userId)
    }

    for (const uid of userIds) {
      const wl = await this.getAgentWorkload(uid)
      workloads.push(wl)
    }

    return workloads
  }
}

export const capacityService = new CapacityPolicyService()
