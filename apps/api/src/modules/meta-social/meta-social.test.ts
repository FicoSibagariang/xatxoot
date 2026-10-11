import { describe, expect, it } from 'bun:test'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MetaSocialSenderService,
  MetaSocialService,
  parseMetaSocialWebhook,
  verifyMetaSocialChallenge,
  verifyMetaSocialSignature,
} from './meta-social.service'

describe('Meta Social FB & IG Webhook & Outbound Sender (Task 3.9 - apps/api)', () => {
  const dummyAppSecret = 'meta_social_secret_99887766'
  const dummyVerifyToken = 'meta_social_verify_token_12345'
  const dummyAccessToken = 'EAAGm0PX4ZBtwBAdummyaccesstoken123456789'

  describe('Signature & Challenge Verification', () => {
    it('should verify valid HMAC SHA256 signature header', () => {
      const rawPayload = JSON.stringify({ object: 'page', entry: [] })
      const hash = createHmac('sha256', dummyAppSecret).update(rawPayload).digest('hex')
      const validHeader = `sha256=${hash}`

      expect(verifyMetaSocialSignature(rawPayload, validHeader, dummyAppSecret)).toBe(true)
      expect(verifyMetaSocialSignature(rawPayload, 'sha256=invalidhash', dummyAppSecret)).toBe(
        false,
      )
      expect(verifyMetaSocialSignature(rawPayload, null, dummyAppSecret)).toBe(false)
    })

    it('should verify webhook subscription challenge', () => {
      const query = {
        'hub.mode': 'subscribe',
        'hub.verify_token': dummyVerifyToken,
        'hub.challenge': 'challenge_token_abc_123',
      }

      expect(verifyMetaSocialChallenge(query, dummyVerifyToken)).toBe('challenge_token_abc_123')
      expect(
        verifyMetaSocialChallenge({ ...query, 'hub.verify_token': 'wrong' }, dummyVerifyToken),
      ).toBeNull()
      expect(
        verifyMetaSocialChallenge({ ...query, 'hub.mode': 'not_subscribe' }, dummyVerifyToken),
      ).toBeNull()
    })
  })

  describe('Inbound Webhook Parser (Facebook & Instagram)', () => {
    it('should parse standard incoming Facebook Messenger text message', () => {
      const fbPayload = {
        object: 'page',
        entry: [
          {
            id: 'page_id_1001',
            time: 1760201000,
            messaging: [
              {
                sender: { id: 'psid_user_5001' },
                recipient: { id: 'page_id_1001' },
                timestamp: 1760201000,
                message: {
                  mid: 'mid.fb.message.12345',
                  text: 'Halo kak, apakah produk ini masih tersedia?',
                },
              },
            ],
          },
        ],
      }

      const messages = parseMetaSocialWebhook(fbPayload)
      expect(messages).toHaveLength(1)
      const msg = messages[0]
      expect(msg.platform).toBe('facebook')
      expect(msg.senderId).toBe('psid_user_5001')
      expect(msg.recipientId).toBe('page_id_1001')
      expect(msg.messageId).toBe('mid.fb.message.12345')
      expect(msg.content).toBe('Halo kak, apakah produk ini masih tersedia?')
      expect(msg.contentType).toBe('text')
      expect(msg.replyToMid).toBeNull()
      expect(msg.attachments).toHaveLength(0)
    })

    it('should parse incoming Instagram Direct message', () => {
      const igPayload = {
        object: 'instagram',
        entry: [
          {
            id: 'ig_account_id_2002',
            time: 1760202000,
            messaging: [
              {
                sender: { id: 'igsid_user_6002' },
                recipient: { id: 'ig_account_id_2002' },
                timestamp: 1760202000,
                message: {
                  mid: 'mid.ig.message.67890',
                  text: 'Berapa harga paket langganan bulanan?',
                },
              },
            ],
          },
        ],
      }

      const messages = parseMetaSocialWebhook(igPayload)
      expect(messages).toHaveLength(1)
      const msg = messages[0]
      expect(msg.platform).toBe('instagram')
      expect(msg.senderId).toBe('igsid_user_6002')
      expect(msg.recipientId).toBe('ig_account_id_2002')
      expect(msg.messageId).toBe('mid.ig.message.67890')
      expect(msg.content).toBe('Berapa harga paket langganan bulanan?')
      expect(msg.contentType).toBe('text')
    })

    it('should parse message with image attachment and reply_to', () => {
      const payload = {
        object: 'page',
        entry: [
          {
            id: 'page_id_1001',
            messaging: [
              {
                sender: { id: 'psid_user_5001' },
                recipient: { id: 'page_id_1001' },
                timestamp: 1760203000,
                message: {
                  mid: 'mid.fb.message.99881',
                  text: 'Ini bukti pembayaran via QRIS',
                  reply_to: { mid: 'mid.fb.agent.11223' },
                  attachments: [
                    {
                      type: 'image',
                      payload: { url: 'https://cdn.facebook.com/attachments/qris_proof.png' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }

      const messages = parseMetaSocialWebhook(payload)
      expect(messages).toHaveLength(1)
      const msg = messages[0]
      expect(msg.contentType).toBe('image')
      expect(msg.replyToMid).toBe('mid.fb.agent.11223')
      expect(msg.attachments).toHaveLength(1)
      expect(msg.attachments[0].type).toBe('image')
      expect(msg.attachments[0].url).toBe('https://cdn.facebook.com/attachments/qris_proof.png')
    })

    it('should ignore echo messages sent by the page/agent itself', () => {
      const echoPayload = {
        object: 'page',
        entry: [
          {
            id: 'page_id_1001',
            messaging: [
              {
                sender: { id: 'page_id_1001' },
                recipient: { id: 'psid_user_5001' },
                message: {
                  mid: 'mid.echo.001',
                  text: 'Pesan balasan dari agent',
                  is_echo: true,
                },
              },
            ],
          },
        ],
      }

      const messages = parseMetaSocialWebhook(echoPayload)
      expect(messages).toHaveLength(0)
    })

    it('should parse postback button click event as interactive message', () => {
      const postbackPayload = {
        object: 'page',
        entry: [
          {
            id: 'page_id_1001',
            messaging: [
              {
                sender: { id: 'psid_user_5001' },
                recipient: { id: 'page_id_1001' },
                postback: {
                  title: 'Mulai Chat',
                  payload: 'USER_GET_STARTED',
                },
              },
            ],
          },
        ],
      }

      const messages = parseMetaSocialWebhook(postbackPayload)
      expect(messages).toHaveLength(1)
      expect(messages[0].contentType).toBe('interactive')
      expect(messages[0].content).toBe('USER_GET_STARTED')
    })
  })

  describe('Outbound Meta Social Sender (MetaSocialSenderService)', () => {
    it('should send text message via Meta Graph API', async () => {
      const requestsMade: Array<{ url: string; options?: RequestInit }> = []
      const mockFetch = async (url: string, options?: RequestInit) => {
        requestsMade.push({ url, options })
        return {
          ok: true,
          status: 200,
          json: async () => ({
            recipient_id: 'psid_user_5001',
            message_id: 'mid.graph.sent.778899',
          }),
        }
      }

      const sender = new MetaSocialSenderService({
        accessToken: dummyAccessToken,
        fetcher: mockFetch,
      })

      const result = await sender.sendMessage({
        recipientId: 'psid_user_5001',
        text: 'Halo, pesanan Anda sudah dikonfirmasi.',
        replyToMid: 'mid.fb.message.12345',
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('mid.graph.sent.778899')
      expect(requestsMade).toHaveLength(1)
      expect(requestsMade[0].url).toContain('https://graph.facebook.com/v18.0/me/messages')

      const body = JSON.parse(requestsMade[0].options?.body as string)
      expect(body.recipient.id).toBe('psid_user_5001')
      expect(body.message.text).toBe('Halo, pesanan Anda sudah dikonfirmasi.')
      expect(body.message.reply_to.mid).toBe('mid.fb.message.12345')
      expect(body.messaging_type).toBe('RESPONSE')
    })

    it('should send media attachment via Graph API', async () => {
      const requestsMade: Array<{ url: string; options?: RequestInit }> = []
      const mockFetch = async (url: string, options?: RequestInit) => {
        requestsMade.push({ url, options })
        return {
          ok: true,
          status: 200,
          json: async () => ({
            recipient_id: 'psid_user_5001',
            message_id: 'mid.graph.media.554433',
          }),
        }
      }

      const sender = new MetaSocialSenderService({
        accessToken: dummyAccessToken,
        fetcher: mockFetch,
      })

      const result = await sender.sendMediaAttachment({
        recipientId: 'psid_user_5001',
        mediaType: 'image',
        mediaUrl: 'https://example.com/promo_banner.png',
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('mid.graph.media.554433')

      const body = JSON.parse(requestsMade[0].options?.body as string)
      expect(body.message.attachment.type).toBe('image')
      expect(body.message.attachment.payload.url).toBe('https://example.com/promo_banner.png')
    })

    it('should handle Graph API error response gracefully', async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: 'Invalid OAuth access token.',
            type: 'OAuthException',
            code: 190,
          },
        }),
      })

      const sender = new MetaSocialSenderService({
        accessToken: 'bad_token',
        fetcher: mockFetch,
      })

      const result = await sender.sendMessage({
        recipientId: 'psid_user_5001',
        text: 'Test',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid OAuth access token.')
    })
  })

  describe('Meta Social HTTP Routes (apps/api)', () => {
    it('should handle GET /api/v1/meta-social/webhook challenge successfully', async () => {
      const { default: app } = await import('../../index')
      const response = await app.request(
        `/api/v1/meta-social/webhook?hub.mode=subscribe&hub.verify_token=${dummyVerifyToken}&hub.challenge=test_challenge_meta_social_999`,
      )

      expect(response.status).toBe(200)
      const text = await response.text()
      expect(text).toBe('test_challenge_meta_social_999')
    })

    it('should reject GET /api/v1/meta-social/webhook with 403 on wrong verify token', async () => {
      const { default: app } = await import('../../index')
      const response = await app.request(
        '/api/v1/meta-social/webhook?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=test_123',
      )

      expect(response.status).toBe(403)
    })

    it('should handle POST /api/v1/meta-social/webhook for incoming events', async () => {
      const { default: app } = await import('../../index')
      const payload = {
        object: 'page',
        entry: [
          {
            id: 'page_123',
            messaging: [
              {
                sender: { id: 'user_456' },
                recipient: { id: 'page_123' },
                message: { mid: 'mid_001', text: 'Halo via HTTP route' },
              },
            ],
          },
        ],
      }

      const response = await app.request('/api/v1/meta-social/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.ok).toBe(true)
      expect(data.processed).toBe(1)
    })

    it('should handle POST /api/v1/meta-social/outbound successfully', async () => {
      const { default: app } = await import('../../index')
      const response = await app.request('/api/v1/meta-social/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: dummyAccessToken,
          recipientId: 'user_456',
          text: 'Pesan balasan outbound ke Meta Social',
        }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.status).toBe('success')
      expect(data.data.success).toBe(true)
    })
  })

  describe('Single Organization Guardrail & Phase 3 Checklist', () => {
    it('should strictly NOT contain or require accountId in any Meta social processing method', async () => {
      const service = new MetaSocialService()
      const result = await service.processWebhookPayload({
        object: 'page',
        entry: [
          {
            id: 'p1',
            messaging: [
              {
                sender: { id: 'u1' },
                recipient: { id: 'p1' },
                message: { mid: 'm1', text: 'Test' },
              },
            ],
          },
        ],
      })

      expect(result).not.toHaveProperty('accountId')
      expect(result).not.toHaveProperty('account_id')
    })

    it('should verify Phase 3 checklist marks Task 3.9 as completed', () => {
      const rootDir = join(import.meta.dir, '..', '..', '..', '..', '..')
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_3_CHECKLIST.md'), 'utf-8')
      expect(checklistContent).toContain('- [x] **Task 3.9 (TDD - Meta Social: FB & IG)**:')
    })
  })
})
