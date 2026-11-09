import {
  type Contact,
  ContactSchema,
  type Conversation,
  ConversationSchema,
  type Message,
  MessageSchema,
  type Ticket,
  TicketSchema,
} from '@xatxoot/shared'
import { parseJsonField, sql, toIsoString } from './connection'

// ==========================================
// SQL Columns Fragments (Raw SQL with aliases)
// ==========================================

export function contactColumns(prefix = ''): ReturnType<typeof sql.unsafe> {
  const p = prefix ? `${prefix}.` : ''
  return sql.unsafe(`
    ${p}id,
    ${p}company_id as "companyId",
    ${p}name,
    ${p}phone_number as "phoneNumber",
    ${p}email,
    ${p}avatar_url as "avatarUrl",
    ${p}identifier,
    ${p}contact_type as "contactType",
    ${p}custom_attributes as "customAttributes",
    ${p}additional_attributes as "additionalAttributes",
    ${p}blocked,
    ${p}deleted_at as "deletedAt",
    ${p}created_at as "createdAt",
    ${p}updated_at as "updatedAt"
  `)
}
export const CONTACT_COLUMNS = contactColumns()

export function conversationColumns(prefix = ''): ReturnType<typeof sql.unsafe> {
  const p = prefix ? `${prefix}.` : ''
  return sql.unsafe(`
    ${p}id,
    ${p}inbox_id as "inboxId",
    ${p}contact_id as "contactId",
    ${p}contact_inbox_id as "contactInboxId",
    ${p}active_ticket_id as "activeTicketId",
    ${p}unread_count as "unreadCount",
    ${p}last_message_at as "lastMessageAt",
    ${p}deleted_at as "deletedAt",
    ${p}created_at as "createdAt",
    ${p}updated_at as "updatedAt"
  `)
}
export const CONVERSATION_COLUMNS = conversationColumns()

export function ticketColumns(prefix = ''): ReturnType<typeof sql.unsafe> {
  const p = prefix ? `${prefix}.` : ''
  return sql.unsafe(`
    ${p}id,
    ${p}display_id as "displayId",
    ${p}conversation_id as "conversationId",
    ${p}assignee_id as "assigneeId",
    ${p}team_id as "teamId",
    ${p}status,
    ${p}priority,
    ${p}snoozed_until as "snoozedUntil",
    ${p}waiting_since as "waitingSince",
    ${p}deadline_at as "deadlineAt",
    ${p}first_reply_created_at as "firstReplyCreatedAt",
    ${p}opened_at as "openedAt",
    ${p}resolved_at as "resolvedAt",
    ${p}internal_note as "internalNote",
    ${p}internal_note_updated_by as "internalNoteUpdatedBy",
    ${p}internal_note_updated_at as "internalNoteUpdatedAt",
    ${p}custom_attributes as "customAttributes",
    ${p}created_at as "createdAt",
    ${p}updated_at as "updatedAt"
  `)
}
export const TICKET_COLUMNS = ticketColumns()

export function messageColumns(prefix = ''): ReturnType<typeof sql.unsafe> {
  const p = prefix ? `${prefix}.` : ''
  return sql.unsafe(`
    ${p}id,
    ${p}conversation_id as "conversationId",
    ${p}ticket_id as "ticketId",
    ${p}sender_type as "senderType",
    ${p}sender_id as "senderId",
    ${p}message_type as "messageType",
    ${p}content,
    ${p}content_type as "contentType",
    ${p}status,
    ${p}external_source_id as "externalSourceId",
    ${p}content_attributes as "contentAttributes",
    ${p}created_at as "createdAt",
    ${p}updated_at as "updatedAt"
  `)
}
export const MESSAGE_COLUMNS = messageColumns()

