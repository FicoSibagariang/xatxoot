import type { Contact, Message, Ticket, TicketStatus } from '@xatxoot/shared'
import {
  CONTACT_COLUMNS,
  MESSAGE_COLUMNS,
  conversationColumns,
  messageColumnsWithUser,
  sql,
  toIsoString,
} from '../../db'
import { messageStore, saveMessageToStore } from '../messages/message-store'
import { ticketService } from '../tickets/tickets.service'
import { conversationGroupService } from './conversation-group.service'
import {
  type ConversationDetail,
  type ConversationWithInbox,
  type GetConversationOptions,
  mapContactRow,
  mapConversationRow,
  mapMessageRow,
  parseContentAttributes,
} from './conversation.types'

export class ConversationQueryService {
  async findMessageByExternalId(externalId: string): Promise<Message | null> {
    if (!externalId) return null
    const fromStore = Array.from(messageStore.messages.values()).find(
      (m) => m.externalSourceId === externalId,
    )
    if (fromStore) return fromStore

    const rows = await sql`
      SELECT ${MESSAGE_COLUMNS}
      FROM messages
      WHERE external_source_id = ${externalId}
      LIMIT 1
    `
    if (rows && rows.length > 0) {
      const msg = mapMessageRow(rows[0])
      saveMessageToStore(msg)
      return msg
    }
    return null
  }

