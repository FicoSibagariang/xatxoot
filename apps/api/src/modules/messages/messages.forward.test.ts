import { beforeEach, describe, expect, it } from 'bun:test'
import app from '../../index'
import { conversationService, resetConversationStore } from '../conversations/conversations.service'
import { inboxService } from '../inboxes/inboxes.service'
import { messageService, resetMessageStore } from './messages.service'

const AUTH_HEADER = {
  Authorization: 'Bearer valid-access-token',
}

describe('API Forward Message Processing (Issue #300 - TDD RED)', () => {
  beforeEach(() => {
    resetConversationStore()
    resetMessageStore()
  })

  it('POST /api/v1/messages/forward should reject unauthorized request with 401', async () => {
    const res = await app.request('/api/v1/messages/forward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceMessageId: '00000000-0000-0000-0000-000000000001',
        targetConversationId: '00000000-0000-0000-0000-000000000002',
      }),
    })
    expect(res.status).toBe(401)
  })

  it('POST /api/v1/messages/forward should validate required sourceMessageId and target', async () => {
    const res = await app.request('/api/v1/messages/forward', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('POST /api/v1/messages/forward should duplicate message into target conversation with isForwarded metadata and enqueue outbound', async () => {
    const { inbox } = await inboxService.createInbox({
      name: 'Forward Test Inbox',
      channelType: 'whatsapp_unofficial',
      channel: {
        sessionId: 'session_forward_01',
      },
    })

    // 1. Source customer conversation
    const sourceInbound = await conversationService.handleInboundMessage({
      inboxId: inbox.id,
      senderNumber: '+6281111111111',
      senderName: 'Customer Sumber',
      content: 'Tolong cek foto bukti kendala server ini ya.',
      externalId: 'wamid_source_msg_01',
    })

    // 2. Target group conversation (e.g. NOC / Vendor team group)
    const targetGroupInbound = await conversationService.handleInboundMessage({
      inboxId: inbox.id,
      senderNumber: '120363888777666555@g.us',
      senderName: 'Grup Tim Teknis',
      content: 'Halo tim standby.',
      isGroup: true,
      groupJid: '120363888777666555@g.us',
      externalId: 'wamid_target_group_msg_01',
    })

    const sourceMessageId = sourceInbound.message.id
    const targetConversationId = targetGroupInbound.conversation.id

    // Forward source message to target group
    const res = await app.request('/api/v1/messages/forward', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        sourceMessageId,
        targetConversationId,
      }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.message).toBeDefined()
    expect(body.message.conversationId).toBe(targetConversationId)
    expect(body.message.content).toBe('Tolong cek foto bukti kendala server ini ya.')
    expect(body.message.messageType).toBe('outgoing')

    // Check contentAttributes for isForwarded metadata
    const attrs = body.message.contentAttributes
    expect(attrs?.isForwarded).toBe(true)
    expect(attrs?.forwardingScore).toBe(1)
    expect(attrs?.originalMessageId).toBe(sourceMessageId)

    // Verify Baileys job queue contains isForwarded: true
    const queuedJob = messageService.getQueuedBaileysJobs().find((j) => j.data.isForwarded === true)
    expect(queuedJob).toBeDefined()
    expect(queuedJob?.data.recipientNumber).toBe('120363888777666555@g.us')
    expect(queuedJob?.data.isForwarded).toBe(true)
  })
})
