import type { Conversation, Message } from '@xatxoot/shared'
import { CONVERSATION_COLUMNS, MESSAGE_COLUMNS, sql, toValidUuid } from '../../db'
import { saveMessageToStore } from '../messages/message-store'
import { realtimeService } from '../realtime/realtime.service'
import { ticketService } from '../tickets/tickets.service'
import { conversationInboundService } from './conversation-inbound.service'
import { conversationQueryService } from './conversation-query.service'
import {
  type OutboundEchoPayload,
  type OutboundEchoResult,
  ensureInboxExists,
  mapConversationRow,
  mapMessageRow,
} from './conversation.types'

export class ConversationEchoService {
  async handleOutboundEcho(payload: OutboundEchoPayload): Promise<OutboundEchoResult> {
    const validInboxId = toValidUuid(payload.inboxId)
    await ensureInboxExists(validInboxId)
    const now = new Date().toISOString()

    // 1. Idempotency Check: check if message with externalId already exists
    if (payload.externalId) {
      const rows = await sql`
        SELECT ${MESSAGE_COLUMNS}
        FROM messages WHERE external_source_id = ${payload.externalId} LIMIT 1
      `
      if (rows.length > 0) {
        const attRows = await sql`
          SELECT id, message_id as "messageId", file_type as "fileType", file_url as "fileUrl",
                 file_name as "fileName", file_size as "fileSize", created_at as "createdAt"
          FROM attachments WHERE message_id = ${rows[0].id}
        `
        const existingMsg = mapMessageRow({ ...rows[0], attachments: attRows || [] })
        if (
          payload.mediaUrl &&
          (!existingMsg.attachments || existingMsg.attachments.length === 0)
        ) {
          existingMsg.attachments = [
            {
              id: crypto.randomUUID(),
              messageId: existingMsg.id,
              fileType:
                payload.messageType === 'image'
                  ? 'image/jpeg'
                  : payload.messageType === 'document'
                    ? 'application/pdf'
                    : 'application/octet-stream',
              fileUrl: payload.mediaUrl,
              fileName: payload.mediaUrl.split('/').pop() || null,
              fileSize: null,
              createdAt: now,
            },
          ]
        }
        existingMsg.isEcho = true
        existingMsg.senderName = 'WhatsApp HP'
        if (typeof existingMsg.contentAttributes === 'object' && existingMsg.contentAttributes) {
          existingMsg.contentAttributes.echo = true
          existingMsg.contentAttributes.isEcho = true
          existingMsg.contentAttributes.source = 'whatsapp_mobile'
          existingMsg.contentAttributes.senderName = 'WhatsApp HP'
          if (payload.mediaUrl) {
            existingMsg.contentAttributes.mediaUrl = payload.mediaUrl
          }
        }
        saveMessageToStore(existingMsg)
        const conv = await conversationQueryService.getConversationById(existingMsg.conversationId)
        if (conv?.contact) {
          return {
            contact: conv.contact,
            conversation: conv.conversation,
            ticket: conv.activeTicket,
            message: existingMsg,
            isDuplicate: true,
          }
        }
      }
    }

    // 2. Find or create Contact & ContactInbox for customer
    const formattedPhone = payload.senderPhone || payload.sourceId
    const isGroup = Boolean(payload.sourceId?.endsWith('@g.us'))
    // For outbound echo messages, the sender is an agent (sender_type === 'user').
    // The profile name in payload.senderName belongs to the agent/operator, not the recipient customer.
    const customerName = isGroup ? payload.senderName || 'Grup WhatsApp' : formattedPhone

    const { contact, contactInbox } = await conversationInboundService.findOrCreateContact({
      inboxId: validInboxId,
      sourceId: payload.sourceId,
      phone: payload.senderPhone,
      name: customerName,
    })

    // 3. Find or create persistent Conversation thread
    let conversation: Conversation | null = null
    const convRows = await sql`
      SELECT ${CONVERSATION_COLUMNS}
      FROM conversations WHERE inbox_id = ${validInboxId} AND contact_id = ${contact.id} LIMIT 1
    `
    if (convRows.length > 0) {
      conversation = mapConversationRow(convRows[0])
    }

    if (!conversation) {
      const convId = crypto.randomUUID()
      conversation = {
        id: convId,
        inboxId: validInboxId,
        contactId: contact.id,
        contactInboxId: contactInbox.id,
        activeTicketId: null,
        unreadCount: 0,
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
      }
      await sql`
        INSERT INTO conversations (id, inbox_id, contact_id, contact_inbox_id, active_ticket_id, unread_count, last_message_at, created_at, updated_at)
        VALUES (${conversation.id}, ${conversation.inboxId}, ${conversation.contactId}, ${conversation.contactInboxId},
          ${conversation.activeTicketId}, ${conversation.unreadCount}, ${conversation.lastMessageAt}, ${conversation.createdAt}, ${conversation.updatedAt})
      `
    }

    // 4. Update Conversation last_message_at
    await sql`UPDATE conversations SET last_message_at = ${now}, updated_at = ${now} WHERE id = ${conversation.id}`
    conversation.lastMessageAt = now
    conversation.updatedAt = now

    // 5. Active Ticket (do not alter status or unread count for echo)
    const activeTicket = conversation.activeTicketId
      ? await ticketService.getTicketById(conversation.activeTicketId)
      : null

    // 6. Create Message record as 'outgoing'
    const finalContentType =
      payload.contentType || (payload.messageType === 'image' ? 'image' : undefined) || 'text'

    const attachments = payload.mediaUrl
      ? [
          {
            id: crypto.randomUUID(),
            messageId: '',
            fileType:
              payload.messageType === 'image'
                ? 'image/jpeg'
                : payload.messageType === 'document'
                  ? 'application/pdf'
                  : 'application/octet-stream',
            fileUrl: payload.mediaUrl,
            fileName: payload.mediaUrl.split('/').pop() || null,
            fileSize: null,
            createdAt: now,
          },
        ]
      : []

    const senderName = 'WhatsApp HP'
    const message: Message = {
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      ticketId: activeTicket?.id || null,
      senderType: 'user',
      senderId: null,
      senderName,
      isEcho: true,
      messageType: 'outgoing',
      content: payload.content ?? null,
      contentType: finalContentType as unknown as Message['contentType'],
      status: 'sent',
      externalSourceId: payload.externalId ?? null,
      contentAttributes: {
        echo: true,
        isEcho: true,
        source: 'whatsapp_mobile',
        senderName,
        mediaUrl: payload.mediaUrl || undefined,
      },
      attachments,
      createdAt: now,
      updatedAt: now,
    }

    if (message.attachments[0]) {
      message.attachments[0].messageId = message.id
    }

    await sql`
      INSERT INTO messages (id, conversation_id, ticket_id, sender_type, sender_id, message_type, content, content_type, status, external_source_id, content_attributes, created_at, updated_at)
      VALUES (${message.id}, ${message.conversationId}, ${message.ticketId}, ${message.senderType},
        ${message.senderId}, ${message.messageType}, ${message.content}, ${message.contentType},
        ${message.status}, ${message.externalSourceId}, ${JSON.stringify(message.contentAttributes)},
        ${message.createdAt}, ${message.updatedAt})
    `

    if (payload.mediaUrl && message.attachments[0]) {
      await sql`
        INSERT INTO attachments (id, message_id, file_type, file_url, file_size, file_name, metadata, created_at)
        VALUES (${message.attachments[0].id}, ${message.id}, ${message.attachments[0].fileType},
          ${payload.mediaUrl}, ${message.attachments[0].fileSize ?? 0}, ${message.attachments[0].fileName}, '{}', ${now})
      `
    }

    saveMessageToStore(message)

    realtimeService.broadcast({
      event: 'message.created',
      data: {
        id: message.id,
        conversationId: conversation.id,
        content: message.content || '',
        messageType: message.messageType,
        contentType: message.contentType,
        senderId: message.senderId,
        senderType: message.senderType,
        senderName: message.senderName,
        status: message.status,
        timestamp: message.createdAt,
        createdAt: message.createdAt,
        message,
        conversation,
        contact,
        ticket: activeTicket,
        isNewTicket: false,
      },
    })

    return {
      contact,
      conversation,
      ticket: activeTicket,
      message,
    }
  }
}

export const conversationEchoService = new ConversationEchoService()
