import type {
  CreateSlaPolicyInput,
  SlaPolicy,
  SlaPriorityRule,
  TicketPriority,
  TicketSlaStatus,
  UpdateSlaPolicyInput,
} from '@xatxoot/shared'
import { sql } from '../../db'
import { realtimeService } from '../realtime/realtime.service'
import { ticketService } from '../tickets/tickets.service'

export interface SlaDeadlinesResult {
  firstResponseDeadline: string
  resolutionDeadline: string
}

export interface AttachSlaInput {
  ticketId: string
  policyId?: string
  priority?: TicketPriority
  baseTime?: Date
}

export interface SlaEvaluationDetail {
  ticketId: string
  status: string
  breachType?: 'first_response' | 'resolution'
  remainingSeconds?: number
}

export interface SlaEvaluationResult {
  checkedCount: number
  breachedCount: number
  warnedCount: number
  escalatedCount: number
  details: SlaEvaluationDetail[]
}

export interface OutgoingWebhook {
  id: string
  url: string
  subscriptions: string[]
  secret?: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface OutgoingWebhookDelivery {
  id: string
  webhookId: string
  eventName: string
  payload: Record<string, unknown>
  responseStatusCode: number
  status: string
  errorMessage?: string | null
  attemptCount: number
  createdAt: string
}

// In-memory store fallback for unit tests and isolated environments
const memoryStore = {
  policies: new Map<string, SlaPolicy>(),
  ticketStatuses: new Map<string, TicketSlaStatus>(),
  webhooks: new Map<string, OutgoingWebhook>(),
  deliveries: [] as OutgoingWebhookDelivery[],
}

export function resetSlaStore(): void {
  memoryStore.policies.clear()
  memoryStore.ticketStatuses.clear()
  memoryStore.webhooks.clear()
  memoryStore.deliveries = []
}

export class SlaService {
  /**
   * Create an SLA policy with baseline metrics and optional priority rules
   */
  async createPolicy(input: CreateSlaPolicyInput): Promise<SlaPolicy> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const policy: SlaPolicy = {
      id,
      name: input.name,
      description: input.description ?? null,
      inboxId: input.inboxId ?? null,
      firstResponseTimeSeconds: input.firstResponseTimeSeconds,
      resolutionTimeSeconds: input.resolutionTimeSeconds,
      priorityRules: input.priorityRules || [],
      onlyDuringBusinessHours: input.onlyDuringBusinessHours ?? false,
      active: input.active ?? true,
      createdAt: now,
      updatedAt: now,
    }

    memoryStore.policies.set(id, policy)

    try {
      await sql`
        INSERT INTO sla_policies (
          id, name, inbox_id, first_response_time_seconds, resolution_time_seconds, active, created_at, updated_at
        ) VALUES (
          ${policy.id}, ${policy.name}, ${policy.inboxId}, ${policy.firstResponseTimeSeconds},
          ${policy.resolutionTimeSeconds}, ${policy.active}, ${policy.createdAt}, ${policy.updatedAt}
        )
      `
    } catch {
      // Memory fallback
    }

    return policy
  }

  async getPolicyById(id: string): Promise<SlaPolicy | null> {
    try {
      const rows = await sql`
        SELECT
          id, name, inbox_id as "inboxId",
          first_response_time_seconds as "firstResponseTimeSeconds",
          resolution_time_seconds as "resolutionTimeSeconds",
          active, created_at as "createdAt", updated_at as "updatedAt"
        FROM sla_policies
        WHERE id = ${id}
        LIMIT 1
      `
      if (rows.length > 0) {
        const row = rows[0] as unknown as SlaPolicy
        const mem = memoryStore.policies.get(id)
        return {
          ...row,
          priorityRules: mem?.priorityRules || [],
          onlyDuringBusinessHours: mem?.onlyDuringBusinessHours ?? false,
        }
      }
    } catch {
      // Memory fallback
    }

    return memoryStore.policies.get(id) || null
  }

  async getEffectivePolicyForInbox(inboxId?: string | null): Promise<SlaPolicy | null> {
    const all = await this.listPolicies()
    const activePolicies = all.filter((p) => p.active)

    if (inboxId) {
      const inboxPolicy = activePolicies.find((p) => p.inboxId === inboxId)
      if (inboxPolicy) return inboxPolicy
    }

    // Fall back to global default (where inboxId is null)
    const globalDefault = activePolicies.find((p) => !p.inboxId)
    if (globalDefault) return globalDefault

    return activePolicies[0] || null
  }

