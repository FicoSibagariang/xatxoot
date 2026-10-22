import { beforeEach, describe, expect, it } from 'bun:test'
import app from '../../index'
import { conversationService } from '../conversations/conversations.service'
import { inboxService } from '../inboxes/inboxes.service'
import { messageService, resetMessageStore } from './messages.service'

const AUTH_HEADER = {
  Authorization: 'Bearer valid-access-token',
}

describe('Inbound WhatsApp Quoted Reply & Conversation Hydration (Issue #301 - TDD RED)', () => {
  beforeEach(() => {
    resetMessageStore()
  })

  it('should resolve replyTo when customer replies quoting an agent message, and GET /conversations/:id should preserve both quotes', async () => {
    const { inbox } = await inboxService.createInbox({
      name: 'Inbound Quoted Inbox',
      channelType: 'whatsapp_unofficial',
      channel: {
        sessionId: 'session_inbound_quoted_01',
      },
    })

    // 1. Initial customer message
    const initial = await conversationService.handleInboundMessage({
      inboxId: inbox.id,
      senderNumber: '+628123456789',
      senderName: 'Pelanggan Toko',
      content: 'Halo, apakah produk A ready?',
      externalId: 'WAM_CUST_INIT_01',
    })

    const conversationId = initial.conversation.id

    // 2. Agent replies quoting initial customer message
    const agentPostRes = await app.request(`/api/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        content: 'Ready kak, stok sisa 5 pcs.',
        replyToMessageId: initial.message.id,
      }),
    })
    expect(agentPostRes.status).toBe(201)
    const agentMsgData = (await agentPostRes.json()) as {
      message: { id: string; externalSourceId?: string }
    }
    const agentMessageId = agentMsgData.message.id

    // 3. Customer replies on WhatsApp quoting agent's message
    const inboundQuoteRes = await conversationService.handleInboundMessage({
      inboxId: inbox.id,
      senderNumber: '+628123456789',
      senderName: 'Pelanggan Toko',
      content: 'Baik, saya pesan 2 pcs ya kak.',
      externalId: 'WAM_CUST_REPLY_QUOTE_02',
      replyToExternalId: agentMsgData.message.externalSourceId || `ext_${agentMessageId}`,
      quotedText: 'Ready kak, stok sisa 5 pcs.',
      quotedParticipant: '628999888777@s.whatsapp.net',
    })

    expect(inboundQuoteRes.message).toBeDefined()
    // Assertion on the returned message replyTo
    expect(inboundQuoteRes.message.replyTo).toBeDefined()
    expect(inboundQuoteRes.message.replyTo?.snippet).toBe('Ready kak, stok sisa 5 pcs.')
    expect(inboundQuoteRes.message.replyTo?.senderName).toBeDefined()

    // 4. Fetch conversation via GET /api/v1/conversations/:id
    // This is where previously agent's quote disappeared and customer's quote wasn't present!
    const convRes = await app.request(`/api/v1/conversations/${conversationId}`, {
      method: 'GET',
      headers: AUTH_HEADER,
    })
    expect(convRes.status).toBe(200)
    const convData = (await convRes.json()) as {
      conversation: { id: string }
      messages: Array<{
        id: string
        content: string
        replyTo?: {
          messageId?: string
          externalId?: string | null
          senderName?: string
          snippet?: string
        } | null
      }>
    }

    const messages = convData.messages
    expect(messages.length).toBeGreaterThanOrEqual(3)

    // Check agent message (index 1): replyTo MUST NOT be undefined or null
    const agentMsgInTimeline = messages.find((m) => m.id === agentMessageId)
    expect(agentMsgInTimeline).toBeDefined()
    expect(agentMsgInTimeline?.replyTo).toBeDefined()
    expect(agentMsgInTimeline?.replyTo).not.toBeNull()
    expect(agentMsgInTimeline?.replyTo?.snippet).toBe('Halo, apakah produk A ready?')

    // Check customer reply message (index 2): replyTo MUST NOT be undefined or null
    const custQuoteMsgInTimeline = messages.find((m) => m.id === inboundQuoteRes.message.id)
    expect(custQuoteMsgInTimeline).toBeDefined()
    expect(custQuoteMsgInTimeline?.replyTo).toBeDefined()
    expect(custQuoteMsgInTimeline?.replyTo).not.toBeNull()
    expect(custQuoteMsgInTimeline?.replyTo?.snippet).toBe('Ready kak, stok sisa 5 pcs.')
  })

  it('should support fallback quoted reply when replyToExternalId is not found in database', async () => {
    const { inbox } = await inboxService.createInbox({
      name: 'Fallback Quoted Inbox',
      channelType: 'whatsapp_unofficial',
      channel: {
        sessionId: 'session_fallback_quoted_01',
      },
    })

    const inbound = await conversationService.handleInboundMessage({
      inboxId: inbox.id,
      senderNumber: '+628123456789',
      senderName: 'Pelanggan Lama',
      content: 'Saya mau beli yang ini.',
      externalId: 'WAM_CUST_HISTORICAL_QUOTE',
      replyToExternalId: 'WAM_ANCIENT_EXTERNAL_ID_999',
      quotedText: 'Paket Hemat Internet 50GB seharga Rp 100.000',
      quotedParticipant: '628555444333@s.whatsapp.net',
    })

    expect(inbound.message.replyTo).toBeDefined()
    expect(inbound.message.replyTo?.externalId).toBe('WAM_ANCIENT_EXTERNAL_ID_999')
    expect(inbound.message.replyTo?.snippet).toBe('Paket Hemat Internet 50GB seharga Rp 100.000')

    const convRes = await app.request(`/api/v1/conversations/${inbound.conversation.id}`, {
      method: 'GET',
      headers: AUTH_HEADER,
    })
    const convData = (await convRes.json()) as {
      messages: Array<{
        id: string
        replyTo?: {
          snippet?: string
        } | null
      }>
    }
    const retrieved = convData.messages.find((m) => m.id === inbound.message.id)
    expect(retrieved?.replyTo).toBeDefined()
    expect(retrieved?.replyTo?.snippet).toBe('Paket Hemat Internet 50GB seharga Rp 100.000')
  })
})
