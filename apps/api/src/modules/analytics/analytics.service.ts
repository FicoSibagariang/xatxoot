import type {
  ReportFilterQuery,
  ReportingDataPoint,
  ReportingEvent,
  ReportingMetricSummary,
  Ticket,
} from '@xatxoot/shared'
import { sql, toIsoString, toValidUuid } from '../../db'

export interface AnalyticsEventParams {
  eventType: string
  conversationId?: string | null
  ticketId?: string | null
  userId?: string | null
  inboxId?: string | null
  valueInSeconds?: number | null
  createdAt?: string
}

export interface FirstResponseTimeParams {
  conversationId?: string | null
  ticketId?: string | null
  userId?: string | null
  inboxId?: string | null
  openedAt: string
  repliedAt?: string
}

export interface ResolutionTimeParams {
  conversationId?: string | null
  ticketId?: string | null
  userId?: string | null
  inboxId?: string | null
  openedAt: string
  resolvedAt?: string
}

export interface AgentPerformance {
  agentId: string
  agentName?: string
  totalResolvedTickets: number
  avgFirstResponseTimeSeconds: number
  avgResolutionTimeSeconds: number
  totalReplies: number
}

export interface InboxPerformance {
  inboxId: string
  inboxName?: string
  totalConversations: number
  totalResolvedTickets: number
  avgFirstResponseTimeSeconds: number
  avgResolutionTimeSeconds: number
}

async function ensureInboxExists(inboxId: string): Promise<void> {
  await sql`
    INSERT INTO inboxes (id, name, channel_type, channel_id, created_at, updated_at)
    VALUES (${inboxId}, 'Inbox ' || ${inboxId}, 'whatsapp', ${crypto.randomUUID()}, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `
}

async function ensureUserExists(userId: string): Promise<void> {
  await sql`
    INSERT INTO users (id, email, password_hash, display_name, role, created_at, updated_at)
    VALUES (${userId}, ${userId} || '@test.local', 'dummy_hash', 'User ' || ${userId}, 'agent', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `
}

async function ensureConversationExists(
  conversationId: string,
  inboxId?: string | null,
): Promise<void> {
  const dummyContactId = '11111111-1111-1111-1111-111111111111'
  await sql`
    INSERT INTO contacts (id, name, created_at, updated_at)
    VALUES (${dummyContactId}, 'System Contact', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `
  let effectiveInboxId = inboxId
  if (!effectiveInboxId) {
    effectiveInboxId = '22222222-2222-2222-2222-222222222222'
    await ensureInboxExists(effectiveInboxId)
  }
  await sql`
    INSERT INTO conversations (id, inbox_id, contact_id, created_at, updated_at)
    VALUES (${conversationId}, ${effectiveInboxId}, ${dummyContactId}, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `
}

async function ensureTicketExists(ticketId: string, conversationId?: string | null): Promise<void> {
  let effectiveConvId = conversationId
  if (!effectiveConvId) {
    effectiveConvId = '33333333-3333-3333-3333-333333333333'
    await ensureConversationExists(effectiveConvId)
  }
  await sql`
    INSERT INTO tickets (id, display_id, conversation_id, status, priority, created_at, updated_at)
    VALUES (${ticketId}, nextval('tickets_display_id_seq'), ${effectiveConvId}, 'open', 'medium', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `
}

export async function resetAnalyticsStore(): Promise<void> {
  await sql`DELETE FROM reporting_events`
}

