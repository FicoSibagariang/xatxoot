import { describe, expect, it } from 'bun:test'
import app from '../../index'
import { conversationService } from '../conversations/conversations.service'

describe('WhatsApp Unofficial Gateway Inbound Webhook Receiver (/api/v1/webhooks/whatsapp-unofficial)', () => {
  it('POST /api/v1/webhooks/whatsapp-unofficial/inbound should reject payload without required fields', async () => {
    const res = await app.request('/api/v1/webhooks/whatsapp-unofficial/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBeDefined()
  })

  it('POST /api/v1/webhooks/whatsapp-unofficial/inbound should process incoming text message and create conversation & ticket', async () => {
    const uniqueNumber = `628${Math.floor(100000000 + Math.random() * 900000000)}`
    const payload = {
      channelId: crypto.randomUUID(),
      inboxId: crypto.randomUUID(),
      senderNumber: uniqueNumber,
      senderName: 'Pelanggan Uji WhatsApp',
      externalMessageId: `wamid_${Date.now()}`,
      messageType: 'text',
      content: 'Halo CS Xatxoot, saya ingin bertanya tentang produk Anda!',
      timestamp: new Date().toISOString(),
    }

    const res = await app.request('/api/v1/webhooks/whatsapp-unofficial/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    expect(res.status).toBe(200)
    const result = await res.json()
    expect(result.success).toBe(true)
    expect(result.conversationId).toBeDefined()
    expect(result.ticketId).toBeDefined()

    // Verify conversation was created in conversationService
    const conv = await conversationService.getConversationById(result.conversationId)
    expect(conv).toBeDefined()
    expect(conv?.contact?.name).toBe('Pelanggan Uji WhatsApp')
    expect(conv?.messages.length).toBeGreaterThan(0)
    expect(conv?.messages.some((m) => m.content?.includes('Halo CS Xatxoot'))).toBe(true)
  })

  it('POST /api/v1/webhooks/whatsapp-unofficial/inbound should accurately resolve inboxId by sessionId when inboxId is omitted from payload', async () => {
    const { inboxService } = await import('../inboxes/inboxes.service')

    const sessionA = `wa_test_session_A_${Date.now()}`
    const sessionB = `wa_test_session_B_${Date.now()}`

    const inboxA = await inboxService.createInbox({
      name: 'Channel Sales A',
      channelType: 'whatsapp_unofficial',
      channel: { sessionId: sessionA },
    })

    const inboxB = await inboxService.createInbox({
      name: 'Channel Support B',
      channelType: 'whatsapp_unofficial',
      channel: { sessionId: sessionB },
    })

    const testSender = `62877${Math.floor(1000000 + Math.random() * 9000000)}`

    // Message targeted to session A, but WITHOUT inboxId
    const resA = await app.request('/api/v1/webhooks/whatsapp-unofficial/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionA,
        senderNumber: testSender,
        senderName: 'Pelanggan Multi Channel',
        externalMessageId: `wamid_A_${Date.now()}`,
        messageType: 'text',
        content: 'Pesan ini khusus untuk channel Sales A',
        timestamp: new Date().toISOString(),
      }),
    })

    expect(resA.status).toBe(200)
    const resultA = await resA.json()
    const convA = await conversationService.getConversationById(resultA.conversationId)
    expect(convA?.conversation?.inboxId).toBe(inboxA.inbox.id)

    // Message targeted to session B, but WITHOUT inboxId
    const resB = await app.request('/api/v1/webhooks/whatsapp-unofficial/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionB,
        senderNumber: testSender,
        senderName: 'Pelanggan Multi Channel',
        externalMessageId: `wamid_B_${Date.now()}`,
        messageType: 'text',
        content: 'Pesan ini khusus untuk channel Support B',
        timestamp: new Date().toISOString(),
      }),
    })

    expect(resB.status).toBe(200)
    const resultB = await resB.json()
    const convB = await conversationService.getConversationById(resultB.conversationId)
    expect(convB?.conversation?.inboxId).toBe(inboxB.inbox.id)

    // They must NOT be merged into the same conversation!
    expect(resultA.conversationId).not.toBe(resultB.conversationId)
  })
})
