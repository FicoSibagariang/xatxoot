import type { Contact, ContactInbox, Conversation, Message, Ticket } from '@xatxoot/shared'
import { sql, toValidUuid } from '../../db'
import { assignmentService } from '../assignment/assignment.service'
import { messageStore, saveMessageToStore } from '../messages/message-store'
import { realtimeService } from '../realtime/realtime.service'
import { ticketService } from '../tickets/tickets.service'
import { conversationGroupService } from './conversation-group.service'
import { conversationQueryService } from './conversation-query.service'
import {
  type FindOrCreateContactDto,
  type InboundMessagePayload,
  type InboundMessageResult,
  ensureInboxExists,
  findOrCreateContact,
  mapContactInboxRow,
  mapContactRow,
  mapConversationRow,
  mapMessageRow,
  parseContentAttributes,
} from './conversation.types'

export class ConversationInboundService {
  async findOrCreateContact(
    dto: FindOrCreateContactDto,
  ): Promise<{ contact: Contact; contactInbox: ContactInbox }> {
    return findOrCreateContact(dto)
  }

  private async resolveReplyTo(payload: InboundMessagePayload) {
    if (!payload.replyToExternalId) return undefined
    try {
      const targetMsg = await conversationQueryService.findMessageByExternalId(
        payload.replyToExternalId,
      )
      if (targetMsg) {
        const targetAttrs = parseContentAttributes(targetMsg.contentAttributes)
        const targetSenderName =
          targetMsg.senderName ||
          (targetAttrs.senderName as string | undefined) ||
          (targetAttrs.participantName as string | undefined) ||
          (targetMsg.senderType === 'user'
            ? 'Petugas CS'
            : targetMsg.senderType === 'contact'
              ? 'Pelanggan'
              : 'Bot Otomasi')
        const snippet = (
          targetMsg.content ||
          (targetMsg.contentType === 'image' || targetAttrs.contentType === 'image'
            ? '[Gambar]'
            : '') ||
          payload.quotedText ||
          ''
        ).slice(0, 100)
        return {
          messageId: targetMsg.id,
          externalId: targetMsg.externalSourceId || payload.replyToExternalId,
          senderName: targetSenderName,
          snippet,
        }
      }
      let fallbackSenderName = 'Kutipan'
      if (payload.quotedParticipant) {
        const rawPart = payload.quotedParticipant
          .replace(/@s\.whatsapp\.net$/, '')
          .replace(/@c\.us$/, '')
          .replace(/:.*$/, '')
        fallbackSenderName = rawPart.startsWith('+') ? rawPart : `+${rawPart}`
      }
      return {
        messageId: payload.replyToExternalId,
        externalId: payload.replyToExternalId,
        senderName: fallbackSenderName,
        snippet: (payload.quotedText || '').slice(0, 100),
      }
    } catch {
      return {
        messageId: payload.replyToExternalId,
        externalId: payload.replyToExternalId,
        senderName: 'Kutipan',
        snippet: (payload.quotedText || '').slice(0, 100),
      }
    }
  }