export function messageColumnsWithUser(
  prefix = 'm',
  userPrefix = 'u',
): ReturnType<typeof sql.unsafe> {
  const m = prefix ? `${prefix}.` : ''
  const u = userPrefix ? `${userPrefix}.` : ''
  return sql.unsafe(`
    ${m}id,
    ${m}conversation_id as "conversationId",
    ${m}ticket_id as "ticketId",
    ${m}sender_type as "senderType",
    ${m}sender_id as "senderId",
    COALESCE(${u}display_name, ${m}content_attributes->>'senderName', CASE WHEN ${m}sender_type = 'bot' THEN 'Bot Otomasi' ELSE NULL END) as "senderName",
    ${u}email as "senderEmail",
    ${m}message_type as "messageType",
    ${m}content,
    ${m}content_type as "contentType",
    ${m}status,
    ${m}external_source_id as "externalSourceId",
    ${m}content_attributes as "contentAttributes",
    ${m}created_at as "createdAt",
    ${m}updated_at as "updatedAt"
  `)
}

// ==========================================
// Type-Safe Query Mappers (Zod-backed)
// ==========================================

export function mapRowToContact(raw: unknown): Contact {
  const row = (raw || {}) as Record<string, unknown>
  const customAttributes = parseJsonField(row.customAttributes ?? row.custom_attributes, {})
  const additionalAttributes = parseJsonField(
    row.additionalAttributes ?? row.additional_attributes,
    {},
  )

  const candidate = {
    id: String(row.id || ''),
    companyId: (row.companyId ?? row.company_id ?? null) as string | null,
    name: (row.name as string | null) ?? null,
    phoneNumber: (row.phoneNumber ?? row.phone_number ?? null) as string | null,
    email: (row.email as string | null) ?? null,
    avatarUrl: (row.avatarUrl ?? row.avatar_url ?? null) as string | null,
    identifier: (row.identifier as string | null) ?? null,
    contactType: (row.contactType ?? row.contact_type ?? 'lead') as Contact['contactType'],
    customAttributes,
    additionalAttributes,
    blocked: Boolean(row.blocked),
    deletedAt: toIsoString(row.deletedAt ?? row.deleted_at),
    createdAt: toIsoString(row.createdAt ?? row.created_at) || new Date().toISOString(),
    updatedAt: toIsoString(row.updatedAt ?? row.updated_at) || new Date().toISOString(),
  }

  const parsed = ContactSchema.safeParse(candidate)
  if (parsed.success) {
    return parsed.data
  }
  return candidate as Contact
}

export function mapRowToConversation(raw: unknown): Conversation {
  const row = (raw || {}) as Record<string, unknown>
  const candidate = {
    id: String(row.id || ''),
    inboxId: String(row.inboxId ?? row.inbox_id ?? ''),
    contactId: (row.contactId ?? row.contact_id ?? null) as string | null,
    contactInboxId: (row.contactInboxId ?? row.contact_inbox_id ?? null) as string | null,
    activeTicketId: (row.activeTicketId ?? row.active_ticket_id ?? null) as string | null,
    unreadCount: Number(row.unreadCount ?? row.unread_count ?? 0),
    lastMessageAt:
      toIsoString(row.lastMessageAt ?? row.last_message_at) || new Date().toISOString(),
    inboxName: (row.inboxName ?? row.inbox_name ?? null) as string | null,
    channelType: (row.channelType ?? row.channel_type ?? null) as string | null,
    channel: (row.channel ?? row.channel_type ?? null) as string | null,
    deletedAt: toIsoString(row.deletedAt ?? row.deleted_at),
    createdAt: toIsoString(row.createdAt ?? row.created_at) || new Date().toISOString(),
    updatedAt: toIsoString(row.updatedAt ?? row.updated_at) || new Date().toISOString(),
  }

  const parsed = ConversationSchema.safeParse(candidate)
  if (parsed.success) {
    return parsed.data
  }
  return candidate as Conversation
}