  async getConversationById(
    id: string,
    options?: GetConversationOptions,
  ): Promise<ConversationDetail | null> {
    const rows = await sql`
      SELECT ${conversationColumns('c')},
             ce.deleted_at as "deletedAt",
             i.name as "inboxName", i.channel_type as "channelType"
      FROM conversations c
      LEFT JOIN inboxes i ON c.inbox_id = i.id
      LEFT JOIN conversation_extras ce ON c.id = ce.id
      WHERE c.id = ${id} AND ce.deleted_at IS NULL
      LIMIT 1
    `
    if (!rows || rows.length === 0) {
      return null
    }

    const convRow = rows[0]
    const conversation: ConversationWithInbox = {
      ...mapConversationRow(convRow),
      inboxName: convRow.inboxName ?? null,
      channelType: convRow.channelType ?? null,
      channel: convRow.channelType ?? 'whatsapp',
    }

    let contact: Contact | null = null
    if (conversation.contactId) {
      const cRows = await sql`
        SELECT ${CONTACT_COLUMNS}
        FROM contacts WHERE id = ${conversation.contactId} LIMIT 1
      `
      if (cRows && cRows.length > 0) {
        contact = mapContactRow(cRows[0])
      }
    }

    const activeTicket = conversation.activeTicketId
      ? await ticketService.getTicketById(conversation.activeTicketId)
      : null

    const limit = Math.max(1, Math.min(100, options?.limit ?? 50))
    const beforeId = options?.before

    let messages: Message[] = []
    let hasMore = false

    let dbMsgs: unknown[] = []
    if (beforeId) {
      const cursorRows = await sql`
        SELECT created_at as "createdAt", id FROM messages WHERE id = ${beforeId} LIMIT 1
      `
      if (cursorRows && cursorRows.length > 0) {
        const cursorCreatedAt = cursorRows[0].createdAt
        dbMsgs = await sql`
          SELECT ${messageColumnsWithUser('m', 'u')},
                 t.display_id as "ticketDisplayId"
          FROM messages m
          LEFT JOIN tickets t ON m.ticket_id = t.id
          LEFT JOIN users u ON m.sender_id = u.id
          WHERE m.conversation_id = ${id}
            AND (m.created_at < ${cursorCreatedAt} OR (m.created_at = ${cursorCreatedAt} AND m.id < ${beforeId}))
          ORDER BY m.created_at DESC, m.id DESC
          LIMIT ${limit + 1}
        `
      }
    } else {
      dbMsgs = await sql`
        SELECT ${messageColumnsWithUser('m', 'u')},
               t.display_id as "ticketDisplayId"
        FROM messages m
        LEFT JOIN tickets t ON m.ticket_id = t.id
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ${id}
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT ${limit + 1}
      `
    }

    if (dbMsgs && dbMsgs.length > 0) {
      const rawBatch = (dbMsgs as unknown as Record<string, unknown>[]).map(mapMessageRow)
      hasMore = rawBatch.length > limit
      if (hasMore) {
        rawBatch.pop()
      }
      messages = rawBatch.reverse()

      const msgIds = messages.map((m) => m.id)
      if (msgIds.length > 0) {
        const attachRows = await sql`
          SELECT id, message_id as "messageId", file_type as "fileType",
                 file_url as "fileUrl", file_size as "fileSize", file_name as "fileName",
                 created_at as "createdAt"
          FROM attachments
          WHERE message_id IN ${sql(msgIds)}
        `
        if (attachRows && attachRows.length > 0) {
          const attachMap = new Map<string, Message['attachments']>()
          for (const a of attachRows) {
            const list = attachMap.get(a.messageId) || []
            list.push({
              id: a.id,
              messageId: a.messageId,
              fileType: a.fileType,
              fileUrl: a.fileUrl,
              fileSize: a.fileSize ?? null,
              fileName: a.fileName ?? null,
              createdAt: toIsoString(a.createdAt) || a.createdAt,
            })
            attachMap.set(a.messageId, list)
          }
          for (const m of messages) {
            const attached = attachMap.get(m.id)
            if (attached && attached.length > 0) {
              m.attachments = attached
              if (!m.mediaUrl && attached[0]?.fileUrl) {
                m.mediaUrl = attached[0].fileUrl
              }
            }
          }
        }
      }
    }

    const { isGroup, groupJid } = conversationGroupService.detectGroupConversation(
      conversation as Record<string, unknown>,
      contact,
    )

    let enrichedConversation = conversation
    if (isGroup) {
      enrichedConversation = {
        ...conversation,
        isGroup: true,
        groupJid,
      } as ConversationWithInbox
    }

    if (
      isGroup ||
      messages.some((m) =>
        Boolean(m.isGroup || (m.contentAttributes as Record<string, unknown> | undefined)?.isGroup),
      )
    ) {
      messages = messages.map((m) => {
        const attrs = (m.contentAttributes || {}) as Record<string, unknown>
        const msgIsGroup = Boolean(m.isGroup || attrs.isGroup || isGroup)
        return {
          ...m,
          isGroup: msgIsGroup,
          groupJid: m.groupJid || (attrs.groupJid as string | undefined) || groupJid,
          participant: m.participant || (attrs.participant as string | undefined),
          participantName: m.participantName || (attrs.participantName as string | undefined),
        }
      })
    }

    return {
      conversation: enrichedConversation,
      contact,
      activeTicket,
      messages,
      pagination: {
        hasMore,
        nextCursor: hasMore && messages.length > 0 ? messages[0].id : undefined,
        limit,
      },
    }
  }

  async markConversationAsRead(id: string): Promise<boolean> {
    const rows = await sql`
      UPDATE conversations
      SET unread_count = 0, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id
    `
    return rows.length > 0
  }

