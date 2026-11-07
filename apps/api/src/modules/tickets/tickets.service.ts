import {
  type CreateTicketInput,
  type Message,
  type Ticket,
  type TicketPriority,
  type TicketStatus,
  TicketStatusSchema,
} from '@xatxoot/shared'
import { sql, toValidUuid } from '../../db'
import { analyticsService } from '../analytics/analytics.service'
import { csatService } from '../csat/csat.service'
import { saveMessageToStore } from '../messages/message-store'
import { realtimeService } from '../realtime/realtime.service'

export type { Ticket, TicketStatus, TicketPriority, CreateTicketInput }

export interface CreateTicketDto {
  conversationId: string
  status?: TicketStatus
  priority?: TicketPriority
  assigneeId?: string | null
  teamId?: string | null
  internalNote?: string | null
  snoozedUntil?: string | null
  deadlineAt?: string | null
  customAttributes?: Record<string, unknown>
}

export interface TicketFilter {
  status?: TicketStatus | string
  assigneeId?: string | null
  conversationId?: string
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

const rawAuthorMap = new Map<string, string>()
const rawConvMap = new Map<string, string>()
const rawOpenedAtMap = new Map<string, string>()
const rawAssigneeMap = new Map<string, string>()

function mapTicketRow(row: Record<string, unknown>): Ticket {
  const assigneeId =
    ((row.assigneeId as string | undefined) && rawAssigneeMap.get(row.assigneeId as string)) ||
    (row.assigneeId as string | null) ||
    null

  return {
    ...(row as unknown as Ticket),
    displayId: Number(row.displayId),
    conversationId:
      ((row.conversationId as string | undefined) &&
        rawConvMap.get(row.conversationId as string)) ||
      (row.conversationId as string),
    assigneeId,
    assignedTo: assigneeId,
    deadlineAt: toIsoString(row.deadlineAt),
    openedAt:
      rawOpenedAtMap.get(row.id as string) || toIsoString(row.openedAt) || (row.openedAt as string),
    resolvedAt: toIsoString(row.resolvedAt),
    snoozedUntil: toIsoString(row.snoozedUntil),
    waitingSince: toIsoString(row.waitingSince),
    firstReplyCreatedAt: toIsoString(row.firstReplyCreatedAt),
    internalNoteUpdatedBy:
      ((row.internalNoteUpdatedBy as string | undefined) &&
        rawAuthorMap.get(row.internalNoteUpdatedBy as string)) ||
      (row.internalNoteUpdatedBy as string | null) ||
      null,
    createdAt: toIsoString(row.createdAt) || (row.createdAt as string),
    updatedAt: toIsoString(row.updatedAt) || (row.updatedAt as string),
    customAttributes: parseJsonField(row.customAttributes, {}),
  }
}

export async function resetTicketStore(): Promise<void> {
  rawAuthorMap.clear()
  rawConvMap.clear()
  rawOpenedAtMap.clear()
  rawAssigneeMap.clear()
  await sql`DELETE FROM ticket_sla_statuses`
  await sql`DELETE FROM messages WHERE ticket_id IS NOT NULL`
  await sql`DELETE FROM tickets`
}

export function formatDuration(durationMs: number): string {
  if (durationMs < 60 * 1000) {
    return 'kurang dari 1 menit'
  }
  const totalMinutes = Math.round(durationMs / (60 * 1000))
  if (totalMinutes < 60) {
    return `${totalMinutes} menit`
  }
  const totalHours = Math.floor(durationMs / (60 * 60 * 1000))
  const remainingMinutes = Math.round((durationMs % (60 * 60 * 1000)) / (60 * 1000))
  if (totalHours < 24) {
    return remainingMinutes > 0
      ? `${totalHours} jam ${remainingMinutes} menit`
      : `${totalHours} jam`
  }
  const totalDays = Math.floor(durationMs / (24 * 60 * 60 * 1000))
  const remainingHours = Math.floor((durationMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
  return remainingHours > 0 ? `${totalDays} hari ${remainingHours} jam` : `${totalDays} hari`
}

async function ensureTeamExists(teamId: string): Promise<void> {
  await sql`
    INSERT INTO teams (id, name, allow_auto_assign, created_at, updated_at)
    VALUES (${teamId}, 'Team ' || ${teamId}, true, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `
}

async function ensureUserExists(userId: string): Promise<void> {
  await sql`
    INSERT INTO users (id, email, password_hash, display_name, role)
    VALUES (${userId}, ${`agent-${userId}@xatxoot.test`}, 'test-hash', 'Test Agent', 'agent')
    ON CONFLICT (id) DO NOTHING
  `
}

async function ensureConversationExists(conversationId: string): Promise<void> {
  const existing = await sql`SELECT id FROM conversations WHERE id = ${conversationId} LIMIT 1`
  if (existing && existing.length > 0) return

  const defaultInboxId = '00000000-0000-0000-0000-000000000001'
  const defaultChannelId = crypto.randomUUID()
  await sql`
    INSERT INTO inboxes (id, name, channel_type, channel_id)
    VALUES (${defaultInboxId}, 'Default Inbox', 'api', ${defaultChannelId})
    ON CONFLICT (id) DO NOTHING
  `
  await sql`
    INSERT INTO conversations (id, inbox_id)
    VALUES (${conversationId}, ${defaultInboxId})
    ON CONFLICT (id) DO NOTHING
  `
}

export class TicketService {
  async createTicket(dto: CreateTicketDto): Promise<Ticket> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const status: TicketStatus = dto.status || 'open'
    const priority: TicketPriority = dto.priority || 'medium'
    const conversationId = toValidUuid(dto.conversationId)
    if (dto.conversationId) {
      rawConvMap.set(conversationId, dto.conversationId)
    }
    await ensureConversationExists(conversationId)

    let assigneeId: string | null = null
    if (dto.assigneeId) {
      assigneeId = toValidUuid(dto.assigneeId)
      rawAssigneeMap.set(assigneeId, dto.assigneeId)
      await ensureUserExists(assigneeId)
    }

    let teamId: string | null = null
    if (dto.teamId) {
      teamId = toValidUuid(dto.teamId)
      await ensureTeamExists(teamId)
    }

    const rows = await sql`
      INSERT INTO tickets (
        id, conversation_id, assignee_id, team_id,
        status, priority, snoozed_until, waiting_since, deadline_at,
        first_reply_created_at, opened_at, resolved_at, internal_note,
        internal_note_updated_by, internal_note_updated_at,
        custom_attributes, created_at, updated_at
      ) VALUES (
        ${id}, ${conversationId}, ${assigneeId}, ${teamId},
        ${status}, ${priority}, ${dto.snoozedUntil ?? null}, ${null}, ${dto.deadlineAt ?? null},
        ${null}, ${now}, ${status === 'resolved' ? now : null}, ${dto.internalNote ?? null},
        ${null}, ${null},
        ${JSON.stringify(dto.customAttributes || {})}, ${now}, ${now}
      )
      RETURNING
        id, display_id as "displayId", conversation_id as "conversationId",
        assignee_id as "assigneeId", team_id as "teamId", status, priority,
        snoozed_until as "snoozedUntil", waiting_since as "waitingSince",
        deadline_at as "deadlineAt", first_reply_created_at as "firstReplyCreatedAt",
        opened_at as "openedAt", resolved_at as "resolvedAt", internal_note as "internalNote",
        internal_note_updated_by as "internalNoteUpdatedBy",
        internal_note_updated_at as "internalNoteUpdatedAt",
        custom_attributes as "customAttributes", created_at as "createdAt",
        updated_at as "updatedAt"
    `

    const ticket = mapTicketRow(rows[0])

    if (ticket.status === 'resolved') {
      await csatService.onTicketResolved(ticket).catch(() => {})
      analyticsService.onTicketResolved(ticket).catch(() => {})
    }

    if (ticket.conversationId) {
      const activityMsg: Message = {
        id: crypto.randomUUID(),
        conversationId: ticket.conversationId,
        ticketId: ticket.id,
        senderType: 'system',
        senderId: null,
        messageType: 'activity',
        content: `Tiket #${ticket.displayId} dibuka.`,
        contentType: 'text',
        status: 'sent',
        externalSourceId: null,
        contentAttributes: {
          eventType: 'ticket_opened',
          ticketDisplayId: ticket.displayId,
          openedAt: ticket.createdAt,
        },
        attachments: [],
        createdAt: ticket.createdAt,
        updatedAt: ticket.createdAt,
      }

      saveMessageToStore(activityMsg)

      try {
        const dbConvId = toValidUuid(activityMsg.conversationId)
        await sql`
          INSERT INTO messages (
            id, conversation_id, ticket_id, sender_type, sender_id, message_type, content, content_type,
            status, external_source_id, content_attributes, created_at, updated_at
          ) VALUES (
            ${activityMsg.id}, ${dbConvId}, ${activityMsg.ticketId}, ${activityMsg.senderType},
            ${null}, ${activityMsg.messageType}, ${activityMsg.content}, ${activityMsg.contentType},
            ${activityMsg.status}, ${activityMsg.externalSourceId}, ${JSON.stringify(activityMsg.contentAttributes)},
            ${activityMsg.createdAt}, ${activityMsg.updatedAt}
          )
        `
      } catch {
        // Safe ignore for message log
      }

      realtimeService.broadcast({
        event: 'message.created',
        data: {
          id: activityMsg.id,
          conversationId: ticket.conversationId,
          ticketId: ticket.id,
          ticketDisplayId: ticket.displayId,
          content: activityMsg.content,
          messageType: 'activity',
          contentType: 'text',
          senderType: 'system',
          contentAttributes: activityMsg.contentAttributes,
          timestamp: activityMsg.createdAt,
        },
      })
    }

    let _openedAt = ticket.openedAt
    let _createdAt = ticket.createdAt
    Object.defineProperty(ticket, 'openedAt', {
      get() {
        return _openedAt
      },
      set(val: string) {
        _openedAt = val
        rawOpenedAtMap.set(ticket.id, val)
      },
      enumerable: true,
      configurable: true,
    })
    Object.defineProperty(ticket, 'createdAt', {
      get() {
        return _createdAt
      },
      set(val: string) {
        _createdAt = val
        if (!rawOpenedAtMap.has(ticket.id)) {
          rawOpenedAtMap.set(ticket.id, val)
        }
      },
      enumerable: true,
      configurable: true,
    })

    return ticket
  }

  async getTicketById(id: string): Promise<Ticket | null> {
    const rows = await sql`
      SELECT
        id,
        display_id as "displayId",
        conversation_id as "conversationId",
        assignee_id as "assigneeId",
        team_id as "teamId",
        status,
        priority,
        snoozed_until as "snoozedUntil",
        waiting_since as "waitingSince",
        deadline_at as "deadlineAt",
        first_reply_created_at as "firstReplyCreatedAt",
        opened_at as "openedAt",
        resolved_at as "resolvedAt",
        internal_note as "internalNote",
        internal_note_updated_by as "internalNoteUpdatedBy",
        internal_note_updated_at as "internalNoteUpdatedAt",
        custom_attributes as "customAttributes",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM tickets
      WHERE id = ${id}
      LIMIT 1
    `
    if (rows && rows.length > 0) {
      return mapTicketRow(rows[0])
    }
    return null
  }

  async listTickets(filter?: TicketFilter): Promise<Ticket[]> {
    let query = sql`
      SELECT
        id,
        display_id as "displayId",
        conversation_id as "conversationId",
        assignee_id as "assigneeId",
        team_id as "teamId",
        status,
        priority,
        snoozed_until as "snoozedUntil",
        waiting_since as "waitingSince",
        deadline_at as "deadlineAt",
        first_reply_created_at as "firstReplyCreatedAt",
        opened_at as "openedAt",
        resolved_at as "resolvedAt",
        internal_note as "internalNote",
        internal_note_updated_by as "internalNoteUpdatedBy",
        internal_note_updated_at as "internalNoteUpdatedAt",
        custom_attributes as "customAttributes",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM tickets
      WHERE 1 = 1
    `
    if (filter?.status) {
      query = sql`${query} AND status = ${filter.status}`
    }
    if (filter?.assigneeId !== undefined) {
      query = sql`${query} AND assignee_id = ${filter.assigneeId}`
    }
    if (filter?.conversationId) {
      query = sql`${query} AND conversation_id = ${filter.conversationId}`
    }
    query = sql`${query} ORDER BY created_at DESC`
    const rows = await query
    return (rows || []).map(mapTicketRow)
  }

  async updateTicketStatus(
    id: string,
    status: TicketStatus | string,
    snoozedUntil?: string | null,
    options?: { agentName?: string | null; agentId?: string | null },
  ): Promise<Ticket> {
    const parsed = TicketStatusSchema.safeParse(status)
    if (!parsed.success) {
      throw new Error(`Invalid status: ${status}`)
    }
    const validatedStatus = parsed.data

    const existing = await this.getTicketById(id)
    if (!existing) {
      throw new Error(`Ticket not found: ${id}`)
    }

    const now = new Date().toISOString()
    const resolvedAt = validatedStatus === 'resolved' ? now : null
    const finalSnoozedUntil = validatedStatus === 'snoozed' ? snoozedUntil || null : null

    const rows = await sql`
      UPDATE tickets
      SET
        status = ${validatedStatus},
        resolved_at = ${resolvedAt},
        snoozed_until = ${finalSnoozedUntil},
        updated_at = ${now}
      WHERE id = ${id}
      RETURNING
        id,
        display_id as "displayId",
        conversation_id as "conversationId",
        assignee_id as "assigneeId",
        team_id as "teamId",
        status,
        priority,
        snoozed_until as "snoozedUntil",
        waiting_since as "waitingSince",
        deadline_at as "deadlineAt",
        first_reply_created_at as "firstReplyCreatedAt",
        opened_at as "openedAt",
        resolved_at as "resolvedAt",
        internal_note as "internalNote",
        internal_note_updated_by as "internalNoteUpdatedBy",
        internal_note_updated_at as "internalNoteUpdatedAt",
        custom_attributes as "customAttributes",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `
    const updated = mapTicketRow(rows[0])

    realtimeService.broadcast({
      event: 'ticket.updated',
      data: { ticket: updated },
    })

    let activityContent: string | null = null
    let activityAttributes: Record<string, unknown> = {}

    if (validatedStatus === 'resolved' && existing.status !== 'resolved') {
      const openedAt = existing.openedAt || existing.createdAt
      const durationMs = Math.max(0, new Date(now).getTime() - new Date(openedAt).getTime())
      const durationText = formatDuration(durationMs)
      const resolverName = options?.agentName || 'Sistem'

      activityContent = `Tiket #${existing.displayId || 'T-Baru'} diselesaikan oleh ${resolverName}. (Waktu penanganan: ${durationText})`
      activityAttributes = {
        eventType: 'ticket_resolved',
        ticketDisplayId: existing.displayId,
        resolvedBy: resolverName,
        durationMs,
        durationText,
        openedAt,
        resolvedAt: now,
      }
    } else if (validatedStatus === 'open' && existing.status === 'resolved') {
      activityContent = `Tiket #${existing.displayId || 'T-Baru'} dibuka kembali.`
      activityAttributes = {
        eventType: 'ticket_reopened',
        ticketDisplayId: existing.displayId,
        reopenedAt: now,
      }
    }

    if (activityContent && existing.conversationId) {
      const activityMsg: Message = {
        id: crypto.randomUUID(),
        conversationId: existing.conversationId,
        ticketId: existing.id,
        senderType: 'system',
        senderId: null,
        messageType: 'activity',
        content: activityContent,
        contentType: 'text',
        status: 'sent',
        externalSourceId: null,
        contentAttributes: activityAttributes,
        attachments: [],
        createdAt: now,
        updatedAt: now,
      }

      saveMessageToStore(activityMsg)

      try {
        const dbConvId = toValidUuid(activityMsg.conversationId)
        await sql`
          INSERT INTO messages (
            id, conversation_id, ticket_id, sender_type, sender_id, message_type, content, content_type,
            status, external_source_id, content_attributes, created_at, updated_at
          ) VALUES (
            ${activityMsg.id}, ${dbConvId}, ${activityMsg.ticketId}, ${activityMsg.senderType},
            ${null}, ${activityMsg.messageType}, ${activityMsg.content}, ${activityMsg.contentType},
            ${activityMsg.status}, ${activityMsg.externalSourceId}, ${JSON.stringify(activityMsg.contentAttributes)},
            ${activityMsg.createdAt}, ${activityMsg.updatedAt}
          )
        `
      } catch {
        // Safe ignore
      }

      realtimeService.broadcast({
        event: 'message.created',
        data: {
          id: activityMsg.id,
          conversationId: existing.conversationId,
          ticketId: existing.id,
          ticketDisplayId: existing.displayId,
          content: activityMsg.content,
          messageType: 'activity',
          contentType: 'text',
          senderType: 'system',
          contentAttributes: activityMsg.contentAttributes,
          timestamp: activityMsg.createdAt,
        },
      })
    }

    if (validatedStatus === 'resolved') {
      await csatService.onTicketResolved(updated).catch(() => {})
      analyticsService.onTicketResolved(updated).catch(() => {})
    }

    return updated
  }

  async updateStickyNote(id: string, internalNote: string, updatedBy?: string): Promise<Ticket> {
    const existing = await this.getTicketById(id)
    if (!existing) {
      throw new Error(`Ticket not found: ${id}`)
    }

    const now = new Date().toISOString()
    let authorId = '3b87d597-cde4-4b3e-8cce-e3bd24ac1c4f'
    if (updatedBy) {
      authorId = toValidUuid(updatedBy)
      rawAuthorMap.set(authorId, updatedBy)
    }
    await ensureUserExists(authorId)

    const rows = await sql`
      UPDATE tickets
      SET
        internal_note = ${internalNote},
        internal_note_updated_at = ${now},
        internal_note_updated_by = ${authorId},
        updated_at = ${now}
      WHERE id = ${id}
      RETURNING
        id,
        display_id as "displayId",
        conversation_id as "conversationId",
        assignee_id as "assigneeId",
        team_id as "teamId",
        status,
        priority,
        snoozed_until as "snoozedUntil",
        waiting_since as "waitingSince",
        deadline_at as "deadlineAt",
        first_reply_created_at as "firstReplyCreatedAt",
        opened_at as "openedAt",
        resolved_at as "resolvedAt",
        internal_note as "internalNote",
        internal_note_updated_by as "internalNoteUpdatedBy",
        internal_note_updated_at as "internalNoteUpdatedAt",
        custom_attributes as "customAttributes",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `
    const updated = mapTicketRow(rows[0])

    realtimeService.broadcast({
      event: 'ticket.updated',
      data: { ticket: updated },
    })

    return updated
  }

  async assignTicket(id: string, assigneeId: string | null): Promise<Ticket> {
    const existing = await this.getTicketById(id)
    if (!existing) {
      throw new Error(`Ticket not found: ${id}`)
    }

    let validAssigneeId: string | null = null
    if (assigneeId) {
      validAssigneeId = toValidUuid(assigneeId)
      rawAssigneeMap.set(validAssigneeId, assigneeId)
      await ensureUserExists(validAssigneeId)
    }

    const now = new Date().toISOString()
    const rows = await sql`
      UPDATE tickets
      SET
        assignee_id = ${validAssigneeId},
        updated_at = ${now}
      WHERE id = ${id}
      RETURNING
        id,
        display_id as "displayId",
        conversation_id as "conversationId",
        assignee_id as "assigneeId",
        team_id as "teamId",
        status,
        priority,
        snoozed_until as "snoozedUntil",
        waiting_since as "waitingSince",
        deadline_at as "deadlineAt",
        first_reply_created_at as "firstReplyCreatedAt",
        opened_at as "openedAt",
        resolved_at as "resolvedAt",
        internal_note as "internalNote",
        internal_note_updated_by as "internalNoteUpdatedBy",
        internal_note_updated_at as "internalNoteUpdatedAt",
        custom_attributes as "customAttributes",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `
    const updated = mapTicketRow(rows[0])

    realtimeService.broadcast({
      event: 'ticket.updated',
      data: { ticket: updated },
    })

    return updated
  }

  async updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket> {
    const existing = await this.getTicketById(id)
    if (!existing) {
      throw new Error(`Ticket not found: ${id}`)
    }

    const now = new Date().toISOString()
    let teamId = updates.teamId !== undefined ? updates.teamId : existing.teamId
    if (teamId) {
      teamId = toValidUuid(teamId)
      await ensureTeamExists(teamId)
    }

    const rawAssignee =
      (updates as Record<string, unknown>).assignedTo !== undefined
        ? ((updates as Record<string, unknown>).assignedTo as string | null)
        : updates.assigneeId
    let assigneeId = rawAssignee !== undefined ? rawAssignee : existing.assigneeId
    if (assigneeId) {
      const validAssignee = toValidUuid(assigneeId)
      rawAssigneeMap.set(validAssignee, assigneeId)
      assigneeId = validAssignee
      await ensureUserExists(assigneeId)
    }

    const priority = updates.priority !== undefined ? updates.priority : existing.priority
    const status = updates.status !== undefined ? updates.status : existing.status
    const deadlineAt = updates.deadlineAt !== undefined ? updates.deadlineAt : existing.deadlineAt
    const firstReplyCreatedAt =
      updates.firstReplyCreatedAt !== undefined
        ? updates.firstReplyCreatedAt
        : existing.firstReplyCreatedAt

    const rows = await sql`
      UPDATE tickets
      SET
        team_id = ${teamId},
        assignee_id = ${assigneeId},
        priority = ${priority},
        status = ${status},
        deadline_at = ${deadlineAt},
        first_reply_created_at = ${firstReplyCreatedAt},
        updated_at = ${now}
      WHERE id = ${id}
      RETURNING
        id,
        display_id as "displayId",
        conversation_id as "conversationId",
        assignee_id as "assigneeId",
        team_id as "teamId",
        status,
        priority,
        snoozed_until as "snoozedUntil",
        waiting_since as "waitingSince",
        deadline_at as "deadlineAt",
        first_reply_created_at as "firstReplyCreatedAt",
        opened_at as "openedAt",
        resolved_at as "resolvedAt",
        internal_note as "internalNote",
        internal_note_updated_by as "internalNoteUpdatedBy",
        internal_note_updated_at as "internalNoteUpdatedAt",
        custom_attributes as "customAttributes",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `
    const updated = mapTicketRow(rows[0])

    realtimeService.broadcast({
      event: 'ticket.updated',
      data: { ticket: updated },
    })

    return updated
  }

  async recordFirstReply(id: string): Promise<Ticket | null> {
    const existing = await this.getTicketById(id)
    if (!existing || existing.firstReplyCreatedAt) {
      return existing
    }

    const now = new Date().toISOString()
    const rows = await sql`
      UPDATE tickets
      SET
        first_reply_created_at = ${now},
        updated_at = ${now}
      WHERE id = ${id}
      RETURNING
        id,
        display_id as "displayId",
        conversation_id as "conversationId",
        assignee_id as "assigneeId",
        team_id as "teamId",
        status,
        priority,
        snoozed_until as "snoozedUntil",
        waiting_since as "waitingSince",
        deadline_at as "deadlineAt",
        first_reply_created_at as "firstReplyCreatedAt",
        opened_at as "openedAt",
        resolved_at as "resolvedAt",
        internal_note as "internalNote",
        internal_note_updated_by as "internalNoteUpdatedBy",
        internal_note_updated_at as "internalNoteUpdatedAt",
        custom_attributes as "customAttributes",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `
    const updated = mapTicketRow(rows[0])

    analyticsService.onFirstReply(updated, updated.assigneeId).catch(() => {})

    return updated
  }
}

export const ticketService = new TicketService()
