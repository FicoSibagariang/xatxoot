import { describe, expect, it } from 'bun:test'
import { Hono } from 'hono'
import { conversationService } from '../conversations/conversations.service'
import { messageService } from '../messages/messages.service'
import { handleWhatsAppUnofficialInbound } from '../webhooks/whatsapp-unofficial.webhook.controller'

describe('API Mention Recognition and Storage (Issue #301 - TDD RED)', () => {
  const channelId = '11111111-1111-4111-a111-111111111111'
  const inboxId = '22222222-2222-4222-a222-222222222222'
  const myChannelPhone = '+6281200001111'

  // Configure company/channel phone number
  conversationService.setCompanyPhoneNumbers([myChannelPhone])

  const app = new Hono()
  app.post('/api/v1/webhooks/whatsapp-unofficial/inbound', handleWhatsAppUnofficialInbound)

  it('should store mentions metadata and set isMentioningMe: false when mentioning another participant', async () => {
    const payload = {
      channelId,
      inboxId,
      senderNumber: '628111222333',
      senderName: 'Budi Santoso',
      externalMessageId: 'WAM_MENTION_INBOUND_01',
      messageType: 'text',
      content: 'Halo @137185600737333 tolong dicek berkasnya',
      isGroup: true,
      groupJid: '120363209784423627@g.us',
      groupName: 'Grup Koordinasi Project',
      participant: '628111222333',
      participantName: 'Budi Santoso',
      mentions: [
        {
          jid: '137185600737333@lid',
          phone: '+6289621475546',
          name: 'Fini Ardiani D',
        },
      ],
    }

    const res = await app.request('/api/v1/webhooks/whatsapp-unofficial/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      success: boolean
      messageId: string
      conversationId: string
    }
    expect(json.success).toBe(true)
    expect(json.messageId).toBeDefined()

    const convResult = await conversationService.getConversationById(json.conversationId)
    expect(convResult).not.toBeNull()
    const storedMsg = convResult?.messages.find((m) => m.id === json.messageId)
    expect(storedMsg).toBeDefined()
    const attrs = storedMsg?.contentAttributes as {
      mentions?: Array<{ name?: string }>
      isMentioningMe?: boolean
    }
    expect(attrs.mentions).toBeDefined()
    expect(attrs.mentions?.length).toBe(1)
    expect(attrs.mentions?.[0].name).toBe('Fini Ardiani D')
    expect(attrs.isMentioningMe).toBeFalsy()
  })

  it('should detect when inbound message mentions our own channel/account and flag isMentioningMe: true', async () => {
    const payload = {
      channelId,
      inboxId,
      senderNumber: '628111222333',
      senderName: 'Budi Santoso',
      externalMessageId: 'WAM_MENTION_INBOUND_02',
      messageType: 'text',
      content: 'Halo @6281200001111 mohon bantuan customer support segera ya!',
      isGroup: true,
      groupJid: '120363209784423627@g.us',
      groupName: 'Grup Koordinasi Project',
      participant: '628111222333',
      participantName: 'Budi Santoso',
      mentions: [
        {
          jid: '6281200001111@s.whatsapp.net',
          phone: '+6281200001111',
          name: 'Customer Support Bot',
        },
      ],
    }

    const res = await app.request('/api/v1/webhooks/whatsapp-unofficial/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      success: boolean
      messageId: string
      conversationId: string
    }
    const convResult = await conversationService.getConversationById(json.conversationId)
    const storedMsg = convResult?.messages.find((m) => m.id === json.messageId)
    expect(storedMsg).toBeDefined()
    const attrs = storedMsg?.contentAttributes as { isMentioningMe?: boolean }
    expect(attrs.isMentioningMe).toBe(true)
  })
})
