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

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'object') return value as T
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return fallback
}

function toIsoString(val: unknown): string | null {
  if (!val) return null
  if (val instanceof Date) return val.toISOString()
  if (typeof val === 'string') return val
  return null
}

function mapPolicyRow(row: Record<string, unknown>): SlaPolicy {
  return {
    ...(row as unknown as SlaPolicy),
    description: (row.description as string | null) ?? null,
    inboxId: (row.inboxId as string | null) ?? null,
    priorityRules: parseJsonField(row.priorityRules, []),
    onlyDuringBusinessHours: Boolean(row.onlyDuringBusinessHours),
    createdAt: toIsoString(row.createdAt) || (row.createdAt as string),
    updatedAt: toIsoString(row.updatedAt) || (row.updatedAt as string),
  }
}

function mapTicketSlaStatusRow(row: Record<string, unknown>): TicketSlaStatus {
  return {
    ...(row as unknown as TicketSlaStatus),
    firstResponseDeadline: toIsoString(row.firstResponseDeadline),
    resolutionDeadline: toIsoString(row.resolutionDeadline),
    breachedAt: toIsoString(row.breachedAt),
    createdAt: toIsoString(row.createdAt) || (row.createdAt as string),
    updatedAt: toIsoString(row.updatedAt) || (row.updatedAt as string),
  }
}

export async function resetSlaStore(): Promise<void> {
  await sql`DELETE FROM outgoing_webhook_deliveries`
  await sql`DELETE FROM outgoing_webhooks`
  await sql`DELETE FROM ticket_sla_status_extras`
  await sql`DELETE FROM ticket_sla_statuses`
  await sql`DELETE FROM sla_policy_extras`
  await sql`DELETE FROM sla_policies`
}

export class SlaService {
  /**
   * Create an SLA policy with baseline metrics and optional priority rules
   */
  async createPolicy(input: CreateSlaPolicyInput): Promise<SlaPolicy> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const description = input.description ?? null
    const inboxId = input.inboxId ?? null
    const priorityRules = JSON.stringify(input.priorityRules || [])
    const onlyDuringBusinessHours = input.onlyDuringBusinessHours ?? false
    const active = input.active ?? true

    await sql`
      INSERT INTO sla_policies (
        id, name, inbox_id, first_response_time_seconds, resolution_time_seconds,
        active, created_at, updated_at
      ) VALUES (
        ${id}, ${input.name}, ${inboxId}, ${input.firstResponseTimeSeconds},
        ${input.resolutionTimeSeconds},
        ${active}, ${now}, ${now}
      )
    `

    await sql`
      INSERT INTO sla_policy_extras (
        id, description, priority_rules, only_during_business_hours
      ) VALUES (
        ${id}, ${description}, ${priorityRules}, ${onlyDuringBusinessHours}
      )
      ON CONFLICT (id) DO UPDATE SET
        description = EXCLUDED.description,
        priority_rules = EXCLUDED.priority_rules,
        only_during_business_hours = EXCLUDED.only_during_business_hours
    `

