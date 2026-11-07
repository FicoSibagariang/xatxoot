import type {
  Contact,
  ContactInbox,
  Conversation,
  Message,
  Ticket,
  TicketStatus,
} from '@xatxoot/shared'
import { type ConversationEchoService, conversationEchoService } from './conversation-echo.service'
import {
  type ConversationGroupService,
  conversationGroupService,
} from './conversation-group.service'
import {
  type ConversationInboundService,
  conversationInboundService,
} from './conversation-inbound.service'
import {
  type ConversationQueryService,
  conversationQueryService,
} from './conversation-query.service'
import {
  type ConversationDetail,
  type ConversationPagination,
  type ConversationWithInbox,
  type FindOrCreateContactDto,
  type GetConversationOptions,
  type InboundMessagePayload,
  type InboundMessageResult,
  type OutboundEchoPayload,
  type OutboundEchoResult,
  parseContentAttributes,
  resetConversationStore,
} from './conversation.types'

export type {
  Contact,
  ContactInbox,
  Conversation,
  Message,
  Ticket,
  TicketStatus,
  ConversationDetail,
  ConversationPagination,
  ConversationWithInbox,
  FindOrCreateContactDto,
  GetConversationOptions,
  InboundMessagePayload,
  InboundMessageResult,
  OutboundEchoPayload,
  OutboundEchoResult,
}

export {
  parseContentAttributes,
  resetConversationStore,
  type ConversationInboundService,
  conversationInboundService,
  type ConversationEchoService,
  conversationEchoService,
  type ConversationGroupService,
  conversationGroupService,
  type ConversationQueryService,
  conversationQueryService,
}

/**
 * Façade ConversationService aggregating sub-services for backward-compatibility.
 */
export class ConversationService {
  readonly inbound: ConversationInboundService = conversationInboundService
  readonly echo: ConversationEchoService = conversationEchoService
  readonly group: ConversationGroupService = conversationGroupService
  readonly query: ConversationQueryService = conversationQueryService

  setCompanyPhoneNumbers(numbers: string[]): void {
    this.group.setCompanyPhoneNumbers(numbers)
  }

  isCompanyPhoneNumber(phone?: string | null): boolean {
    return this.group.isCompanyPhoneNumber(phone)
  }

  async findOrCreateContact(
    dto: FindOrCreateContactDto,
  ): Promise<{ contact: Contact; contactInbox: ContactInbox }> {
    return this.inbound.findOrCreateContact(dto)
  }

  async findMessageByExternalId(externalId: string): Promise<Message | null> {
    return this.query.findMessageByExternalId(externalId)
  }

  async handleInboundMessage(payload: InboundMessagePayload): Promise<InboundMessageResult> {
    return this.inbound.handleInboundMessage(payload)
  }

  async handleOutboundEcho(payload: OutboundEchoPayload): Promise<OutboundEchoResult> {
    return this.echo.handleOutboundEcho(payload)
  }

  async getConversationById(
    id: string,
    options?: GetConversationOptions,
  ): Promise<ConversationDetail | null> {
    return this.query.getConversationById(id, options)
  }

  async markConversationAsRead(id: string): Promise<boolean> {
    return this.query.markConversationAsRead(id)
  }

  async listConversations(filter?: { inboxId?: string }): Promise<
    Array<
      Conversation & {
        contact: Contact | null
        activeTicket: Ticket | null
        inboxName?: string | null
        channelType?: string | null
        channel?: string | null
        lastMessage?: string | null
      }
    >
  > {
    return this.query.listConversations(filter)
  }

  async updateTicketStatus(
    ticketId: string,
    status: TicketStatus | string,
    snoozedUntil?: string | null,
  ): Promise<Ticket> {
    return this.query.updateTicketStatus(ticketId, status, snoozedUntil)
  }

  async getTicketById(ticketId: string): Promise<Ticket | null> {
    return this.query.getTicketById(ticketId)
  }

  async listContacts(): Promise<Contact[]> {
    return this.query.listContacts()
  }

  async handleEditedMessage(params: {
    targetExternalId: string
    newContent: string
    editedAt?: string
  }): Promise<{ message: Message } | null> {
    return this.query.handleEditedMessage(params)
  }

  async handleRevokedMessage(params: {
    targetExternalId: string
    revokedAt?: string
  }): Promise<{ message: Message } | null> {
    return this.query.handleRevokedMessage(params)
  }
}

export const conversationService = new ConversationService()
export default conversationService