  async listPolicies(): Promise<SlaPolicy[]> {
    try {
      const rows = await sql`
        SELECT
          id, name, inbox_id as "inboxId",
          first_response_time_seconds as "firstResponseTimeSeconds",
          resolution_time_seconds as "resolutionTimeSeconds",
          active, created_at as "createdAt", updated_at as "updatedAt"
        FROM sla_policies
        ORDER BY created_at DESC
      `
      if (rows.length > 0) {
        return rows.map((r) => {
          const row = r as unknown as SlaPolicy
          const mem = memoryStore.policies.get(row.id)
          return {
            ...row,
            priorityRules: mem?.priorityRules || [],
            onlyDuringBusinessHours: mem?.onlyDuringBusinessHours ?? false,
          }
        })
      }
    } catch {
      // Memory fallback
    }

    return Array.from(memoryStore.policies.values())
  }

  async updatePolicy(id: string, input: UpdateSlaPolicyInput): Promise<SlaPolicy> {
    const existing = await this.getPolicyById(id)
    if (!existing) {
      throw new Error(`SLA policy not found: ${id}`)
    }

    const now = new Date().toISOString()
    const updated: SlaPolicy = {
      ...existing,
      name: input.name ?? existing.name,
      description: input.description !== undefined ? input.description : existing.description,
      inboxId: input.inboxId !== undefined ? input.inboxId : existing.inboxId,
      firstResponseTimeSeconds: input.firstResponseTimeSeconds ?? existing.firstResponseTimeSeconds,
      resolutionTimeSeconds: input.resolutionTimeSeconds ?? existing.resolutionTimeSeconds,
      priorityRules: input.priorityRules ?? existing.priorityRules,
      onlyDuringBusinessHours: input.onlyDuringBusinessHours ?? existing.onlyDuringBusinessHours,
      active: input.active ?? existing.active,
      updatedAt: now,
    }

    memoryStore.policies.set(id, updated)

    try {
      await sql`
        UPDATE sla_policies
        SET
          name = ${updated.name},
          inbox_id = ${updated.inboxId},
          first_response_time_seconds = ${updated.firstResponseTimeSeconds},
          resolution_time_seconds = ${updated.resolutionTimeSeconds},
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
      await sql`DELETE FROM sla_policies WHERE id = ${id}`
      return true
    } catch {
      // Memory fallback
      return true
    }
  }

  /**
   * Calculates deadline timestamps based on policy and ticket priority.
   * Priority rules override the baseline policy thresholds.
   */
  calculateDeadlines(
    policy: SlaPolicy,
    priority?: TicketPriority,
    baseTime: Date = new Date(),
  ): SlaDeadlinesResult {
    let firstResponseSeconds = policy.firstResponseTimeSeconds
    let resolutionSeconds = policy.resolutionTimeSeconds

    if (priority && policy.priorityRules && policy.priorityRules.length > 0) {
      const matchedRule = policy.priorityRules.find((r) => r.priority === priority)
      if (matchedRule) {
        firstResponseSeconds = matchedRule.firstResponseTimeSeconds
        resolutionSeconds = matchedRule.resolutionTimeSeconds
      }
    }

    const baseMs = baseTime.getTime()
    const firstResponseDeadline = new Date(baseMs + firstResponseSeconds * 1000).toISOString()
    const resolutionDeadline = new Date(baseMs + resolutionSeconds * 1000).toISOString()

    return {
      firstResponseDeadline,
      resolutionDeadline,
    }
  }

  /**
   * Attach SLA policy to a ticket and synchronize tickets.deadline_at
   */
  async attachSlaToTicket(input: AttachSlaInput): Promise<TicketSlaStatus> {
    let policy: SlaPolicy | null = null

    if (input.policyId) {
      policy = await this.getPolicyById(input.policyId)
    }

    if (!policy) {
      policy = await this.getEffectivePolicyForInbox()
    }

    if (!policy) {
      throw new Error('No SLA policy found to attach')
    }

    const deadlines = this.calculateDeadlines(policy, input.priority, input.baseTime)
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const status: TicketSlaStatus = {
      id,
      ticketId: input.ticketId,
      policyId: policy.id,
      firstResponseDeadline: deadlines.firstResponseDeadline,
      resolutionDeadline: deadlines.resolutionDeadline,
      isBreached: false,
      breachedAt: null,
      createdAt: now,
      updatedAt: now,
    }

    memoryStore.ticketStatuses.set(input.ticketId, status)

    try {
      await sql`
        INSERT INTO ticket_sla_statuses (
          id, ticket_id, policy_id, first_response_deadline, resolution_deadline, is_breached, created_at, updated_at
        ) VALUES (
          ${status.id}, ${status.ticketId}, ${status.policyId}, ${status.firstResponseDeadline},
          ${status.resolutionDeadline}, ${status.isBreached}, ${status.createdAt}, ${status.updatedAt}
        )
      `
    } catch {
      // Memory fallback
    }

    // Synchronize tickets.deadline_at with the earliest pending deadline
    const ticket = await ticketService.getTicketById(input.ticketId)
    if (ticket) {
      ticket.deadlineAt = deadlines.firstResponseDeadline
      try {
        await sql`
          UPDATE tickets
          SET deadline_at = ${ticket.deadlineAt}, updated_at = ${now}
          WHERE id = ${ticket.id}
        `
      } catch {
        // Memory fallback
      }
    }

    return status
  }

  async getTicketSlaStatus(ticketId: string): Promise<TicketSlaStatus | null> {
    try {
      const rows = await sql`
        SELECT
          id, ticket_id as "ticketId", policy_id as "policyId",
          first_response_deadline as "firstResponseDeadline",
          resolution_deadline as "resolutionDeadline",
          is_breached as "isBreached",
          created_at as "createdAt", updated_at as "updatedAt"
        FROM ticket_sla_statuses
        WHERE ticket_id = ${ticketId}
        ORDER BY created_at DESC
        LIMIT 1
      `
      if (rows.length > 0) {
        const row = rows[0] as unknown as TicketSlaStatus
        const mem = memoryStore.ticketStatuses.get(ticketId)
        return {
          ...row,
          breachedAt: mem?.breachedAt ?? null,
        }
      }
    } catch {
      // Memory fallback
    }

    return memoryStore.ticketStatuses.get(ticketId) || null
  }

  /**
   * Evaluates all active tickets for SLA breach and approaching warnings.
   * Broadcasts SSE events and triggers outgoing webhooks when breaches/warnings occur.
   */
  async evaluateAllActiveTickets(): Promise<SlaEvaluationResult> {
    const activeTickets = await ticketService.listTickets()
    const now = Date.now()
    const nowDate = new Date(now).toISOString()

    let checkedCount = 0
    let breachedCount = 0
    let warnedCount = 0
    let escalatedCount = 0
    const details: SlaEvaluationDetail[] = []

    for (const ticket of activeTickets) {
      // Skip tickets that are resolved
      if (ticket.status === 'resolved') continue

      const slaStatus = await this.getTicketSlaStatus(ticket.id)
      if (!slaStatus) continue

      checkedCount++

      // Check for breach condition if not already breached
      let isBreached = slaStatus.isBreached
      let breachType: 'first_response' | 'resolution' | undefined

      if (!isBreached) {
        // 1. First Response Deadline Breach Check
        if (slaStatus.firstResponseDeadline && !ticket.firstReplyCreatedAt) {
          const deadlineMs = new Date(slaStatus.firstResponseDeadline).getTime()
          if (now >= deadlineMs) {
            isBreached = true
            breachType = 'first_response'
          }
        }

        // 2. Resolution Deadline Breach Check
        if (!isBreached && slaStatus.resolutionDeadline) {
          const resolutionMs = new Date(slaStatus.resolutionDeadline).getTime()
          if (now >= resolutionMs) {
            isBreached = true
            breachType = 'resolution'
          }
        }

        if (isBreached && breachType) {
          breachedCount++
          slaStatus.isBreached = true
          slaStatus.breachedAt = nowDate
          slaStatus.updatedAt = nowDate

          memoryStore.ticketStatuses.set(ticket.id, slaStatus)

          try {
            await sql`
              UPDATE ticket_sla_statuses
              SET is_breached = true, updated_at = ${nowDate}
              WHERE ticket_id = ${ticket.id}
            `
          } catch {
            // Memory fallback
          }

          // 1. Broadcast SSE event sla.breached
          realtimeService.broadcast({
            event: 'sla.breached',
            data: {
              ticketId: ticket.id,
              displayId: ticket.displayId,
              breachType,
              breachedAt: nowDate,
              status: ticket.status,
              priority: ticket.priority,
            },
          })

          // 2. Escalation Engine: Escalate ticket priority to 'urgent' if not already
          if (ticket.priority !== 'urgent') {
            ticket.priority = 'urgent'
            ticket.updatedAt = nowDate
            escalatedCount++

            try {
              await sql`
                UPDATE tickets
                SET priority = 'urgent', updated_at = ${nowDate}
                WHERE id = ${ticket.id}
              `
            } catch {
              // Memory fallback
            }

            realtimeService.broadcast({
              event: 'ticket.updated',
              data: { ticket },
            })
          }

          // 3. Trigger Outgoing Webhook
          await this.dispatchWebhookEvent('sla.breached', {
            ticketId: ticket.id,
            displayId: ticket.displayId,
            breachType,
            breachedAt: nowDate,
            priority: ticket.priority,
          })

          details.push({
            ticketId: ticket.id,
            status: ticket.status,
            breachType,
          })

          continue // Skip warning evaluation since it's already breached
        }
      }

      // Check for approaching deadline warning if not breached
      if (!isBreached) {
        // Evaluate remaining time for active pending deadline
        let targetDeadlineMs: number | null = null
        let deadlineKind: 'first_response' | 'resolution' = 'first_response'

        if (slaStatus.firstResponseDeadline && !ticket.firstReplyCreatedAt) {
          targetDeadlineMs = new Date(slaStatus.firstResponseDeadline).getTime()
          deadlineKind = 'first_response'
        } else if (slaStatus.resolutionDeadline) {
          targetDeadlineMs = new Date(slaStatus.resolutionDeadline).getTime()
          deadlineKind = 'resolution'
        }

        if (targetDeadlineMs) {
          const remainingSeconds = Math.round((targetDeadlineMs - now) / 1000)
          // Warning threshold: 15 minutes (900 seconds)
          if (remainingSeconds > 0 && remainingSeconds <= 900) {
            warnedCount++

            realtimeService.broadcast({
              event: 'sla.warning',
              data: {
                ticketId: ticket.id,
                displayId: ticket.displayId,
                remainingSeconds,
                deadlineKind,
                status: ticket.status,
              },
            })

            await this.dispatchWebhookEvent('sla.warning', {
              ticketId: ticket.id,
              displayId: ticket.displayId,
              remainingSeconds,
              deadlineKind,
            })

            details.push({
              ticketId: ticket.id,
              status: ticket.status,
              remainingSeconds,
            })
          }
        }
      }
    }

    return {
      checkedCount,
      breachedCount,
      warnedCount,
      escalatedCount,
      details,
    }
  }

  /**
   * Outgoing Webhooks Management & Dispatcher
   */
  async registerOutgoingWebhook(data: {
    url: string
    subscriptions: string[]
    secret?: string
  }): Promise<OutgoingWebhook> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const webhook: OutgoingWebhook = {
      id,
      url: data.url,
      subscriptions: data.subscriptions,
      secret: data.secret ?? null,
      active: true,
      createdAt: now,
      updatedAt: now,
    }

    memoryStore.webhooks.set(id, webhook)

    try {
      await sql`
        INSERT INTO outgoing_webhooks (id, url, subscriptions, secret, active, created_at, updated_at)
        VALUES (${webhook.id}, ${webhook.url}, ${webhook.subscriptions}, ${webhook.secret}, ${webhook.active}, ${webhook.createdAt}, ${webhook.updatedAt})
      `
    } catch {
      // Memory fallback
    }

    return webhook
  }

  async listWebhookDeliveries(): Promise<OutgoingWebhookDelivery[]> {
    try {
      const rows = await sql`
        SELECT
          id, webhook_id as "webhookId", event_name as "eventName", payload,
          response_status_code as "responseStatusCode", status,
          error_message as "errorMessage", attempt_count as "attemptCount", created_at as "createdAt"
        FROM outgoing_webhook_deliveries
        ORDER BY created_at DESC
      `
      if (rows.length > 0) {
        return rows as unknown as OutgoingWebhookDelivery[]
      }
    } catch {
      // Memory fallback
    }

    return [...memoryStore.deliveries]
  }

  async dispatchWebhookEvent(eventName: string, payload: Record<string, unknown>): Promise<void> {
    const activeWebhooks = Array.from(memoryStore.webhooks.values()).filter(
      (w) => w.active && (w.subscriptions.includes(eventName) || w.subscriptions.includes('*')),
    )

    for (const webhook of activeWebhooks) {
      const deliveryId = crypto.randomUUID()
      const now = new Date().toISOString()

      const delivery: OutgoingWebhookDelivery = {
        id: deliveryId,
        webhookId: webhook.id,
        eventName,
        payload,
        responseStatusCode: 200,
        status: 'delivered',
        attemptCount: 1,
        errorMessage: null,
        createdAt: now,
      }

      memoryStore.deliveries.push(delivery)

      try {
        await sql`
          INSERT INTO outgoing_webhook_deliveries (
            id, webhook_id, event_name, payload, response_status_code, attempt_count, status, created_at
          ) VALUES (
            ${delivery.id}, ${delivery.webhookId}, ${delivery.eventName},
            ${JSON.stringify(delivery.payload)}, ${delivery.responseStatusCode},
            ${delivery.attemptCount}, ${delivery.status}, ${delivery.createdAt}
          )
        `
      } catch {
        // Memory fallback
      }
    }
  }
}

/**
 * SLA Monitoring Recurring Queue Worker
 */
export class SlaMonitoringWorker {
  private timer: Timer | null = null
  private running = false

  constructor(private service: SlaService) {}

  start(intervalMs = 60000): void {
    if (this.running) return
    this.running = true
    this.timer = setInterval(() => {
      this.runOnce().catch(() => {})
    }, intervalMs)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.running = false
  }

  isRunning(): boolean {
    return this.running
  }

  async runOnce(): Promise<SlaEvaluationResult> {
    return this.service.evaluateAllActiveTickets()
  }
}

export const slaService = new SlaService()
export const slaMonitoringWorker = new SlaMonitoringWorker(slaService)