    const policy = await this.getPolicyById(id)
    if (!policy) {
      throw new Error(`Failed to retrieve created SLA policy: ${id}`)
    }
    return policy
  }

  async getPolicyById(id: string): Promise<SlaPolicy | null> {
    const rows = await sql`
      SELECT
        p.id, p.name, e.description, p.inbox_id as "inboxId",
        p.first_response_time_seconds as "firstResponseTimeSeconds",
        p.resolution_time_seconds as "resolutionTimeSeconds",
        e.priority_rules as "priorityRules",
        COALESCE(e.only_during_business_hours, false) as "onlyDuringBusinessHours",
        p.active, p.created_at as "createdAt", p.updated_at as "updatedAt"
      FROM sla_policies p
      LEFT JOIN sla_policy_extras e ON p.id = e.id
      WHERE p.id = ${id}
      LIMIT 1
    `
    if (rows.length > 0) {
      return mapPolicyRow(rows[0])
    }
    return null
  }

  async getEffectivePolicyForInbox(inboxId?: string | null): Promise<SlaPolicy | null> {
    const all = await this.listPolicies()
    const activePolicies = all.filter((p) => p.active)

    if (inboxId) {
      const inboxPolicy = activePolicies.find((p) => p.inboxId === inboxId)
      if (inboxPolicy) return inboxPolicy
    }

    const globalDefault = activePolicies.find((p) => !p.inboxId)
    if (globalDefault) return globalDefault

    return activePolicies[0] || null
  }

  async listPolicies(): Promise<SlaPolicy[]> {
    const rows = await sql`
      SELECT
        p.id, p.name, e.description, p.inbox_id as "inboxId",
        p.first_response_time_seconds as "firstResponseTimeSeconds",
        p.resolution_time_seconds as "resolutionTimeSeconds",
        e.priority_rules as "priorityRules",
        COALESCE(e.only_during_business_hours, false) as "onlyDuringBusinessHours",
        p.active, p.created_at as "createdAt", p.updated_at as "updatedAt"
      FROM sla_policies p
      LEFT JOIN sla_policy_extras e ON p.id = e.id
      ORDER BY p.created_at DESC
    `
    return rows.map(mapPolicyRow)
  }

  async updatePolicy(id: string, input: UpdateSlaPolicyInput): Promise<SlaPolicy> {
    const existing = await this.getPolicyById(id)
    if (!existing) {
      throw new Error(`SLA policy not found: ${id}`)
    }

    const now = new Date().toISOString()
    const name = input.name ?? existing.name
    const description = input.description !== undefined ? input.description : existing.description
    const inboxId = input.inboxId !== undefined ? input.inboxId : existing.inboxId
    const firstResponseTimeSeconds =
      input.firstResponseTimeSeconds ?? existing.firstResponseTimeSeconds
    const resolutionTimeSeconds = input.resolutionTimeSeconds ?? existing.resolutionTimeSeconds
    const priorityRules =
      input.priorityRules !== undefined
        ? JSON.stringify(input.priorityRules)
        : JSON.stringify(existing.priorityRules || [])
    const onlyDuringBusinessHours =
      input.onlyDuringBusinessHours !== undefined
        ? input.onlyDuringBusinessHours
        : existing.onlyDuringBusinessHours
    const active = input.active !== undefined ? input.active : existing.active

    await sql`
      UPDATE sla_policies
      SET
        name = ${name},
        inbox_id = ${inboxId},
        first_response_time_seconds = ${firstResponseTimeSeconds},
        resolution_time_seconds = ${resolutionTimeSeconds},
        active = ${active},
        updated_at = ${now}
      WHERE id = ${id}
    `

    await sql`
      INSERT INTO sla_policy_extras (
        id, description, priority_rules, only_during_business_hours
      ) VALUES (
        ${id}, ${description}, ${priorityRules}, ${onlyDuringBusinessHours}
      )
      ON CONFLICT (id) DO UPDATE SET
        description = EXCLUDED.description,
        priority_rules = EXCLUDED.priority_rules,
        only_during_business_hours = EXCLUDED.only_during_business_hours
    `

    const policy = await this.getPolicyById(id)
    if (!policy) {
      throw new Error(`Failed to retrieve created SLA policy: ${id}`)
    }
    return policy
  }

  async deletePolicy(id: string): Promise<boolean> {
    const rows = await sql`DELETE FROM sla_policies WHERE id = ${id} RETURNING id`
    return rows.length > 0
  }

  /**
   * Calculates SLA first-response and resolution deadlines
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

    await sql`
      INSERT INTO ticket_sla_statuses (
        id, ticket_id, policy_id, first_response_deadline, resolution_deadline, is_breached, created_at, updated_at
      ) VALUES (
        ${id}, ${input.ticketId}, ${policy.id}, ${deadlines.firstResponseDeadline},
        ${deadlines.resolutionDeadline}, false, ${now}, ${now}
      )
    `

    const status = await this.getTicketSlaStatus(input.ticketId)
    if (!status) {
      throw new Error(`Failed to retrieve ticket SLA status: ${input.ticketId}`)
    }

    // Synchronize tickets.deadline_at with the earliest pending deadline
    const ticket = await ticketService.getTicketById(input.ticketId)
    if (ticket) {
      await ticketService.updateTicket(ticket.id, {
        deadlineAt: deadlines.firstResponseDeadline,
      })
    }

    return status
  }

  async getTicketSlaStatus(ticketId: string): Promise<TicketSlaStatus | null> {
    const rows = await sql`
      SELECT
        tss.id, tss.ticket_id as "ticketId", tss.policy_id as "policyId",
        tss.first_response_deadline as "firstResponseDeadline",
        tss.resolution_deadline as "resolutionDeadline",
        tss.is_breached as "isBreached",
        tsse.breached_at as "breachedAt",
        tss.created_at as "createdAt", tss.updated_at as "updatedAt"
      FROM ticket_sla_statuses tss
      LEFT JOIN ticket_sla_status_extras tsse ON tss.id = tsse.id
      WHERE tss.ticket_id = ${ticketId}
      ORDER BY tss.created_at DESC
      LIMIT 1
    `
    if (rows.length > 0) {
      return mapTicketSlaStatusRow(rows[0])
    }

    return null
  }

  /**
   * Evaluates all active tickets for SLA breach and approaching warnings.
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
      if (ticket.status === 'resolved') continue

      const slaStatus = await this.getTicketSlaStatus(ticket.id)
      if (!slaStatus) continue

      checkedCount++

      let isBreached = slaStatus.isBreached
      let breachType: 'first_response' | 'resolution' | undefined

      if (!isBreached) {
        if (slaStatus.firstResponseDeadline && !ticket.firstReplyCreatedAt) {
          const deadlineMs = new Date(slaStatus.firstResponseDeadline).getTime()
          if (now >= deadlineMs) {
            isBreached = true
            breachType = 'first_response'
          }
        }

        if (!isBreached && slaStatus.resolutionDeadline) {
          const resolutionMs = new Date(slaStatus.resolutionDeadline).getTime()
          if (now >= resolutionMs) {
            isBreached = true
            breachType = 'resolution'
          }
        }

        if (isBreached && breachType) {
          breachedCount++

          await sql`
            UPDATE ticket_sla_statuses
            SET is_breached = true, updated_at = ${nowDate}
            WHERE ticket_id = ${ticket.id}
          `
          await sql`
            INSERT INTO ticket_sla_status_extras (id, breached_at)
            SELECT id, ${nowDate}::timestamptz FROM ticket_sla_statuses WHERE ticket_id = ${ticket.id}
            ON CONFLICT (id) DO UPDATE SET breached_at = EXCLUDED.breached_at
          `

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

          if (ticket.priority !== 'urgent') {
            await ticketService.updateTicket(ticket.id, {
              priority: 'urgent',
            })
            escalatedCount++
          }

          await this.dispatchWebhookEvent('sla.breached', {
            ticketId: ticket.id,
            displayId: ticket.displayId,
            breachType,
            breachedAt: nowDate,
            priority: 'urgent',
          })

          details.push({
            ticketId: ticket.id,
            status: ticket.status,
            breachType,
          })

          continue
        }
      }

      if (!isBreached) {
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
    const subscriptions = data.subscriptions || []

    const rows = await sql`
      INSERT INTO outgoing_webhooks (id, url, subscriptions, secret, active, created_at, updated_at)
      VALUES (${id}, ${data.url}, ${sql.array(subscriptions)}, ${data.secret ?? null}, true, ${now}, ${now})
      RETURNING id, url, subscriptions, secret, active, created_at as "createdAt", updated_at as "updatedAt"
    `

    const row = rows[0] as OutgoingWebhook
    const rawSubs = Array.isArray(row.subscriptions) ? row.subscriptions : []
    return {
      ...row,
      subscriptions: rawSubs.map((s: unknown) =>
        typeof s === 'string' ? s.replace(/^"|"$/g, '') : String(s),
      ),
      createdAt: toIsoString(row.createdAt) || row.createdAt,
      updatedAt: toIsoString(row.updatedAt) || row.updatedAt,
    }
  }

  async listWebhookDeliveries(): Promise<OutgoingWebhookDelivery[]> {
    const rows = await sql`
      SELECT
        id, webhook_id as "webhookId", event_name as "eventName", payload,
        response_status_code as "responseStatusCode", status,
        error_message as "errorMessage", attempt_count as "attemptCount", created_at as "createdAt"
      FROM outgoing_webhook_deliveries
      ORDER BY created_at DESC
    `
    return (rows as unknown as Record<string, unknown>[]).map((r) => ({
      ...r,
      payload: parseJsonField(r.payload, {}),
      createdAt: toIsoString(r.createdAt) || (r.createdAt as string),
    })) as OutgoingWebhookDelivery[]
  }

  async dispatchWebhookEvent(eventName: string, payload: Record<string, unknown>): Promise<void> {
    const activeWebhooks = await sql`
      SELECT id, url, subscriptions, secret, active
      FROM outgoing_webhooks
      WHERE active = true
    `

    for (const webhook of activeWebhooks) {
      const rawSubs = Array.isArray(webhook.subscriptions) ? webhook.subscriptions : []
      const subs: string[] = rawSubs.map((s: unknown) =>
        typeof s === 'string' ? s.replace(/^"|"$/g, '') : String(s),
      )
      if (!subs.includes(eventName) && !subs.includes('*')) continue

      const deliveryId = crypto.randomUUID()
      const now = new Date().toISOString()

      await sql`
        INSERT INTO outgoing_webhook_deliveries (
          id, webhook_id, event_name, payload, response_status_code, attempt_count, status, created_at
        ) VALUES (
          ${deliveryId}, ${webhook.id}, ${eventName},
          ${JSON.stringify(payload)}, 200, 1, 'delivered', ${now}
        )
      `
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
