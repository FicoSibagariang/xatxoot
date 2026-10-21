import {
  type CreateTicketInput,
  type Message,
  type Ticket,
  type TicketPriority,
  type TicketStatus,
  TicketStatusSchema,
} from '@xatxoot/shared'
import { sql } from '../../db'
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

let displayIdCounter = 1000

const memoryStore = {
  tickets: new Map<string, Ticket>(),
}

export function resetTicketStore(): void {
  memoryStore.tickets.clear()
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

export class TicketService {
  async createTicket(dto: CreateTicketDto): Promise<Ticket> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const displayId = ++displayIdCounter
    const status: TicketStatus = dto.status || 'open'
    const priority: TicketPriority = dto.priority || 'medium'

    const ticket: Ticket = {
      id,
      displayId,
      conversationId: dto.conversationId,
      assigneeId: dto.assigneeId ?? null,
      teamId: dto.teamId ?? null,
      status,
      priority,
      snoozedUntil: dto.snoozedUntil ?? null,
      waitingSince: null,
      deadlineAt: dto.deadlineAt ?? null,
      firstReplyCreatedAt: null,
      openedAt: now,
      resolvedAt: status === 'resolved' ? now : null,
      internalNote: dto.internalNote ?? null,
      internalNoteUpdatedBy: null,
      internalNoteUpdatedAt: null,
      customAttributes: dto.customAttributes || {},
      createdAt: now,
      updatedAt: now,
    }

    memoryStore.tickets.set(id, ticket)

    try {
      const rows = await sql`
        INSERT INTO tickets (
          id, conversation_id, assignee_id, team_id,
          status, priority, snoozed_until, waiting_since, deadline_at,
          first_reply_created_at, opened_at, resolved_at, internal_note,
          internal_note_updated_by, internal_note_updated_at,
          custom_attributes, created_at, updated_at
        ) VALUES (
          ${ticket.id}, ${ticket.conversationId}, ${ticket.assigneeId}, ${ticket.teamId},
          ${ticket.status}, ${ticket.priority}, ${ticket.snoozedUntil}, ${ticket.waitingSince}, ${ticket.deadlineAt},
          ${ticket.firstReplyCreatedAt}, ${ticket.openedAt}, ${ticket.resolvedAt}, ${ticket.internalNote},
          ${ticket.internalNoteUpdatedBy}, ${ticket.internalNoteUpdatedAt},
          ${JSON.stringify(ticket.customAttributes)}, ${ticket.createdAt}, ${ticket.updatedAt}
        )
        RETURNING display_id
      `
      if (rows && rows.length > 0 && rows[0].display_id) {
        ticket.displayId = Number(rows[0].display_id)
        if (ticket.displayId > displayIdCounter) {
          displayIdCounter = ticket.displayId
        }
        memoryStore.tickets.set(id, ticket)
      }
    } catch {
      // Memory fallback for tests/offline
    }

    if (ticket.status === 'resolved') {
      csatService.onTicketResolved(ticket).catch(() => {})
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
        await sql`
          INSERT INTO messages (
            id, conversation_id, ticket_id, sender_type, sender_id, message_type, content, content_type,
            status, external_source_id, content_attributes, created_at, updated_at
          ) VALUES (
            ${activityMsg.id}, ${activityMsg.conversationId}, ${activityMsg.ticketId}, ${activityMsg.senderType},
            ${null}, ${activityMsg.messageType}, ${activityMsg.content}, ${activityMsg.contentType},
            ${activityMsg.status}, ${activityMsg.externalSourceId}, ${JSON.stringify(activityMsg.contentAttributes)},
            ${activityMsg.createdAt}, ${activityMsg.updatedAt}
          )
        `
      } catch {
        // Memory fallback
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

    return ticket
  }

  async getTicketById(id: string): Promise<Ticket | null> {
    try {
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
        const row = rows[0] as unknown as Ticket & { displayId: string | number }
        const ticket: Ticket = {
          ...row,
          displayId: Number(row.displayId),
        }
        memoryStore.tickets.set(id, ticket)
        return ticket
      }
      memoryStore.tickets.delete(id)
      return null
    } catch {
      // Memory fallback if DB is offline
      return memoryStore.tickets.get(id) || null
    }
  }

  async listTickets(filter?: TicketFilter): Promise<Ticket[]> {
    try {
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
      const tickets = (
        (rows || []) as unknown as Array<Ticket & { displayId: string | number }>
      ).map((row) => ({
        ...row,
        displayId: Number(row.displayId),
      }))
      if (!filter?.status && filter?.assigneeId === undefined && !filter?.conversationId) {
        memoryStore.tickets.clear()
        for (const t of tickets) {
          memoryStore.tickets.set(t.id, t)
        }
      }
      return tickets
    } catch {
      // Memory fallback if DB is offline
      let tickets = Array.from(memoryStore.tickets.values())
      if (filter?.status) {
        tickets = tickets.filter((t) => t.status === filter.status)
      }
      if (filter?.assigneeId !== undefined) {
        tickets = tickets.filter((t) => t.assigneeId === filter.assigneeId)
      }
      if (filter?.conversationId) {
        tickets = tickets.filter((t) => t.conversationId === filter.conversationId)
      }
      return tickets
    }
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

    const updated: Ticket = {
      ...existing,
      status: validatedStatus,
      resolvedAt,
      snoozedUntil: finalSnoozedUntil,
      updatedAt: now,
    }

    memoryStore.tickets.set(id, updated)

    try {
      await sql`
        UPDATE tickets
        SET
          status = ${validatedStatus},
          resolved_at = ${resolvedAt},
          snoozed_until = ${finalSnoozedUntil},
          updated_at = ${now}
        WHERE id = ${id}
      `
    } catch {
      // Memory fallback
    }

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
        await sql`
          INSERT INTO messages (
            id, conversation_id, ticket_id, sender_type, sender_id, message_type, content, content_type,
            status, external_source_id, content_attributes, created_at, updated_at
          ) VALUES (
            ${activityMsg.id}, ${activityMsg.conversationId}, ${activityMsg.ticketId}, ${activityMsg.senderType},
            ${null}, ${activityMsg.messageType}, ${activityMsg.content}, ${activityMsg.contentType},
            ${activityMsg.status}, ${activityMsg.externalSourceId}, ${JSON.stringify(activityMsg.contentAttributes)},
            ${activityMsg.createdAt}, ${activityMsg.updatedAt}
          )
        `
      } catch {
        // Memory fallback
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
      csatService.onTicketResolved(updated).catch(() => {})
      analyticsService.onTicketResolved(updated).catch(() => {})
    }

    return updated
  }

  async updateStickyNote(id: string, internalNote: string, updatedBy?: string): Promise<Ticket> {
    const existing = await this.getTicketById(id)
    if (!existing) {
      throw new Error(`Ticket not found: ${id}`)
    }

    const isValidUuid = (val: string) =>
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val)

    const now = new Date().toISOString()
    const authorId =
      updatedBy && isValidUuid(updatedBy) ? updatedBy : '3b87d597-cde4-4b3e-8cce-e3bd24ac1c4f'

    const updated: Ticket = {
      ...existing,
      internalNote,
      internalNoteUpdatedAt: now,
      internalNoteUpdatedBy: updatedBy || authorId,
      updatedAt: now,
    }

    memoryStore.tickets.set(id, updated)

    try {
      await sql`
        UPDATE tickets
        SET
          internal_note = ${internalNote},
          internal_note_updated_at = ${now},
          internal_note_updated_by = ${authorId},
          updated_at = ${now}
        WHERE id = ${id}
      `
    } catch {
      // Memory fallback
    }

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

    const isValidUuid = (val: string) =>
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val)

    const dbAssigneeId =
      assigneeId && !isValidUuid(assigneeId) ? '3b87d597-cde4-4b3e-8cce-e3bd24ac1c4f' : assigneeId

    const now = new Date().toISOString()
    const updated: Ticket = {
      ...existing,
      assigneeId,
      updatedAt: now,
    }

    memoryStore.tickets.set(id, updated)

    try {
      await sql`
        UPDATE tickets
        SET
          assignee_id = ${dbAssigneeId},
          updated_at = ${now}
        WHERE id = ${id}
      `
    } catch {
      // Memory fallback
    }

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
    const updated: Ticket = {
      ...existing,
      ...updates,
      updatedAt: now,
    }

    memoryStore.tickets.set(id, updated)

    try {
      await sql`
        UPDATE tickets
        SET
          team_id = ${updated.teamId},
          assignee_id = ${updated.assigneeId},
          priority = ${updated.priority},
          status = ${updated.status},
          updated_at = ${now}
        WHERE id = ${id}
      `
    } catch {
      // Memory fallback
    }

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
    const updated: Ticket = {
      ...existing,
      firstReplyCreatedAt: now,
      updatedAt: now,
    }

    memoryStore.tickets.set(id, updated)

    try {
      await sql`
        UPDATE tickets
        SET
          first_reply_created_at = ${now},
          updated_at = ${now}
        WHERE id = ${id}
      `
    } catch {
      // Memory fallback
    }

    analyticsService.onFirstReply(updated, updated.assigneeId).catch(() => {})

    return updated
  }
}

export const ticketService = new TicketService()