  async listConversations(filter?: { inboxId?: string }): Promise<
    Array<
      ConversationWithInbox & {
        contact: Contact | null
        activeTicket: Ticket | null
        lastMessage?: string | null
        isGroup?: boolean
        groupJid?: string
      }
    >
  > {
    const rows = filter?.inboxId
      ? await sql`
          SELECT ${conversationColumns('c')},
                 ce.deleted_at as "deletedAt",
                 i.name as "inboxName", i.channel_type as "channelType"
          FROM conversations c
          LEFT JOIN inboxes i ON c.inbox_id = i.id
          LEFT JOIN conversation_extras ce ON c.id = ce.id
          WHERE c.inbox_id = ${filter.inboxId} AND ce.deleted_at IS NULL
          ORDER BY c.last_message_at DESC
        `
      : await sql`
          SELECT ${conversationColumns('c')},
                 ce.deleted_at as "deletedAt",
                 i.name as "inboxName", i.channel_type as "channelType"
          FROM conversations c
          LEFT JOIN inboxes i ON c.inbox_id = i.id
          LEFT JOIN conversation_extras ce ON c.id = ce.id
          WHERE ce.deleted_at IS NULL
          ORDER BY c.last_message_at DESC
        `

    const conversations = ((rows || []) as unknown as Record<string, unknown>[]).map((r) => ({
      ...mapConversationRow(r),
      inboxName: r.inboxName ?? null,
      channelType: r.channelType ?? null,
      channel: r.channelType ?? 'whatsapp',
    }))

    const result = []
    for (const conv of conversations) {
      let contact: Contact | null = null
      if (conv.contactId) {
        const cRows = await sql`
          SELECT ${CONTACT_COLUMNS}
          FROM contacts WHERE id = ${conv.contactId} LIMIT 1
        `
        if (cRows && cRows.length > 0) {
          contact = mapContactRow(cRows[0])
        }
      }

      const activeTicket = conv.activeTicketId
        ? await ticketService.getTicketById(conv.activeTicketId)
        : null

      let lastMessage: string | null = null
      const mRows = await sql`
        SELECT content, status, content_attributes as "contentAttributes" FROM messages
        WHERE conversation_id = ${conv.id}
        ORDER BY created_at DESC LIMIT 1
      `
      if (mRows && mRows.length > 0) {
        const row = mRows[0]
        const attrs = parseContentAttributes(row.contentAttributes)
        if (row.status === 'deleted_by_sender' || attrs.isDeletedBySender) {
          lastMessage = '🚫 Pesan telah ditarik'
        } else {
          lastMessage = row.content as string | null
        }
      }

      const { isGroup, groupJid } = conversationGroupService.detectGroupConversation(
        conv as Record<string, unknown>,
        contact,
      )

      result.push({
        ...conv,
        isGroup: isGroup ? true : undefined,
        groupJid,
        inboxName: conv.inboxName || null,
        channelType: conv.channelType || 'whatsapp',
        channel: conv.channelType || 'whatsapp',
        contact,
        activeTicket,
        lastMessage,
      })
    }

    return result
  }

  async updateTicketStatus(
    ticketId: string,
    status: TicketStatus | string,
    snoozedUntil?: string | null,
  ): Promise<Ticket> {
    return ticketService.updateTicketStatus(ticketId, status, snoozedUntil)
  }

  async getTicketById(ticketId: string): Promise<Ticket | null> {
    return ticketService.getTicketById(ticketId)
  }

  async listContacts(): Promise<Contact[]> {
    const rows = await sql`
      SELECT ${CONTACT_COLUMNS}
      FROM contacts
      ORDER BY created_at DESC
    `
    return (rows || []).map(mapContactRow)
  }

  async handleEditedMessage(params: {
    targetExternalId: string
    newContent: string
    editedAt?: string
  }): Promise<{ message: Message } | null> {
    const { messageService } = await import('../messages/messages.service')
    return messageService.editMessage(params)
  }

  async handleRevokedMessage(params: {
    targetExternalId: string
    revokedAt?: string
  }): Promise<{ message: Message } | null> {
    const { messageService } = await import('../messages/messages.service')
    return messageService.revokeMessage(params)
  }

  async archiveConversation(id: string): Promise<boolean> {
    const existing = await this.getConversationById(id)
    if (!existing) return false
    const now = new Date().toISOString()
    await sql`
      INSERT INTO conversation_extras (id, deleted_at)
      VALUES (${id}, ${now})
      ON CONFLICT (id) DO UPDATE SET deleted_at = ${now}
    `
    return true
  }
}

export const conversationQueryService = new ConversationQueryService()