export function mapRowToTicket(raw: unknown): Ticket {
  const row = (raw || {}) as Record<string, unknown>
  const customAttributes = parseJsonField(row.customAttributes ?? row.custom_attributes, {})

  const candidate = {
    id: String(row.id || ''),
    displayId: Number(row.displayId ?? row.display_id ?? 0),
    conversationId: String(row.conversationId ?? row.conversation_id ?? ''),
    assigneeId: (row.assigneeId ?? row.assignee_id ?? null) as string | null,
    teamId: (row.teamId ?? row.team_id ?? null) as string | null,
    status: (row.status ?? 'open') as Ticket['status'],
    priority: (row.priority ?? 'medium') as Ticket['priority'],
    snoozedUntil: toIsoString(row.snoozedUntil ?? row.snoozed_until),
    waitingSince: toIsoString(row.waitingSince ?? row.waiting_since),
    deadlineAt: toIsoString(row.deadlineAt ?? row.deadline_at),
    firstReplyCreatedAt: toIsoString(row.firstReplyCreatedAt ?? row.first_reply_created_at),
    openedAt: toIsoString(row.openedAt ?? row.opened_at) || new Date().toISOString(),
    resolvedAt: toIsoString(row.resolvedAt ?? row.resolved_at),
    internalNote: (row.internalNote ?? row.internal_note ?? null) as string | null,
    internalNoteUpdatedBy: (row.internalNoteUpdatedBy ?? row.internal_note_updated_by ?? null) as
      | string
      | null,
    internalNoteUpdatedAt: toIsoString(row.internalNoteUpdatedAt ?? row.internal_note_updated_at),
    customAttributes,
    createdAt: toIsoString(row.createdAt ?? row.created_at) || new Date().toISOString(),
    updatedAt: toIsoString(row.updatedAt ?? row.updated_at) || new Date().toISOString(),
  }

  const parsed = TicketSchema.safeParse(candidate)
  if (parsed.success) {
    return parsed.data
  }
  return candidate as Ticket
}

export function mapRowToMessage(raw: unknown): Message {
  const row = (raw || {}) as Record<string, unknown>
  const contentAttributes = parseJsonField<Record<string, unknown>>(
    row.contentAttributes ?? row.content_attributes,
    {},
  )
  const isEcho = Boolean(
    row.isEcho ??
      contentAttributes.echo ??
      contentAttributes.isEcho ??
      contentAttributes.source === 'whatsapp_mobile',
  )
  const senderName =
    (row.senderName as string | null) ??
    (contentAttributes.senderName as string | undefined) ??
    (isEcho ? 'WhatsApp HP' : undefined)

  const candidate = {
    id: String(row.id || ''),
    conversationId: String(row.conversationId ?? row.conversation_id ?? ''),
    ticketId: (row.ticketId ?? row.ticket_id ?? null) as string | null,
    senderType: (row.senderType ?? row.sender_type ?? 'contact') as Message['senderType'],
    senderId: (row.senderId ?? row.sender_id ?? null) as string | null,
    senderName,
    senderEmail: (row.senderEmail as string | null) ?? undefined,
    isEcho,
    replyTo:
      (contentAttributes.replyTo as Message['replyTo']) ?? (row.replyTo as Message['replyTo']),
    mentions:
      (contentAttributes.mentions as Message['mentions']) ?? (row.mentions as Message['mentions']),
    isMentioningMe:
      (contentAttributes.isMentioningMe as boolean | undefined) ??
      (row.isMentioningMe as boolean | undefined),
    messageType: (row.messageType ?? row.message_type ?? 'incoming') as Message['messageType'],
    content: (row.content as string | null) ?? null,
    contentType: (row.contentType ?? row.content_type ?? 'text') as Message['contentType'],
    status: (row.status ?? 'sent') as Message['status'],
    externalSourceId: (row.externalSourceId ?? row.external_source_id ?? null) as string | null,
    contentAttributes,
    attachments: ((row.attachments as Record<string, unknown>[]) || []).map((a) => ({
      id: String(a.id),
      messageId: String(a.messageId || row.id),
      fileType: a.fileType as Message['attachments'][number]['fileType'],
      fileUrl: String(a.fileUrl),
      fileName: (a.fileName as string | null) ?? null,
      fileSize: Number(a.fileSize ?? 0),
      thumbUrl: (a.thumbUrl as string | null) ?? null,
      metadata: parseJsonField(a.metadata, {}),
      createdAt: toIsoString(a.createdAt) || new Date().toISOString(),
    })),
    createdAt: toIsoString(row.createdAt ?? row.created_at) || new Date().toISOString(),
    updatedAt: toIsoString(row.updatedAt ?? row.updated_at) || new Date().toISOString(),
  }

  const parsed = MessageSchema.safeParse(candidate)
  if (parsed.success) {
    return parsed.data
  }
  return candidate as Message
}
