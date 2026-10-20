import { beforeEach, describe, expect, it } from 'bun:test'
import { Hono } from 'hono'
import { conversationService } from '../conversations/conversations.service'
import { inboxService } from '../inboxes/inboxes.service'
import { type RealtimeEvent, realtimeService } from '../realtime/realtime.service'
import { handleWhatsAppUnofficialInbound } from '../webhooks/whatsapp-unofficial.webhook.controller'
import { messageService, resetMessageStore } from './messages.service'

const app = new Hono()
app.post('/api/v1/webhooks/whatsapp-unofficial/inbound', handleWhatsAppUnofficialInbound)

const TEST_INBOX_ID = '6267b180-e513-46b4-9f89-557cce794875'

describe('WhatsApp Message Revoke (TDD RED)', () => {
  beforeEach(() => {
    resetMessageStore()
  })

  it('skenario 1: menerima webhook revoke, menemukan pesan, update status dan content_attributes', async () => {
    // Setup: kirim pesan inbound dulu
    const inboundRes = await app.request('/api/v1/webhooks/whatsapp-unofficial/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inboxId: TEST_INBOX_ID,
        senderNumber: '628111000001',
        senderName: 'Pelanggan Revoke Test',
        externalMessageId: 'REVOKE_ORIGINAL_EXT_001',
        messageType: 'text',
        content: 'Pesan yang akan ditarik ini penting',
        timestamp: '2026-10-20T10:00:00.000Z',
      }),
    })
    expect(inboundRes.status).toBe(200)
    const inboundData = (await inboundRes.json()) as { messageId: string }
    expect(inboundData.messageId).toBeDefined()

    // Aksi: kirim webhook revoke
    const revokeRes = await app.request('/api/v1/webhooks/whatsapp-unofficial/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inboxId: TEST_INBOX_ID,
        senderNumber: '628111000001',
        isRevoke: true,
        targetExternalId: 'REVOKE_ORIGINAL_EXT_001',
        revokedAt: '2026-10-20T10:05:00.000Z',
      }),
    })

    expect(revokeRes.status).toBe(200)
    const revokeData = (await revokeRes.json()) as {
      success: boolean
      isRevoke: boolean
      messageId: string
      conversationId: string
    }
    expect(revokeData.success).toBe(true)
    expect(revokeData.isRevoke).toBe(true)
    expect(revokeData.messageId).toBeDefined()
    expect(revokeData.conversationId).toBeDefined()

    // Verifikasi: status pesan berubah menjadi deleted_by_sender
    const updatedMsg = await messageService.getMessageByExternalId('REVOKE_ORIGINAL_EXT_001')
    expect(updatedMsg).not.toBeNull()
    expect(updatedMsg?.status).toBe('deleted_by_sender')
    expect(updatedMsg?.contentAttributes?.isDeletedBySender).toBe(true)
    expect(updatedMsg?.contentAttributes?.deletedAt).toBeDefined()
    expect(updatedMsg?.contentAttributes?.revokedOriginalContent).toBe(
      'Pesan yang akan ditarik ini penting',
    )
  })

  it('skenario 2: broadcast SSE event message.revoked setelah revoke berhasil', async () => {
    // Setup: pesan awal
    await app.request('/api/v1/webhooks/whatsapp-unofficial/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inboxId: TEST_INBOX_ID,
        senderNumber: '628111000002',
        senderName: 'Pelanggan SSE Test',
        externalMessageId: 'REVOKE_SSE_EXT_002',
        messageType: 'text',
        content: 'Pesan untuk test SSE revoke',
        timestamp: '2026-10-20T10:00:00.000Z',
      }),
    })

    // Track broadcast events
    const broadcastedEvents: RealtimeEvent[] = []
    const originalBroadcast = realtimeService.broadcast.bind(realtimeService)
    realtimeService.broadcast = (event: RealtimeEvent) => {
      broadcastedEvents.push(event)
      originalBroadcast(event)
    }

    try {
      // Aksi: kirim revoke
      await app.request('/api/v1/webhooks/whatsapp-unofficial/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inboxId: TEST_INBOX_ID,
          senderNumber: '628111000002',
          isRevoke: true,
          targetExternalId: 'REVOKE_SSE_EXT_002',
          revokedAt: '2026-10-20T10:05:00.000Z',
        }),
      })

      // Verifikasi: event message.revoked di-broadcast
      const revokeEvent = broadcastedEvents.find((e) => e.event === 'message.revoked')
      expect(revokeEvent).toBeDefined()
      expect((revokeEvent?.data as { messageId?: string })?.messageId).toBeDefined()
      expect((revokeEvent?.data as { conversationId?: string })?.conversationId).toBeDefined()
    } finally {
      realtimeService.broadcast = originalBroadcast
    }
  })

  it('skenario 3: revoke pesan yang tidak ditemukan → return 404 graceful', async () => {
    const revokeRes = await app.request('/api/v1/webhooks/whatsapp-unofficial/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inboxId: TEST_INBOX_ID,
        senderNumber: '628111000003',
        isRevoke: true,
        targetExternalId: 'NONEXISTENT_EXTERNAL_ID_99999',
        revokedAt: '2026-10-20T10:05:00.000Z',
      }),
    })

    expect(revokeRes.status).toBe(404)
    const body = (await revokeRes.json()) as { error: string }
    expect(body.error).toBeDefined()
  })
})