  async handleInboundMessage(payload: InboundMessagePayload): Promise<InboundMessageResult> {
    const validInboxId = toValidUuid(payload.inboxId)
    await ensureInboxExists(validInboxId)
    const now = payload.createdAt || new Date().toISOString()

    // 0. Idempotency Check
    if (payload.externalId) {
      let existingMsg: Message | null = null
      for (const msg of messageStore.messages.values()) {
        if (msg.externalSourceId === payload.externalId) {
          existingMsg = msg
          break
        }
      }
      if (!existingMsg) {
        const rows = await sql`
          SELECT id, conversation_id as "conversationId", ticket_id as "ticketId", sender_type as "senderType", sender_id as "senderId",
                 message_type as "messageType", content, content_type as "contentType", status, external_source_id as "externalSourceId",
                 content_attributes as "contentAttributes", created_at as "createdAt", updated_at as "updatedAt"
          FROM messages WHERE external_source_id = ${payload.externalId} LIMIT 1
        `
        if (rows && rows.length > 0) {
          existingMsg = mapMessageRow(rows[0])
          saveMessageToStore(existingMsg)
        }
      }
      if (existingMsg) {
        const convDetail = await conversationQueryService.getConversationById(
          existingMsg.conversationId,
        )
        return {
          contact:
            convDetail?.contact ||
            ({ id: crypto.randomUUID(), name: payload.senderName || 'Kontak' } as Contact),
          conversation:
            convDetail?.conversation || ({ id: existingMsg.conversationId } as Conversation),
          ticket: convDetail?.activeTicket || ({} as Ticket),
          isNewTicket: false,
          message: existingMsg,
        }
      }
    }

    const { isGroup, groupJid, effectivePhone, effectiveSourceId, defaultName } =
      conversationGroupService.resolveGroupMetadata({
        isGroup: payload.isGroup,
        sourceId: payload.sourceId,
        groupJid: payload.groupJid,
        senderPhone: payload.senderPhone,
        senderNumber:
          payload.senderNumber ||
          ((payload as Record<string, unknown>).senderNumber as string | undefined),
        senderName: payload.senderName,
        fallbackInboxId: validInboxId,
      })

    // 1. Find or create Contact & ContactInbox
    const { contact, contactInbox } = await this.findOrCreateContact({
      inboxId: validInboxId,
      sourceId: effectiveSourceId,
      phone: effectivePhone,
      name: defaultName,
    })

    // 2. Find or create persistent Conversation thread
    let conversation: Conversation | null = null
    if (isGroup && groupJid) {
      const gRows = await sql`
        SELECT id, inbox_id as "inboxId", contact_id as "contactId", contact_inbox_id as "contactInboxId",
               active_ticket_id as "activeTicketId", unread_count as "unreadCount", last_message_at as "lastMessageAt",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM conversations WHERE contact_id = ${contact.id} LIMIT 1
      `
      if (gRows.length > 0) conversation = mapConversationRow(gRows[0])
    }

    if (!conversation) {
      const cRows = await sql`
        SELECT id, inbox_id as "inboxId", contact_id as "contactId", contact_inbox_id as "contactInboxId",
               active_ticket_id as "activeTicketId", unread_count as "unreadCount", last_message_at as "lastMessageAt",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM conversations WHERE inbox_id = ${validInboxId} AND contact_id = ${contact.id} LIMIT 1
      `
      if (cRows.length > 0) conversation = mapConversationRow(cRows[0])
    }

    if (!conversation) {
      conversation = {
        id: crypto.randomUUID(),
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

    // 3. Ticket FSM Lifecycle automation & Internal Participant Check
    const isInternal = Boolean(
      payload.isEcho ||
        (payload.participant && conversationGroupService.isCompanyPhoneNumber(payload.participant)),
    )
    let ticket: Ticket
    let isNewTicket = false
    const activeTicket = conversation.activeTicketId
      ? await ticketService.getTicketById(conversation.activeTicketId)
      : null

    if (isInternal) {
      ticket = activeTicket || ({} as Ticket)
      isNewTicket = false
      conversation = { ...conversation, lastMessageAt: now, updatedAt: now }
      await sql`UPDATE conversations SET last_message_at = ${now}, updated_at = ${now} WHERE id = ${conversation.id}`
    } else {
      if (!activeTicket || activeTicket.status === 'resolved') {
        ticket = await ticketService.createTicket({
          conversationId: conversation.id,
          status: 'open',
          priority: 'medium',
        })
        isNewTicket = true
        try {
          const assignResult = await assignmentService.assignTicketRoundRobin(ticket.id, {
            inboxId: conversation.inboxId,
          })
          if (assignResult.success && assignResult.assignedAgentId) ticket = assignResult.ticket
        } catch {
          /* ignore assignment error */
        }
      } else if (activeTicket.status === 'pending' || activeTicket.status === 'snoozed') {
        ticket = await ticketService.updateTicketStatus(activeTicket.id, 'open')
        isNewTicket = false
      } else {
        ticket = activeTicket
        isNewTicket = false
      }

      conversation = {
        ...conversation,
        activeTicketId: ticket.id,
        unreadCount: (conversation.unreadCount || 0) + 1,
        lastMessageAt: now,
        updatedAt: now,
      }
      await sql`
        UPDATE conversations SET active_ticket_id = ${ticket.id}, unread_count = ${conversation.unreadCount}, last_message_at = ${now}, updated_at = ${now}
        WHERE id = ${conversation.id}
      `
    }

    // 4. Message Record
    const replyTo = await this.resolveReplyTo(payload)
    const customerSenderName = contact.name || payload.senderName || 'Pelanggan'
    const finalSenderName = conversationGroupService.resolveParticipantSenderName(
      {
        isGroup,
        participant: payload.participant,
        participantName: payload.participantName,
        senderName: payload.senderName,
        isInternal,
      },
      customerSenderName,
    )
    const finalContentType =
      payload.contentType || (payload.messageType === 'image' ? 'image' : undefined) || 'text'

    let isMentioningMe = false
    let finalMentions = payload.mentions ? [...payload.mentions] : undefined
    if (finalMentions && finalMentions.length > 0) {
      finalMentions = finalMentions.map((m) => {
        const cleanPhone = m.phone
          ? m.phone.replace(/\D/g, '')
          : m.jid.split('@')[0].replace(/\D/g, '')
        const isMe = Boolean(
          m.isMe || (cleanPhone && conversationGroupService.isCompanyPhoneNumber(cleanPhone)),
        )
        if (isMe) isMentioningMe = true
        return { ...m, isMe: isMe || undefined }
      })
    }

    const message: Message = {
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      ticketId: ticket.id || null,
      senderType: isInternal ? 'user' : 'contact',
      senderId: isInternal ? null : contact.id,
      senderName: finalSenderName,
      messageType: isInternal
        ? 'outgoing'
        : (payload.messageType as unknown as Message['messageType']) || 'incoming',
      content: payload.content ?? null,
      contentType: finalContentType as unknown as Message['contentType'],
      status: isInternal ? 'sent' : 'delivered',
      externalSourceId: payload.externalId ?? null,
      replyTo: replyTo || undefined,
      mentions: finalMentions,
      isMentioningMe: isMentioningMe || undefined,
      contentAttributes: {
        isGroup: isGroup ? true : undefined,
        groupJid,
        participant: payload.participant || undefined,
        participantName: payload.participantName || undefined,
        senderName: finalSenderName,
        mediaUrl: payload.mediaUrl || undefined,
        isEcho: isInternal ? true : undefined,
        ...(replyTo ? { replyTo } : {}),
        mentions: finalMentions,
        isMentioningMe: isMentioningMe || undefined,
      },
      attachments: payload.mediaUrl
        ? [
            {
              id: crypto.randomUUID(),
              messageId: '',
              fileType: payload.messageType === 'image' ? 'image/jpeg' : 'application/octet-stream',
              fileUrl: payload.mediaUrl,
              fileName: payload.mediaUrl.split('/').pop() || null,
              fileSize: null,
              createdAt: now,
            },
          ]
        : [],
      createdAt: now,
      updatedAt: now,
    }
    if (message.attachments[0]) message.attachments[0].messageId = message.id

    await sql`
      INSERT INTO messages (id, conversation_id, ticket_id, sender_type, sender_id, message_type, content, content_type, status, external_source_id, content_attributes, created_at, updated_at)
      VALUES (${message.id}, ${message.conversationId}, ${message.ticketId}, ${message.senderType}, ${message.senderId}, ${message.messageType}, ${message.content}, ${message.contentType}, ${message.status}, ${message.externalSourceId}, ${JSON.stringify(message.contentAttributes)}, ${message.createdAt}, ${message.updatedAt})
    `

    if (payload.mediaUrl && message.attachments[0]) {
      await sql`
        INSERT INTO attachments (id, message_id, file_type, file_url, file_size, file_name, metadata, created_at)
        VALUES (${message.attachments[0].id}, ${message.id}, ${message.attachments[0].fileType}, ${payload.mediaUrl}, ${message.attachments[0].fileSize ?? 0}, ${message.attachments[0].fileName}, '{}', ${now})
      `
    }

    saveMessageToStore(message)
    const result = { contact, conversation, ticket, isNewTicket, message }

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
        senderName: contact.name || 'Pelanggan WhatsApp',
        replyTo: message.replyTo,
        contentAttributes: message.contentAttributes,
        timestamp: message.createdAt,
        createdAt: message.createdAt,
        message,
        conversation,
        contact,
        ticket,
        isNewTicket,
      },
    })

    return result
  }
}

export const conversationInboundService = new ConversationInboundService()
