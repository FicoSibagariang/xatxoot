import type {
  Contact,
  ContactInbox,
  Conversation,
  Message,
  Ticket,
  TicketStatus,
} from '@xatxoot/shared'
import { sql, toIsoString, toValidUuid } from '../../db'
import { resetMessageStore } from '../messages/message-store'
import { resetTicketStore } from '../tickets/tickets.service'

export type { Contact, ContactInbox, Conversation, Message, Ticket, TicketStatus }

export function parseContentAttributes(raw: unknown): Record<string, unknown> {
  if (!raw) return {}
  if (typeof raw === 'object' && raw !== null) return raw as Record<string, unknown>
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {}
    } catch {
      return {}
    }
  }
  return {}
}

export interface ConversationWithInbox extends Conversation {
  inboxName?: string | null
  channelType?: string | null
  channel?: string | null
}

export interface InboundMessagePayload {
  inboxId: string
  sourceId?: string
  senderPhone?: string | null
  senderNumber?: string | null
  senderName?: string | null
  content?: string | null
  messageType?: string
  externalId?: string | null
  contentType?: string
  mediaUrl?: string | null
  createdAt?: string
  isGroup?: boolean
  groupJid?: string | null
  groupName?: string | null
  participant?: string | null
  participantName?: string | null
  isEcho?: boolean
  replyToExternalId?: string | null
  quotedText?: string | null
  quotedParticipant?: string | null
  mentions?: Array<{
    jid: string
    phone?: string
    name?: string
    isMe?: boolean
  }> | null
}

export interface InboundMessageResult {
  contact: Contact
  conversation: Conversation
  ticket: Ticket
  isNewTicket: boolean
  message: Message
}

export interface OutboundEchoPayload {
  inboxId: string
  sourceId: string
  senderPhone?: string | null
  senderName?: string | null
  content?: string | null
  messageType?: string
  externalId?: string | null
  contentType?: string
  mediaUrl?: string | null
  replyToExternalId?: string | null
  quotedText?: string | null
  quotedParticipant?: string | null
  mentions?: Array<{
    jid: string
    phone?: string
    name?: string
    isMe?: boolean
  }> | null
}

export interface OutboundEchoResult {
  contact: Contact
  conversation: Conversation
  ticket: Ticket | null
  message: Message
  isDuplicate?: boolean
}

export interface FindOrCreateContactDto {
  inboxId: string
  sourceId: string
  phone?: string | null
  name?: string | null
}

export interface ConversationPagination {
  hasMore: boolean
  nextCursor?: string
  limit: number
}

export interface ConversationDetail {
  conversation: Conversation
  contact: Contact | null
  activeTicket: Ticket | null
  messages: Message[]
  pagination?: ConversationPagination
}

export interface GetConversationOptions {
  limit?: number
  before?: string
}

