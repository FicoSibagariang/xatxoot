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
    expect(conv?.messages[0].content).toContain('Halo CS Xatxoot')
  })
})
