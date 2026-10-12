import type {
  ReportFilterQuery,
  ReportingDataPoint,
  ReportingEvent,
  ReportingMetricSummary,
  Ticket,
} from '@xatxoot/shared'
import { sql } from '../../db'

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

const memoryStore = {
  events: new Map<string, ReportingEvent>(),
}

export function resetAnalyticsStore(): void {
  memoryStore.events.clear()
}

export class AnalyticsService {
  async recordEvent(params: AnalyticsEventParams): Promise<ReportingEvent> {
    const id = crypto.randomUUID()
    const now = params.createdAt || new Date().toISOString()
    const value =
      params.valueInSeconds !== undefined && params.valueInSeconds !== null
        ? Math.max(0, Math.round(params.valueInSeconds))
        : null

    const event: ReportingEvent = {
      id,
      eventType: params.eventType,
      conversationId: params.conversationId ?? null,
      ticketId: params.ticketId ?? null,
      userId: params.userId ?? null,
      inboxId: params.inboxId ?? null,
      valueInSeconds: value,
      createdAt: now,
    }

    memoryStore.events.set(id, event)

    try {
      await sql`
        INSERT INTO reporting_events (
          id, event_type, conversation_id, ticket_id, user_id, inbox_id, value_in_seconds, created_at
        ) VALUES (
          ${event.id}, ${event.eventType}, ${event.conversationId}, ${event.ticketId},
          ${event.userId}, ${event.inboxId}, ${event.valueInSeconds}, ${event.createdAt}
        )
      `
    } catch {
      // Memory fallback for unit tests/offline
    }

    return event
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
    userId?: string | null,
    inboxId?: string | null,
  ): Promise<ReportingEvent | null> {
    if (!ticket.openedAt || !ticket.firstReplyCreatedAt) {
      return null
    }

    return this.recordFirstResponseTime({
      conversationId: ticket.conversationId,
      ticketId: ticket.id,
      userId: userId || ticket.assigneeId,
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
    try {
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
        query = sql`${query} AND inbox_id = ${filter.inboxId}`
      }
      if (filter?.agentId) {
        query = sql`${query} AND user_id = ${filter.agentId}`
      }

      const rows = await query
      if (rows && rows.length > 0 && rows[0].totalResolvedTickets !== null) {
        return {
          conversationsCount: 0,
          incomingMessagesCount: 0,
          outgoingMessagesCount: 0,
          avgFirstResponseTimeSeconds: Math.round(Number(rows[0].avgFirstResponseTime || 0)),
          avgResolutionTimeSeconds: Math.round(Number(rows[0].avgResolutionTime || 0)),
          avgCsatScore: 0,
          totalResolvedTickets: Number(rows[0].totalResolvedTickets || 0),
        }
      }
    } catch {
      // Memory fallback
    }

    // In-memory fallback
    let events = Array.from(memoryStore.events.values())

    if (filter?.since) {
      const sinceTime = new Date(filter.since).getTime()
      events = events.filter((e) => new Date(e.createdAt).getTime() >= sinceTime)
    }
    if (filter?.until) {
      const untilTime = new Date(filter.until).getTime()
      events = events.filter((e) => new Date(e.createdAt).getTime() <= untilTime)
    }
    if (filter?.inboxId) {
      events = events.filter((e) => e.inboxId === filter.inboxId)
    }
    if (filter?.agentId) {
      events = events.filter((e) => e.userId === filter.agentId)
    }

    const frtEvents = events.filter(
      (e) => e.eventType === 'first_response_time' && e.valueInSeconds !== null,
    )
    const resEvents = events.filter(
      (e) => e.eventType === 'resolution_time' && e.valueInSeconds !== null,
    )

    const avgFrt =
      frtEvents.length > 0
        ? Math.round(
            frtEvents.reduce((acc, curr) => acc + (curr.valueInSeconds || 0), 0) / frtEvents.length,
          )
        : 0

    const avgRes =
      resEvents.length > 0
        ? Math.round(
            resEvents.reduce((acc, curr) => acc + (curr.valueInSeconds || 0), 0) / resEvents.length,
          )
        : 0

    return {
      conversationsCount: 0,
      incomingMessagesCount: 0,
      outgoingMessagesCount: 0,
      avgFirstResponseTimeSeconds: avgFrt,
      avgResolutionTimeSeconds: avgRes,
      avgCsatScore: 0,
      totalResolvedTickets: resEvents.length,
    }
  }

  async getTimeSeries(filter?: ReportFilterQuery): Promise<ReportingDataPoint[]> {
    const metricType = filter?.type || 'first_response_time'
    const interval = filter?.groupBy || 'day'

    try {
      const dateTrunc = interval === 'week' ? 'week' : interval === 'month' ? 'month' : 'day'
      let query = sql`
        SELECT
          DATE_TRUNC(${dateTrunc}, created_at)::text AS "timestamp",
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
        query = sql`${query} AND inbox_id = ${filter.inboxId}`
      }
      if (filter?.agentId) {
        query = sql`${query} AND user_id = ${filter.agentId}`
      }

      query = sql`${query} GROUP BY DATE_TRUNC(${dateTrunc}, created_at) ORDER BY "timestamp" ASC`
      const rows = await query
      if (rows && rows.length > 0) {
        return rows.map((r: Record<string, unknown>) => ({
          timestamp: String(r.timestamp),
          value: Math.round(Number(r.value || 0)),
          count: Number(r.count || 0),
        }))
      }
    } catch {
      // Memory fallback
    }

    // In-memory fallback
    let events = Array.from(memoryStore.events.values()).filter((e) => e.eventType === metricType)
    if (filter?.since) {
      const sinceTime = new Date(filter.since).getTime()
      events = events.filter((e) => new Date(e.createdAt).getTime() >= sinceTime)
    }
    if (filter?.until) {
      const untilTime = new Date(filter.until).getTime()
      events = events.filter((e) => new Date(e.createdAt).getTime() <= untilTime)
    }
    if (filter?.inboxId) {
      events = events.filter((e) => e.inboxId === filter.inboxId)
    }
    if (filter?.agentId) {
      events = events.filter((e) => e.userId === filter.agentId)
    }

    const groups = new Map<string, { sum: number; count: number }>()
    for (const e of events) {
      const date = new Date(e.createdAt)
      const key = date.toISOString().split('T')[0]
      const current = groups.get(key) || { sum: 0, count: 0 }
      groups.set(key, {
        sum: current.sum + (e.valueInSeconds || 0),
        count: current.count + 1,
      })
    }

    return Array.from(groups.entries()).map(([timestamp, data]) => ({
      timestamp,
      value: Math.round(data.sum / data.count),
      count: data.count,
    }))
  }

  async getAgentPerformance(filter?: ReportFilterQuery): Promise<AgentPerformance[]> {
    let events = Array.from(memoryStore.events.values()).filter((e) => e.userId)
    if (filter?.since) {
      const sinceTime = new Date(filter.since).getTime()
      events = events.filter((e) => new Date(e.createdAt).getTime() >= sinceTime)
    }
    if (filter?.until) {
      const untilTime = new Date(filter.until).getTime()
      events = events.filter((e) => new Date(e.createdAt).getTime() <= untilTime)
    }
    if (filter?.inboxId) {
      events = events.filter((e) => e.inboxId === filter.inboxId)
    }

    const agentMap = new Map<
      string,
      {
        frtSum: number
        frtCount: number
        resSum: number
        resCount: number
      }
    >()

    for (const e of events) {
      if (!e.userId) continue
      const current = agentMap.get(e.userId) || {
        frtSum: 0,
        frtCount: 0,
        resSum: 0,
        resCount: 0,
      }
      if (e.eventType === 'first_response_time' && e.valueInSeconds !== null) {
        current.frtSum += e.valueInSeconds
        current.frtCount += 1
      } else if (e.eventType === 'resolution_time' && e.valueInSeconds !== null) {
        current.resSum += e.valueInSeconds
        current.resCount += 1
      }
      agentMap.set(e.userId, current)
    }

    return Array.from(agentMap.entries()).map(([agentId, stat]) => ({
      agentId,
      totalResolvedTickets: stat.resCount,
      avgFirstResponseTimeSeconds: stat.frtCount > 0 ? Math.round(stat.frtSum / stat.frtCount) : 0,
      avgResolutionTimeSeconds: stat.resCount > 0 ? Math.round(stat.resSum / stat.resCount) : 0,
      totalReplies: stat.frtCount,
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
    let events = Array.from(memoryStore.events.values())
    if (filter?.since) {
      const sinceTime = new Date(filter.since).getTime()
      events = events.filter((e) => new Date(e.createdAt).getTime() >= sinceTime)
    }
    if (filter?.until) {
      const untilTime = new Date(filter.until).getTime()
      events = events.filter((e) => new Date(e.createdAt).getTime() <= untilTime)
    }
    if (filter?.inboxId) {
      events = events.filter((e) => e.inboxId === filter.inboxId)
    }
    if (filter?.agentId) {
      events = events.filter((e) => e.userId === filter.agentId)
    }

    const lines = [
      'id,event_type,conversation_id,ticket_id,user_id,inbox_id,value_in_seconds,created_at',
      ...events.map(
        (e) =>
          `${e.id},${e.eventType},${e.conversationId || ''},${e.ticketId || ''},${e.userId || ''},${e.inboxId || ''},${e.valueInSeconds ?? ''},${e.createdAt}`,
      ),
    ]
    return lines.join('\n')
  }
}

export const analyticsService = new AnalyticsService()
