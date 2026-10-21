import { beforeEach, describe, expect, it } from 'bun:test'
import app from '../../index'
import { resetConversationStore } from '../conversations/conversations.service'
import { inboxService } from '../inboxes/inboxes.service'
import { resetMessageStore } from '../messages/message-store'

describe('WhatsApp Unofficial Webhook - Media / Image Inbound (TDD RED)', () => {
  let inboxId: string

  beforeEach(async () => {
    resetConversationStore()
    resetMessageStore()

    const { inbox } = await inboxService.createInbox({
      name: 'WA Unofficial Media Inbox',
      channelType: 'whatsapp_unofficial',
      channel: { sessionId: 'session_media_test_01' },
    })
    inboxId = inbox.id
  })

  it('should accept image message with mediaUrl, set contentType=image, and attach mediaUrl', async () => {
    const payload = {
      sessionId: 'session_media_test_01',
      inboxId,
      senderNumber: '6281234567890',
      senderName: 'Customer Photo',
      messageType: 'image',
      mediaUrl: '/api/v1/media/session_media_01_msg_001.jpg',
      content: 'Foto bukti kendala ODP',
      externalMessageId: 'WA_IMG_MSG_001',
    }

    const res = await app.request('/api/v1/webhooks/whatsapp-unofficial/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as { success: boolean; conversationId: string }
    expect(data.success).toBe(true)

    // Verify conversation detail via API
    const convRes = await app.request(`/api/v1/conversations/${data.conversationId}`, {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-access-token' },
    })
    expect(convRes.status).toBe(200)
    const convData = (await convRes.json()) as {
      messages: Array<{
        id: string
        content: string
        messageType: string
        contentType: string
        mediaUrl?: string
      }>
    }

    const imgMsg = convData.messages.find((m) => m.content === 'Foto bukti kendala ODP')
    expect(imgMsg).toBeDefined()
    expect(imgMsg?.messageType).toBe('image')
    expect(imgMsg?.contentType).toBe('image')
    expect(imgMsg?.mediaUrl).toBe('/api/v1/media/session_media_01_msg_001.jpg')
  })
})