export class AnalyticsService {
  async recordEvent(params: AnalyticsEventParams): Promise<ReportingEvent> {
    const id = crypto.randomUUID()
    const now = params.createdAt || new Date().toISOString()
    const value =
      params.valueInSeconds !== undefined && params.valueInSeconds !== null
        ? Math.max(0, Math.round(params.valueInSeconds))
        : null

    let inboxId = params.inboxId ?? null
    let userId = params.userId ?? null
    let conversationId = params.conversationId ?? null
    let ticketId = params.ticketId ?? null

    if (inboxId) {
      inboxId = toValidUuid(inboxId)
      await ensureInboxExists(inboxId)
    }
    if (userId) {
      userId = toValidUuid(userId)
      await ensureUserExists(userId)
    }
    if (conversationId) {
      conversationId = toValidUuid(conversationId)
      await ensureConversationExists(conversationId, inboxId)
    }
    if (ticketId) {
      ticketId = toValidUuid(ticketId)
      await ensureTicketExists(ticketId, conversationId)
    }

    const rows = await sql`
      INSERT INTO reporting_events (
        id, event_type, conversation_id, ticket_id, user_id, inbox_id, value_in_seconds, created_at
      ) VALUES (
        ${id}, ${params.eventType}, ${conversationId}, ${ticketId},
        ${userId}, ${inboxId}, ${value}, ${now}
      )
      RETURNING
        id,
        event_type as "eventType",
        conversation_id as "conversationId",
        ticket_id as "ticketId",
        user_id as "userId",
        inbox_id as "inboxId",
        value_in_seconds as "valueInSeconds",
        created_at as "createdAt"
    `

    const row = rows[0]
    return {
      id: row.id,
      eventType: row.eventType,
      conversationId: row.conversationId ?? null,
      ticketId: row.ticketId ?? null,
      userId: row.userId ?? null,
      inboxId: row.inboxId ?? null,
      valueInSeconds: row.valueInSeconds !== null ? Number(row.valueInSeconds) : null,
      createdAt: toIsoString(row.createdAt) || row.createdAt,
    }
  }

  async recordFirstResponseTime(params: FirstResponseTimeParams): Promise<ReportingEvent> {
    const openedTime = new Date(params.openedAt).getTime()
    const repliedTime = params.repliedAt ? new Date(params.repliedAt).getTime() : Date.now()
    const diffSeconds = Math.max(0, Math.round((repliedTime - openedTime) / 1000))

    return this.recordEvent({
      eventType: 'first_response_time',
      conversationId: params.conversationId,
      ticketId: params.ticketId,
      userId: params.userId,
      inboxId: params.inboxId,
      valueInSeconds: diffSeconds,
      createdAt: params.repliedAt || new Date().toISOString(),
    })
  }

  async recordResolutionTime(params: ResolutionTimeParams): Promise<ReportingEvent> {
    const openedTime = new Date(params.openedAt).getTime()
    const resolvedTime = params.resolvedAt ? new Date(params.resolvedAt).getTime() : Date.now()
    const diffSeconds = Math.max(0, Math.round((resolvedTime - openedTime) / 1000))

    return this.recordEvent({
      eventType: 'resolution_time',
      conversationId: params.conversationId,
      ticketId: params.ticketId,
      userId: params.userId,
      inboxId: params.inboxId,
      valueInSeconds: diffSeconds,
      createdAt: params.resolvedAt || new Date().toISOString(),
    })
  }

  async onFirstReply(
    ticket: Partial<Ticket>,
    agentId?: string | null,
    inboxId?: string | null,
  ): Promise<ReportingEvent | null> {
    if (!ticket.openedAt || !ticket.firstReplyCreatedAt) {
      return null
    }

    return this.recordFirstResponseTime({
      conversationId: ticket.conversationId,
      ticketId: ticket.id,
      userId: agentId || ticket.assigneeId,
      inboxId,
      openedAt: ticket.openedAt,
      repliedAt: ticket.firstReplyCreatedAt,
    })
  }

  async onTicketResolved(
    ticket: Partial<Ticket>,
    inboxId?: string | null,
  ): Promise<ReportingEvent | null> {
    if (!ticket.openedAt || !ticket.resolvedAt) {
      return null
    }

    return this.recordResolutionTime({
      conversationId: ticket.conversationId,
      ticketId: ticket.id,
      userId: ticket.assigneeId,
      inboxId,
      openedAt: ticket.openedAt,
      resolvedAt: ticket.resolvedAt,
    })
  }

