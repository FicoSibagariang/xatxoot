import { beforeEach, describe, expect, it } from 'bun:test'
import { messageStore } from '../messages/message-store'
import { conversationService, resetConversationStore } from './conversations.service'

describe('Conversations Module - WhatsApp Group Unified Architecture (Issue #288 - TDD RED)', () => {
  const inboxSupport = 'inbox-support-111'
  const inboxSales = 'inbox-sales-222'
  const groupJid = '120363209784423627@g.us'

  beforeEach(() => {
    resetConversationStore()
  })

  it('should map events from two different channel inboxes in the same group to ONE single unified conversation', async () => {
    // 1. Channel Support receives message in the group
    const resSupport = await conversationService.handleInboundMessage({
      inboxId: inboxSupport,
      sourceId: groupJid,
      senderPhone: groupJid,
      senderName: 'Grup Proyek VIP',
      isGroup: true,
      groupJid,
      participant: '6281234567890',
      participantName: 'Budi Client',
      content: 'Halo tim, ada revisi dokumen.',
      externalId: 'WA_GROUP_EXT_01',
    })

    expect(resSupport.conversation).toBeDefined()
    const firstConvId = resSupport.conversation.id

    // 2. Channel Sales receives the same group message (broadcasted to all group participants)
    // Thanks to idempotency check, duplicate externalId must return existing message without creating duplicate
    const resSalesDuplicate = await conversationService.handleInboundMessage({
      inboxId: inboxSales,
      sourceId: groupJid,
      senderPhone: groupJid,
      senderName: 'Grup Proyek VIP',
      isGroup: true,
      groupJid,
      participant: '6281234567890',
      participantName: 'Budi Client',
      content: 'Halo tim, ada revisi dokumen.',
      externalId: 'WA_GROUP_EXT_01',
    })

    expect(resSalesDuplicate.conversation.id).toBe(firstConvId)
    expect(resSalesDuplicate.message.id).toBe(resSupport.message.id)

    // 3. Next message in the group arrives via Channel Sales
    const resSalesNext = await conversationService.handleInboundMessage({
      inboxId: inboxSales,
      sourceId: groupJid,
      senderPhone: groupJid,
      senderName: 'Grup Proyek VIP',
      isGroup: true,
      groupJid,
      participant: '6289876543210',
      participantName: 'Dewi Partner',
      content: 'Lampiran revisi sudah saya kirim ya.',
      externalId: 'WA_GROUP_EXT_02',
    })

    // Must map to the exact same conversation room
    expect(resSalesNext.conversation.id).toBe(firstConvId)

    // Conversation thread messages count should be 2 customer messages + 1 ticket activity
    const thread = await conversationService.getConversationById(firstConvId)
    const clientMessages = thread?.messages.filter((m) => m.messageType === 'incoming') || []
    expect(clientMessages.length).toBe(2)
  })

  it('should treat internal company channel participant message as outgoing without creating ticket or increasing unreadCount', async () => {
    // Seed company channels
    conversationService.setCompanyPhoneNumbers(['62811111111', '62822222222'])

    // First customer message creates conversation & ticket
    const resCustomer = await conversationService.handleInboundMessage({
      inboxId: inboxSupport,
      sourceId: groupJid,
      senderPhone: groupJid,
      senderName: 'Grup Proyek VIP',
      isGroup: true,
      groupJid,
      participant: '6281234567890',
      participantName: 'Budi Client',
      content: 'Tolong kirim penawaran.',
      externalId: 'WA_GROUP_EXT_03',
    })

    const initialUnread = resCustomer.conversation.unreadCount || 1
    const activeTicketId = resCustomer.ticket?.id

    // Internal company channel replies directly from WhatsApp mobile app inside the group
    const resInternal = await conversationService.handleInboundMessage({
      inboxId: inboxSales,
      sourceId: groupJid,
      senderPhone: groupJid,
      senderName: 'Grup Proyek VIP',
      isGroup: true,
      groupJid,
      participant: '62822222222', // Company sales number
      participantName: 'Sales Lead',
      content: 'Baik Pak Budi, penawaran sudah kami kirim ke email.',
      externalId: 'WA_GROUP_EXT_04',
      isEcho: true,
    })

    // Message must be outgoing / echo
    expect(resInternal.message.messageType).toBe('outgoing')
    expect(resInternal.conversation.id).toBe(resCustomer.conversation.id)

    // Should NOT increase unreadCount
    expect(resInternal.conversation.unreadCount ?? 0).toBeLessThanOrEqual(initialUnread)

    // Ticket should remain the same (not creating new ticket)
    const updatedConv = await conversationService.getConversationById(resCustomer.conversation.id)
    expect(updatedConv?.activeTicket?.id).toBe(activeTicketId)
  })
})
