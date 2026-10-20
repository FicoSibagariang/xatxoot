import { beforeEach, describe, expect, it } from 'bun:test'
import app from '../../index'
import { inboxService, resetInboxStore } from '../inboxes/inboxes.service'
import { conversationService, resetConversationStore } from './conversations.service'

const AUTH_HEADER = {
  Authorization: 'Bearer valid-access-token',
}

describe('Conversation Inbox Metadata (Issue #282 - TDD RED)', () => {
  let testInboxId: string

  beforeEach(async () => {
    resetConversationStore()
    resetInboxStore()

    const { inbox } = await inboxService.createInbox({
      name: 'WhatsApp Layanan Pelanggan',
      channelType: 'whatsapp_cloud',
      channel: {
        phoneNumber: '+6281199887766',
        phoneNumberId: 'phone_id_meta_123',
        wabaId: 'waba_id_meta_123',
        accessToken: 'access_token_meta_123',
        webhookVerifyToken: 'verify_token_meta_123',
      },
    })
    testInboxId = inbox.id
  })

  it('listConversations() tanpa filter harus mengembalikan inboxName dan channelType', async () => {
    await conversationService.handleInboundMessage({
      inboxId: testInboxId,
      sourceId: '+6289911223344',
      senderPhone: '+6289911223344',
      senderName: 'Pelanggan Metadata Test',
      content: 'Halo CS, tanya info',
    })

    const conversations = await conversationService.listConversations()
    expect(conversations.length).toBeGreaterThan(0)
    const conv = conversations[0] as unknown as {
      inboxName?: string
      channelType?: string
      channel?: string
    }

    expect(conv.inboxName).toBe('WhatsApp Layanan Pelanggan')
    expect(conv.channelType || conv.channel).toBeDefined()
  })

  it('GET /api/v1/conversations endpoint harus menyertakan inboxName dan channelType pada setiap item', async () => {
    await conversationService.handleInboundMessage({
      inboxId: testInboxId,
      sourceId: '+6289911223355',
      senderPhone: '+6289911223355',
      senderName: 'Pelanggan API Test',
      content: 'Pesan via endpoint HTTP',
    })

    const res = await app.request('/api/v1/conversations', {
      method: 'GET',
      headers: {
        ...AUTH_HEADER,
      },
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as Array<{
      inboxName?: string
      channelType?: string
      channel?: string
    }>

    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
    const item = body[0]
    expect(item.inboxName).toBe('WhatsApp Layanan Pelanggan')
    expect(item.channelType || item.channel).toBeDefined()
  })

  it('getConversationById() harus mengembalikan conversation dengan inboxName dan channelType', async () => {
    const inbound = await conversationService.handleInboundMessage({
      inboxId: testInboxId,
      sourceId: '+6289911223366',
      senderPhone: '+6289911223366',
      senderName: 'Pelanggan Detail Test',
      content: 'Test conversation detail by ID',
    })

    const detail = await conversationService.getConversationById(inbound.conversation.id)
    expect(detail).not.toBeNull()
    const conv = detail?.conversation as unknown as {
      inboxName?: string
      channelType?: string
      channel?: string
    }
    expect(conv.inboxName).toBe('WhatsApp Layanan Pelanggan')
    expect(conv.channelType || conv.channel).toBeDefined()
  })
})