  async getMetricsSummary(filter?: ReportFilterQuery): Promise<ReportingMetricSummary> {
    let query = sql`
      SELECT
        COUNT(*) FILTER (WHERE event_type = 'resolution_time') AS "totalResolvedTickets",
        AVG(value_in_seconds) FILTER (WHERE event_type = 'first_response_time') AS "avgFirstResponseTime",
        AVG(value_in_seconds) FILTER (WHERE event_type = 'resolution_time') AS "avgResolutionTime"
      FROM reporting_events
      WHERE 1 = 1
    `
    if (filter?.since) {
      query = sql`${query} AND created_at >= ${new Date(filter.since).toISOString()}`
    }
    if (filter?.until) {
      query = sql`${query} AND created_at <= ${new Date(filter.until).toISOString()}`
    }
    if (filter?.inboxId) {
      const inboxId = toValidUuid(filter.inboxId)
      query = sql`${query} AND inbox_id = ${inboxId}`
    }
    if (filter?.agentId) {
      const agentId = toValidUuid(filter.agentId)
      query = sql`${query} AND user_id = ${agentId}`
    }

    const rows = await query
    const row = rows[0]
    return {
      conversationsCount: 0,
      incomingMessagesCount: 0,
      outgoingMessagesCount: 0,
      avgFirstResponseTimeSeconds: row?.avgFirstResponseTime
        ? Math.round(Number(row.avgFirstResponseTime))
        : 0,
      avgResolutionTimeSeconds: row?.avgResolutionTime
        ? Math.round(Number(row.avgResolutionTime))
        : 0,
      avgCsatScore: 0,
      totalResolvedTickets: row?.totalResolvedTickets ? Number(row.totalResolvedTickets) : 0,
    }
  }

  async getTimeSeries(filter?: ReportFilterQuery): Promise<ReportingDataPoint[]> {
    const metricType = filter?.type || 'first_response_time'
    const interval = filter?.groupBy || 'day'
    const dateTrunc = interval === 'week' ? 'week' : interval === 'month' ? 'month' : 'day'

    let query = sql`
      SELECT
        TO_CHAR(DATE_TRUNC(${dateTrunc}, created_at), 'YYYY-MM-DD') AS "timestamp",
        AVG(value_in_seconds) AS "value",
        COUNT(*)::int AS "count"
      FROM reporting_events
      WHERE event_type = ${metricType}
    `
    if (filter?.since) {
      query = sql`${query} AND created_at >= ${new Date(filter.since).toISOString()}`
    }
    if (filter?.until) {
      query = sql`${query} AND created_at <= ${new Date(filter.until).toISOString()}`
    }
    if (filter?.inboxId) {
      const inboxId = toValidUuid(filter.inboxId)
      query = sql`${query} AND inbox_id = ${inboxId}`
    }
    if (filter?.agentId) {
      const agentId = toValidUuid(filter.agentId)
      query = sql`${query} AND user_id = ${agentId}`
    }

    query = sql`${query} GROUP BY 1 ORDER BY 1 ASC`
    const rows = await query
    return ((rows || []) as unknown as Record<string, unknown>[]).map((r) => ({
      timestamp: String(r.timestamp),
      value: Math.round(Number(r.value || 0)),
      count: Number(r.count || 0),
    }))
  }