export function mapContactRow(row: Record<string, unknown>): Contact {
  return {
    id: String(row.id),
    companyId: (row.companyId as string | null) ?? null,
    name: String(row.name),
    phoneNumber: (row.phoneNumber as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    avatarUrl: (row.avatarUrl as string | null) ?? null,
    identifier: (row.identifier as string | null) ?? null,
    contactType: (row.contactType as Contact['contactType']) ?? 'lead',
    customAttributes:
      typeof row.customAttributes === 'string'
        ? JSON.parse(row.customAttributes)
        : (row.customAttributes as Record<string, unknown>) || {},
    additionalAttributes:
      typeof row.additionalAttributes === 'string'
        ? JSON.parse(row.additionalAttributes)
        : (row.additionalAttributes as Record<string, unknown>) || {},
    blocked: Boolean(row.blocked),
    createdAt: toIsoString(row.createdAt) || (row.createdAt as string),
    updatedAt: toIsoString(row.updatedAt) || (row.updatedAt as string),
  }
}

export function mapConversationRow(row: Record<string, unknown>): Conversation {
  return {
    id: String(row.id),
    inboxId: row.inboxId ? String(row.inboxId) : '',
    contactId: row.contactId ? String(row.contactId) : '',
    contactInboxId: row.contactInboxId ? String(row.contactInboxId) : null,
    activeTicketId: row.activeTicketId ? String(row.activeTicketId) : null,
    unreadCount: Number(row.unreadCount ?? 0),
    lastMessageAt: toIsoString(row.lastMessageAt) || (row.lastMessageAt as string),
    createdAt: toIsoString(row.createdAt) || (row.createdAt as string),
    updatedAt: toIsoString(row.updatedAt) || (row.updatedAt as string),
  }
}

export function mapContactInboxRow(row: Record<string, unknown>): ContactInbox {
  return {
    id: String(row.id),
    contactId: row.contactId ? String(row.contactId) : '',
    inboxId: row.inboxId ? String(row.inboxId) : '',
    sourceId: row.sourceId ? String(row.sourceId) : '',
    hmacVerified: Boolean(row.hmacVerified),
    createdAt: toIsoString(row.createdAt) || (row.createdAt as string),
    updatedAt: toIsoString(row.updatedAt) || (row.updatedAt as string),
  }
}

export function mapMessageRow(row: Record<string, unknown>): Message {
  const attrs = parseContentAttributes(row.contentAttributes)
  const isEcho = Boolean(attrs.echo || attrs.isEcho || attrs.source === 'whatsapp_mobile')
  const senderName =
    (row.senderName as string) ||
    (attrs.senderName as string | undefined) ||
    (isEcho ? 'WhatsApp HP' : undefined)
  return {
    id: String(row.id),
    conversationId: String(row.conversationId),
    ticketId: row.ticketId ? String(row.ticketId) : null,
    senderType: row.senderType as Message['senderType'],
    senderId: row.senderId ? String(row.senderId) : null,
    senderName,
    senderEmail: (row.senderEmail as string) || undefined,
    isEcho,
    messageType: row.messageType as Message['messageType'],
    content: (row.content as string | null) ?? null,
    contentType: row.contentType as Message['contentType'],
    mediaUrl: (attrs.mediaUrl as string | undefined) || undefined,
    status: row.status as Message['status'],
    externalSourceId: row.externalSourceId ? String(row.externalSourceId) : null,
    replyTo: attrs.replyTo as Message['replyTo'],
    mentions: attrs.mentions as Message['mentions'],
    isMentioningMe: attrs.isMentioningMe as boolean | undefined,
    contentAttributes: attrs,
    attachments: ((row.attachments as Record<string, unknown>[]) || []).map((a) => ({
      id: String(a.id),
      messageId: String(a.messageId || row.id),
      fileType: a.fileType as Message['attachments'][number]['fileType'],
      fileUrl: String(a.fileUrl),
      fileName: (a.fileName as string | null) ?? null,
      fileSize: (a.fileSize as number | null) ?? null,
      createdAt: toIsoString(a.createdAt) || (a.createdAt as string),
    })),
    createdAt: toIsoString(row.createdAt) || (row.createdAt as string),
    updatedAt: toIsoString(row.updatedAt) || (row.updatedAt as string),
  }
}

export async function ensureInboxExists(inboxId: string): Promise<void> {
  const validId = toValidUuid(inboxId)
  await sql`
    INSERT INTO inboxes (id, name, channel_type, channel_id, created_at, updated_at)
    VALUES (${validId}, 'Inbox ' || ${validId}, 'whatsapp', ${crypto.randomUUID()}, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `
}

export async function resetConversationStore(): Promise<void> {
  await sql`DELETE FROM attachments`
  await sql`DELETE FROM messages`
  await sql`DELETE FROM tickets`
  await sql`DELETE FROM conversations`
  await sql`DELETE FROM contact_inboxes`
  await sql`DELETE FROM contacts`
  await resetMessageStore()
  await resetTicketStore()
}

export async function findOrCreateContact(
  dto: FindOrCreateContactDto,
): Promise<{ contact: Contact; contactInbox: ContactInbox }> {
  const validInboxId = toValidUuid(dto.inboxId)
  await ensureInboxExists(validInboxId)
  const phone = dto.phone || dto.sourceId
  const now = new Date().toISOString()

  const rows = await sql`
    SELECT id, company_id as "companyId", name, phone_number as "phoneNumber", email, avatar_url as "avatarUrl",
           identifier, contact_type as "contactType", custom_attributes as "customAttributes",
           additional_attributes as "additionalAttributes", blocked, created_at as "createdAt", updated_at as "updatedAt"
    FROM contacts
    WHERE phone_number = ${phone} OR identifier = ${dto.sourceId} OR id::text = ${dto.sourceId}
    LIMIT 1
  `

  let contact: Contact
  if (rows && rows.length > 0) {
    contact = mapContactRow(rows[0])
    const isPlaceholder =
      !contact.name ||
      ['Unknown', contact.phoneNumber, contact.identifier, 'Nia', 'Grup WhatsApp'].includes(
        contact.name,
      )
    if (
      dto.name &&
      isPlaceholder &&
      dto.name !== contact.phoneNumber &&
      dto.name !== 'Unknown' &&
      dto.name !== 'Grup WhatsApp'
    ) {
      contact = { ...contact, name: dto.name, updatedAt: now }
      await sql`UPDATE contacts SET name = ${dto.name}, updated_at = ${now} WHERE id = ${contact.id}`
    }
  } else {
    contact = {
      id: crypto.randomUUID(),
      companyId: null,
      name: dto.name || 'Unknown',
      phoneNumber: phone,
      email: null,
      avatarUrl: null,
      identifier: dto.sourceId,
      contactType: 'lead',
      customAttributes: {},
      additionalAttributes: {},
      blocked: false,
      createdAt: now,
      updatedAt: now,
    }
    await sql`
      INSERT INTO contacts (id, name, phone_number, identifier, contact_type, custom_attributes, additional_attributes, blocked, created_at, updated_at)
      VALUES (${contact.id}, ${contact.name}, ${contact.phoneNumber}, ${contact.identifier}, ${contact.contactType},
        ${JSON.stringify(contact.customAttributes)}, ${JSON.stringify(contact.additionalAttributes)}, ${contact.blocked}, ${contact.createdAt}, ${contact.updatedAt})
    `
  }

  const ciRows = await sql`
    SELECT id, contact_id as "contactId", inbox_id as "inboxId", source_id as "sourceId", hmac_verified as "hmacVerified", created_at as "createdAt", updated_at as "updatedAt"
    FROM contact_inboxes WHERE contact_id = ${contact.id} AND inbox_id = ${validInboxId} LIMIT 1
  `

  let contactInbox: ContactInbox
  if (ciRows && ciRows.length > 0) {
    contactInbox = mapContactInboxRow(ciRows[0])
  } else {
    contactInbox = {
      id: crypto.randomUUID(),
      contactId: contact.id,
      inboxId: validInboxId,
      sourceId: dto.sourceId || dto.phoneNumber || contact.phone || contact.id,
      hmacVerified: false,
      createdAt: now,
      updatedAt: now,
    }
    await sql`
      INSERT INTO contact_inboxes (id, contact_id, inbox_id, source_id, hmac_verified, created_at, updated_at)
      VALUES (${contactInbox.id}, ${contactInbox.contactId}, ${contactInbox.inboxId}, ${contactInbox.sourceId}, ${contactInbox.hmacVerified}, ${contactInbox.createdAt}, ${contactInbox.updatedAt})
    `
  }
  return { contact, contactInbox }
}
