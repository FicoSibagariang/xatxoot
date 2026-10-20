import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { RealtimeStreamClient, applyRealtimeMessageRevoke } from '../../hooks/useRealtimeStream'
import { ChatBubble } from './ChatTimeline'
import type { TimelineMessage } from './types'

describe('WhatsApp Revoked Message UI & Realtime', () => {
  it('ChatBubble should render revoked placeholder and audit button when message is revoked', () => {
    const revokedMsg: TimelineMessage = {
      id: 'msg-revoked-1',
      conversationId: 'conv-1',
      content: 'Pesan asli rahasia',
      messageType: 'incoming',
      contentType: 'text',
      timestamp: '10:20',
      status: 'deleted_by_sender',
      isDeletedBySender: true,
      deletedAt: '2026-10-20T10:20:00.000Z',
      revokedOriginalContent: 'Pesan asli rahasia',
    }

    const html = renderToStaticMarkup(<ChatBubble message={revokedMsg} />)

    expect(html).toContain('data-testid="message-revoked-placeholder"')
    expect(html).toContain('Pesan ini telah dihapus oleh pengirim')
    expect(html).toContain('data-testid="toggle-audit-button"')
    expect(html).toContain('[Lihat Pesan Asli (Audit)]')
  })

  it('applyRealtimeMessageRevoke should mark message as deleted_by_sender in-place in messagesMap', () => {
    const initialMap: Record<string, TimelineMessage[]> = {
      'conv-456': [
        {
          id: 'msg-revoke-target',
          conversationId: 'conv-456',
          content: 'Ini akan ditarik',
          messageType: 'incoming',
          contentType: 'text',
          timestamp: '11:00',
          status: 'delivered',
        },
      ],
    }

    const updatedMap = applyRealtimeMessageRevoke(initialMap, {
      messageId: 'msg-revoke-target',
      conversationId: 'conv-456',
      revokedAt: '2026-10-20T11:05:00.000Z',
    })

    const messages = updatedMap['conv-456']
    expect(messages).toHaveLength(1)
    expect(messages[0].status).toBe('deleted_by_sender')
    expect(messages[0].isDeletedBySender).toBe(true)
    expect(messages[0].deletedAt).toBe('2026-10-20T11:05:00.000Z')
  })

  it('RealtimeStreamClient should invoke onMessageRevoked callback when message.revoked event arrives', () => {
    let capturedEvent: unknown = null

    // biome-ignore lint/suspicious/noExplicitAny: mock EventSource
    const mockListeners: Record<string, (e: any) => void> = {}

    // Mock global EventSource
    const originalEventSource = globalThis.EventSource
    // biome-ignore lint/suspicious/noExplicitAny: mock implementation
    ;(globalThis as any).EventSource = class MockEventSource {
      url: string
      readyState = 1
      constructor(url: string) {
        this.url = url
      }
      addEventListener(event: string, cb: (e: unknown) => void) {
        mockListeners[event] = cb
      }
      removeEventListener() {}
      close() {}
    }

    try {
      const client = new RealtimeStreamClient({
        baseUrl: 'http://localhost:8800',
        autoConnect: true,
        onMessageRevoked: (data) => {
          capturedEvent = data
        },
      })
      client.connect()

      expect(mockListeners['message.revoked']).toBeDefined()

      // Simulasi event SSE message.revoked masuk
      mockListeners['message.revoked']({
        data: JSON.stringify({
          messageId: 'msg-sse-revoked-123',
          conversationId: 'conv-sse-456',
          revokedAt: '2026-10-20T11:10:00.000Z',
        }),
      })

      expect(capturedEvent).toEqual({
        messageId: 'msg-sse-revoked-123',
        conversationId: 'conv-sse-456',
        revokedAt: '2026-10-20T11:10:00.000Z',
      })
    } finally {
      globalThis.EventSource = originalEventSource
    }
  })
})
