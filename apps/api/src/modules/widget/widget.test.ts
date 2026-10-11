import { beforeEach, describe, expect, it } from 'bun:test'
import app from '../../index'
import { resetConversationStore } from '../conversations/conversations.service'
import { inboxService, resetInboxStore } from '../inboxes/inboxes.service'
import { realtimeService } from '../realtime/realtime.service'

describe('Widget Public API Endpoints (Task 1.30 - apps/api)', () => {
  let websiteToken: string
  let inboxId: string

  beforeEach(async () => {
    resetInboxStore()
    resetConversationStore()
    realtimeService.resetSubscribers()

    // Setup an inbox with web_widget channel
    websiteToken = 'wt_test_token_123'
    const result = await inboxService.createInbox({
      name: 'Layanan Website Chat',
      channelType: 'web_widget',
      channel: {
        websiteToken,
        widgetColor: '#00a884',
        replyTime: 'in_a_few_minutes',
      },
    })
    inboxId = result.inbox.id
  })

  describe('POST /api/v1/widget/messages (Visitor Inbound Messaging)', () => {
    it('should return 400 when website_token is missing', async () => {
      const res = await app.request('/api/v1/widget/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: 'visitor-sess-1',
          content: 'Halo kak',
        }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('website_token')
    })

    it('should return 404 when website_token does not exist', async () => {
      const res = await app.request('/api/v1/widget/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website_token: 'non_existent_token_999',
          session_id: 'visitor-sess-1',
          content: 'Halo min',
        }),
      })

      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.error).toContain('tidak ditemukan')
    })

    it('should return 400 when message content is empty', async () => {
      const res = await app.request('/api/v1/widget/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website_token: websiteToken,
          session_id: 'visitor-sess-1',
          content: '   ',
        }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('Konten pesan')
    })

    it('should successfully create incoming message, conversation, and ticket for visitor', async () => {
      const payload = {
        website_token: websiteToken,
        session_id: 'visitor-sess-100',
        content: 'Halo kak, apakah produk ready stock?',
        contact: {
          name: 'Dimas Anggara',
          email: 'dimas@example.com',
          phone: '+6281299887766',
        },
      }

      const res = await app.request('/api/v1/widget/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      expect(res.status).toBe(201)
      const data = await res.json()

      expect(data.success).toBe(true)
      expect(data.session_id).toBe('visitor-sess-100')
      expect(data.conversation_id).toBeDefined()
      expect(data.message).toBeDefined()
      expect(data.message.content).toBe('Halo kak, apakah produk ready stock?')
      expect(data.message.messageType).toBe('incoming')
      expect(data.contact).toBeDefined()
      expect(data.contact.name).toBe('Dimas Anggara')
    })
  })

  describe('GET /api/v1/widget/stream (SSE for Visitor / Agent Replies)', () => {
    it('should return 400 when website_token or session_id is missing', async () => {
      const resWithoutToken = await app.request('/api/v1/widget/stream?session_id=sess-1')
      expect(resWithoutToken.status).toBe(400)

      const resWithoutSession = await app.request(
        `/api/v1/widget/stream?website_token=${websiteToken}`,
      )
      expect(resWithoutSession.status).toBe(400)
    })

    it('should return 404 when website_token is invalid', async () => {
      const res = await app.request(
        '/api/v1/widget/stream?website_token=invalid-token&session_id=sess-1',
      )
      expect(res.status).toBe(404)
    })

    it('should initiate SSE stream with text/event-stream header and connected handshake', async () => {
      const res = await app.request(
        `/api/v1/widget/stream?website_token=${websiteToken}&session_id=sess-100`,
      )

      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/event-stream')

      // Read initial handshake chunk
      const reader = res.body?.getReader()
      expect(reader).toBeDefined()

      if (reader) {
        const { value } = await reader.read()
        const text = new TextDecoder().decode(value)
        expect(text).toContain('event: connected')
        expect(text).toContain('sess-100')
        reader.cancel()
      }
    })
  })

  describe('GET /api/v1/widget/config (Public Widget Inbox Configuration)', () => {
    it('should return widget inbox details for valid website_token', async () => {
      const res = await app.request(`/api/v1/widget/config?website_token=${websiteToken}`)

      expect(res.status).toBe(200)
      const data = await res.json()

      expect(data.name).toBe('Layanan Website Chat')
      expect(data.widgetColor).toBe('#00a884')
      expect(data.replyTime).toBe('in_a_few_minutes')
    })
  })
})
