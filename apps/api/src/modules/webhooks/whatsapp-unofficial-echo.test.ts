import { describe, expect, it } from 'bun:test'
import app from '../../index'
import { conversationService } from '../conversations/conversations.service'
import { messageService } from '../messages/messages.service'

describe('WhatsApp Unofficial Echo Outgoing Sync Webhook (/api/v1/webhooks/whatsapp-unofficial/inbound) (TDD RED)', () => {
  it('POST with isEcho: true should create an outgoing message in the conversation', async () => {
    const customerPhone = `628${Math.floor(100000000 + Math.random() * 900000000)}`
    const externalId = `BAE5_ECHO_${Date.now()}`
    const echoContent = 'Halo kak, kami dari tim sales membalas via HP WhatsApp'

    const res = await app.request('/api/v1/webhooks/whatsapp-unofficial/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: crypto.randomUUID(),
        inboxId: crypto.randomUUID(),
        senderNumber: customerPhone,
        externalMessageId: externalId,
        messageType: 'text',
        content: echoContent,
        timestamp: new Date().toISOString(),
        isEcho: true,
      }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.isEcho).toBe(true)
    expect(data.conversationId).toBeDefined()
    expect(data.messageId).toBeDefined()
    // Agent-initiated echo should NOT create a ticket
    expect(data.ticketId).toBeUndefined()

    // Verify message record in DB / memory
    const conv = await conversationService.getConversationById(data.conversationId)
    expect(conv).toBeDefined()
    expect(conv?.conversation?.activeTicketId).toBeNull()
    const echoMsg = conv?.messages.find(
      (m) => m.id === data.messageId || m.externalSourceId === externalId,
    )
    expect(echoMsg).toBeDefined()
    expect(echoMsg?.ticketId).toBeNull()
    expect(echoMsg?.messageType).toBe('outgoing')
    expect(echoMsg?.senderType).toBe('user')
    expect(echoMsg?.content).toBe(echoContent)
    expect(echoMsg?.status).toBe('sent')

    // When customer subsequently replies, a ticket MUST now be created
    const replyRes = await app.request('/api/v1/webhooks/whatsapp-unofficial/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: data.channelId,
        inboxId: conv?.conversation?.inboxId,
        senderNumber: customerPhone,
        externalMessageId: `wamid_reply_${Date.now()}`,
        messageType: 'text',
        content: 'Halo, saya mau pesan barangnya.',
        timestamp: new Date().toISOString(),
      }),
    })
    expect(replyRes.status).toBe(200)
    const replyData = await replyRes.json()
    expect(replyData.ticketId).toBeDefined()

    const updatedConv = await conversationService.getConversationById(data.conversationId)
    expect(updatedConv?.conversation?.activeTicketId).toBe(replyData.ticketId)
    expect(updatedConv?.activeTicket?.status).toBe('open')
  })

  it('POST with isEcho: true should be idempotent and not duplicate message if externalMessageId already exists', async () => {
    const customerPhone = `628${Math.floor(100000000 + Math.random() * 900000000)}`
    const externalId = `BAE5_IDEMPOTENT_${Date.now()}`
    const echoContent = 'Pesan echo idempotent'

    const payload = {
      channelId: crypto.randomUUID(),
      inboxId: crypto.randomUUID(),
      senderNumber: customerPhone,
      externalMessageId: externalId,
      messageType: 'text',
      content: echoContent,
      timestamp: new Date().toISOString(),
      isEcho: true,
    }

    // First call
    const res1 = await app.request('/api/v1/webhooks/whatsapp-unofficial/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    expect(res1.status).toBe(200)
    const data1 = await res1.json()
    expect(data1.success).toBe(true)

    // Second call with same externalMessageId (retry or duplicate event)
    const res2 = await app.request('/api/v1/webhooks/whatsapp-unofficial/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    expect(res2.status).toBe(200)
    const data2 = await res2.json()
    expect(data2.success).toBe(true)
    expect(data2.skipped || data2.messageId === data1.messageId).toBe(true)

    // Ensure conversation does NOT have duplicate messages
    const conv = await conversationService.getConversationById(data1.conversationId)
    const matchingMsgs = conv?.messages.filter((m) => m.externalSourceId === externalId)
    expect(matchingMsgs?.length).toBe(1)
  })
})
