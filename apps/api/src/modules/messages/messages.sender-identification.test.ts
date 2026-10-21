import { beforeEach, describe, expect, it } from 'bun:test'
import app from '../../index'
import { conversationService } from '../conversations/conversations.service'
import { inboxService } from '../inboxes/inboxes.service'
import { messageService, resetMessageStore } from './messages.service'

const AUTH_HEADER = {
  Authorization: 'Bearer valid-access-token',
}

describe('Outbound Message Sender Identification (Issue #284 - TDD RED)', () => {
  beforeEach(() => {
    resetMessageStore()
  })

  it('handleOutboundEcho() should tag message with WhatsApp HP sender metadata and echo attributes', async () => {
    const { inbox } = await inboxService.createInbox({
      name: 'WA Unofficial Echo Store',
      channelType: 'whatsapp_unofficial',
      channel: {
        sessionId: 'session_echo_test_01',
      },
    })

    const echoResult = await conversationService.handleOutboundEcho({
      inboxId: inbox.id,
      sourceId: '6281234567890@s.whatsapp.net',
      senderPhone: '+6281234567890',
      senderName: 'Nia', // Unofficial default agent phone contact name
      externalId: 'wamid_echo_outbound_001',
      content: 'Halo kak, kami balas langsung dari HP toko ya!',
    })

    expect(echoResult).toBeDefined()
    expect(echoResult.message).toBeDefined()
    expect(echoResult.message.messageType).toBe('outgoing')

    // Expect sender identification attributes
    const attrs = echoResult.message.contentAttributes as Record<string, unknown>
    expect(attrs.echo).toBe(true)
    expect(attrs.source).toBe('whatsapp_mobile')
    expect(attrs.senderName).toBe('WhatsApp HP')

    // Expect message model has senderName
    expect(echoResult.message.senderName).toBe('WhatsApp HP')
    expect(echoResult.message.isEcho).toBe(true)
  })

  it('GET /api/v1/conversations/:id/messages should return senderName and senderType for agent and echo messages', async () => {
    const { inbox } = await inboxService.createInbox({
      name: 'Agent Sender Test Inbox',
      channelType: 'whatsapp_cloud',
      channel: {
        phoneNumber: '+6281200000002',
        phoneNumberId: '1000000002',
        wabaId: 'waba_00000002',
        accessToken: 'EAAB_token_02',
        webhookVerifyToken: 'verify_token_02',
      },
    })

    const inbound = await conversationService.handleInboundMessage({
      inboxId: inbox.id,
      senderNumber: '+6289988776655',
      senderName: 'Pelanggan Butuh Bantuan',
      content: 'Tolong bantu saya',
      externalId: 'wamid_inbound_test_002',
    })

    const conversationId = inbound.conversation.id

    // Send an outbound agent reply
    await messageService.sendMessage({
      conversationId,
      content: 'Halo pelanggan, saya Budi CS akan membantu.',
      senderType: 'user',
      senderId: 'mock-agent-user-id',
      senderName: 'Budi Santoso',
    })

    // Fetch messages via HTTP API
    const res = await app.request(`/api/v1/conversations/${conversationId}/messages`, {
      method: 'GET',
      headers: {
        ...AUTH_HEADER,
      },
    })

    expect(res.status).toBe(200)
    const messages = (await res.json()) as Array<{
      id: string
      senderType: string
      senderName?: string
      content: string
      contentAttributes?: Record<string, unknown>
    }>

    const outgoing = messages.find((m) => m.content.includes('saya Budi CS'))
    expect(outgoing).toBeDefined()
    expect(outgoing?.senderType).toBe('user')
    expect(outgoing?.senderName).toBe('Budi Santoso')
  })

  it('Bot messages should have senderType: bot and senderName: Bot Otomasi', async () => {
    const { inbox } = await inboxService.createInbox({
      name: 'Bot Flow Inbox',
      channelType: 'whatsapp_cloud',
      channel: {
        phoneNumber: '+6281200000003',
        phoneNumberId: '1000000003',
        wabaId: 'waba_00000003',
        accessToken: 'EAAB_token_03',
        webhookVerifyToken: 'verify_token_03',
      },
    })

    const inbound = await conversationService.handleInboundMessage({
      inboxId: inbox.id,
      senderNumber: '+6289911223344',
      senderName: 'Pelanggan Chatbot',
      content: 'Menu utama',
      externalId: 'wamid_inbound_test_003',
    })

    const conversationId = inbound.conversation.id

    await messageService.sendMessage({
      conversationId,
      content: 'Silakan pilih menu bantuan di bawah ini.',
      senderType: 'bot',
      senderId: 'flow-bot-01',
    })

    const messages = await messageService.listConversationMessages(conversationId)
    const botMsg = messages.find((m) => m.content?.includes('pilih menu bantuan'))

    expect(botMsg).toBeDefined()
    expect(botMsg?.senderType).toBe('bot')
    expect(botMsg?.senderName).toBe('Bot Otomasi')
  })

  it('should parse contentAttributes properly even when returned as JSON string from database', async () => {
    const { inbox } = await inboxService.createInbox({
      name: 'Echo String Test Inbox',
      channelType: 'whatsapp_unofficial',
      channel: { sessionId: 'session_echo_str_01' },
    })

    const echoResult = await conversationService.handleOutboundEcho({
      inboxId: inbox.id,
      sourceId: '62811638688@s.whatsapp.net',
      senderPhone: '+62811638688',
      content: 'Pesan dari WhatsApp HP',
    })

    const msgId = echoResult.message.id
    const convId = echoResult.conversation.id

    // Simulate database returning contentAttributes as raw JSON string
    const inMemMsg = await messageService.getMessageById(msgId)
    if (inMemMsg) {
      // @ts-expect-error test simulating raw JSON string from DB
      inMemMsg.contentAttributes = JSON.stringify({
        echo: true,
        source: 'whatsapp_mobile',
        senderName: 'WhatsApp HP',
      })
      inMemMsg.senderName = null
      inMemMsg.isEcho = false
    }

    const messages = await messageService.listConversationMessages(convId)
    const targetMsg = messages.find((m) => m.id === msgId)

    expect(targetMsg).toBeDefined()
    expect(targetMsg?.isEcho).toBe(true)
    expect(targetMsg?.senderName).toBe('WhatsApp HP')

    const convDetail = await conversationService.getConversationById(convId)
    const convMsg = convDetail?.messages?.find((m) => m.id === msgId)
    expect(convMsg?.isEcho).toBe(true)
    expect(convMsg?.senderName).toBe('WhatsApp HP')
  })
})