  async getAgentPerformance(filter?: ReportFilterQuery): Promise<AgentPerformance[]> {
    let query = sql`
      SELECT
        user_id as "agentId",
        COUNT(*) FILTER (WHERE event_type = 'resolution_time') AS "totalResolvedTickets",
        AVG(value_in_seconds) FILTER (WHERE event_type = 'first_response_time') AS "avgFirstResponseTime",
        AVG(value_in_seconds) FILTER (WHERE event_type = 'resolution_time') AS "avgResolutionTime",
        COUNT(*) FILTER (WHERE event_type = 'first_response_time') AS "totalReplies"
      FROM reporting_events
      WHERE user_id IS NOT NULL
    `
    if (filter?.since) {
      query = sql`${query} AND created_at >= ${new Date(filter.since).toISOString()}`
    }
    if (filter?.until) {
      query = sql`${query} AND created_at <= ${new Date(filter.until).toISOString()}`
    }
    if (filter?.inboxId) {
      const inboxId = toValidUuid(filter.inboxId)
      query = sql`${query} AND inbox_id = ${inboxId}`
    }

    query = sql`${query} GROUP BY user_id ORDER BY user_id ASC`
    const rows = await query
    return ((rows || []) as unknown as Record<string, unknown>[]).map((r) => ({
      agentId: r.agentId,
      totalResolvedTickets: Number(r.totalResolvedTickets || 0),
      avgFirstResponseTimeSeconds: r.avgFirstResponseTime
        ? Math.round(Number(r.avgFirstResponseTime))
        : 0,
      avgResolutionTimeSeconds: r.avgResolutionTime ? Math.round(Number(r.avgResolutionTime)) : 0,
      totalReplies: Number(r.totalReplies || 0),
    }))
  }

  async exportCsv(filter?: ReportFilterQuery & { type?: string }): Promise<string> {
    const exportType = filter?.type || 'events'

    if (exportType === 'summary') {
      const summary = await this.getMetricsSummary(filter)
      const lines = [
        'metric,value',
        `conversationsCount,${summary.conversationsCount}`,
        `incomingMessagesCount,${summary.incomingMessagesCount}`,
        `outgoingMessagesCount,${summary.outgoingMessagesCount}`,
        `avgFirstResponseTimeSeconds,${summary.avgFirstResponseTimeSeconds}`,
        `avgResolutionTimeSeconds,${summary.avgResolutionTimeSeconds}`,
        `avgCsatScore,${summary.avgCsatScore}`,
        `totalResolvedTickets,${summary.totalResolvedTickets}`,
      ]
      return lines.join('\n')
    }

    if (exportType === 'agents') {
      const agents = await this.getAgentPerformance(filter)
      const lines = [
        'agent_id,total_resolved_tickets,avg_first_response_time_seconds,avg_resolution_time_seconds,total_replies',
        ...agents.map(
          (a) =>
            `${a.agentId},${a.totalResolvedTickets},${a.avgFirstResponseTimeSeconds},${a.avgResolutionTimeSeconds},${a.totalReplies}`,
        ),
      ]
      return lines.join('\n')
    }

    // Default: events export
    let query = sql`
      SELECT
        id,
        event_type as "eventType",
        conversation_id as "conversationId",
        ticket_id as "ticketId",
        user_id as "userId",
        inbox_id as "inboxId",
        value_in_seconds as "valueInSeconds",
        created_at as "createdAt"
      FROM reporting_events
      WHERE 1 = 1
    `
    if (filter?.since) {
      query = sql`${query} AND created_at >= ${new Date(filter.since).toISOString()}`
    }
    if (filter?.until) {
      query = sql`${query} AND created_at <= ${new Date(filter.until).toISOString()}`
    }
    if (filter?.inboxId) {
      const inboxId = toValidUuid(filter.inboxId)
      query = sql`${query} AND inbox_id = ${inboxId}`
    }
    if (filter?.agentId) {
      const agentId = toValidUuid(filter.agentId)
      query = sql`${query} AND user_id = ${agentId}`
    }

    query = sql`${query} ORDER BY created_at ASC`
    const rows = await query
    const lines = [
      'id,event_type,conversation_id,ticket_id,user_id,inbox_id,value_in_seconds,created_at',
      ...((rows || []) as unknown as Record<string, unknown>[]).map(
        (e) =>
          `${e.id},${e.eventType},${e.conversationId || ''},${e.ticketId || ''},${e.userId || ''},${e.inboxId || ''},${e.valueInSeconds ?? ''},${toIsoString(e.createdAt) || (e.createdAt as string)}`,
      ),
    ]
    return lines.join('\n')
  }
}

export const analyticsService = new AnalyticsService()
