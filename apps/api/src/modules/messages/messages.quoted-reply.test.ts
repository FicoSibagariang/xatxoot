import { beforeEach, describe, expect, it } from 'bun:test'
import app from '../../index'
import { conversationService } from '../conversations/conversations.service'
import { inboxService } from '../inboxes/inboxes.service'
import { messageService, resetMessageStore } from './messages.service'

const AUTH_HEADER = {
  Authorization: 'Bearer valid-access-token',
}

describe('API Quoted Reply Processing (Issue #286 - TDD RED)', () => {
  beforeEach(() => {
    resetMessageStore()
  })

  it('POST /api/v1/conversations/:id/messages should store replyTo metadata when replyToMessageId is provided', async () => {
    const { inbox } = await inboxService.createInbox({
      name: 'Quoted Reply Unofficial Inbox',
      channelType: 'whatsapp_unofficial',
      channel: {
        sessionId: 'session_quoted_reply_01',
      },
    })

    // Inbound customer message
    const inbound = await conversationService.handleInboundMessage({
      inboxId: inbox.id,
      senderNumber: '+6281122334455',
      senderName: 'Pelanggan Quoted',
      content: 'Bisa kirim barang ke Surabaya hari ini?',
      externalId: 'wamid_target_customer_msg_999',
    })

    const conversationId = inbound.conversation.id
    const originalMessageId = inbound.message.id

    // Send reply referencing original customer message
    const res = await app.request(`/api/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        content: 'Bisa kak, asalkan order sebelum jam 15:00 WIB.',
        replyToMessageId: originalMessageId,
      }),
    })

    expect(res.status).toBe(201)
    const data = (await res.json()) as {
      message: {
        id: string
        content: string
        contentAttributes?: {
          replyTo?: {
            messageId: string
            externalId?: string | null
            senderName?: string
            snippet?: string
          }
        }
      }
    }

    expect(data.message).toBeDefined()
    expect(data.message.contentAttributes).toBeDefined()
    const replyTo = data.message.contentAttributes?.replyTo
    expect(replyTo).toBeDefined()
    expect(replyTo?.messageId).toBe(originalMessageId)
    expect(replyTo?.externalId).toBe('wamid_target_customer_msg_999')
    expect(replyTo?.senderName).toBe('Pelanggan Quoted')
    expect(replyTo?.snippet).toBe('Bisa kirim barang ke Surabaya hari ini?')

    // Verify Baileys outbound queue was queued with replyToExternalId and quotedText
    const jobs = messageService.getQueuedBaileysJobs()
    expect(jobs.length).toBeGreaterThanOrEqual(1)
    const lastJob = jobs[jobs.length - 1]
    expect(lastJob.data.replyToExternalId).toBe('wamid_target_customer_msg_999')
    expect(lastJob.data.quotedText).toBe('Bisa kirim barang ke Surabaya hari ini?')
  })
})
