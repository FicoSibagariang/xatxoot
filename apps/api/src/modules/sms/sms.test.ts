import { describe, expect, it } from 'bun:test'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  SmsService,
  TwilioSenderService,
  parseTwilioInboundSms,
  validateTwilioSignature,
} from './sms.service'

describe('SMS / Twilio Webhook & Outbound Sender (Task 3.10 - apps/api)', () => {
  const dummyAccountSid = 'mock_sms_account_sid_9988'
  const dummyAuthToken = 'mock_sms_auth_token_secret_123'
  const dummyFromNumber = '+12025550100'
  const dummyToNumber = '+6281234567890'

  describe('Twilio Signature Validation (validateTwilioSignature)', () => {
    it('should validate valid Twilio HMAC-SHA1 signature', () => {
      const webhookUrl = 'https://api.xatxoot.com/api/v1/sms/webhook'
      const params = {
        To: dummyFromNumber,
        From: dummyToNumber,
        Body: 'Halo customer service',
        MessageSid: 'mock_msg_sid_12345',
      }

      // Hitung signature Twilio: HMAC-SHA1 dari URL + sorted keys concatenations
      const sortedKeys = Object.keys(params).sort()
      let dataString = webhookUrl
      for (const key of sortedKeys) {
        dataString += key + (params as Record<string, string>)[key]
      }
      const expectedSignature = createHmac('sha1', dummyAuthToken)
        .update(dataString)
        .digest('base64')

      expect(
        validateTwilioSignature({
          url: webhookUrl,
          params,
          signatureHeader: expectedSignature,
          authToken: dummyAuthToken,
        }),
      ).toBe(true)

      expect(
        validateTwilioSignature({
          url: webhookUrl,
          params,
          signatureHeader: 'invalid_base64_signature',
          authToken: dummyAuthToken,
        }),
      ).toBe(false)
    })

    it('should return false if signatureHeader or authToken is missing', () => {
      expect(
        validateTwilioSignature({
          url: 'https://example.com',
          params: {},
          signatureHeader: null,
          authToken: dummyAuthToken,
        }),
      ).toBe(false)

      expect(
        validateTwilioSignature({
          url: 'https://example.com',
          params: {},
          signatureHeader: 'some_sig',
          authToken: '',
        }),
      ).toBe(false)
    })
  })

  describe('Twilio Inbound SMS Parser (parseTwilioInboundSms)', () => {
    it('should parse standard incoming plain text SMS', () => {
      const payload = {
        MessageSid: 'mock_sms_sid_001',
        AccountSid: dummyAccountSid,
        From: '+6281234567890',
        To: '+12025550100',
        Body: 'Halo, saya mau konfirmasi pembayaran pesanan #5501.',
      }

      const parsed = parseTwilioInboundSms(payload)
      expect(parsed).not.toBeNull()
      if (parsed) {
        expect(parsed.messageSid).toBe('mock_sms_sid_001')
        expect(parsed.from).toBe('+6281234567890')
        expect(parsed.to).toBe('+12025550100')
        expect(parsed.body).toBe('Halo, saya mau konfirmasi pembayaran pesanan #5501.')
        expect(parsed.contentType).toBe('text')
        expect(parsed.mediaUrls).toHaveLength(0)
      }
    })

    it('should parse incoming MMS with media attachment', () => {
      const payload = {
        MessageSid: 'mock_mms_sid_002',
        AccountSid: dummyAccountSid,
        From: '+6281234567890',
        To: '+12025550100',
        Body: 'Lampiran foto bukti KTP',
        NumMedia: '2',
        MediaUrl0: 'https://api.twilio.com/mock/media/01.jpg',
        MediaContentType0: 'image/jpeg',
        MediaUrl1: 'https://api.twilio.com/mock/media/02.png',
        MediaContentType1: 'image/png',
      }

      const parsed = parseTwilioInboundSms(payload)
      expect(parsed).not.toBeNull()
      if (parsed) {
        expect(parsed.contentType).toBe('image')
        expect(parsed.mediaUrls).toHaveLength(2)
        expect(parsed.mediaUrls[0]).toBe('https://api.twilio.com/mock/media/01.jpg')
        expect(parsed.mediaUrls[1]).toBe('https://api.twilio.com/mock/media/02.png')
      }
    })

    it('should return null when required From or To fields are missing', () => {
      expect(parseTwilioInboundSms({})).toBeNull()
      expect(parseTwilioInboundSms({ From: '+628123' })).toBeNull()
      expect(parseTwilioInboundSms({ To: '+1202555' })).toBeNull()
    })
  })

  describe('Outbound SMS Sender (TwilioSenderService)', () => {
    it('should send SMS message via Twilio REST API with Basic Auth', async () => {
      const requestsMade: Array<{ url: string; options?: RequestInit }> = []
      const mockFetch = async (url: string, options?: RequestInit) => {
        requestsMade.push({ url, options })
        return {
          ok: true,
          status: 201,
          json: async () => ({
            sid: 'mock_sent_sid_8899',
            status: 'queued',
            to: '+6281234567890',
            from: '+12025550100',
            body: 'Halo, paket Anda sudah dalam pengiriman.',
          }),
        }
      }

      const sender = new TwilioSenderService({
        accountSid: dummyAccountSid,
        authToken: dummyAuthToken,
        defaultFrom: dummyFromNumber,
        fetcher: mockFetch,
      })

      const result = await sender.sendSms({
        to: '+6281234567890',
        body: 'Halo, paket Anda sudah dalam pengiriman.',
      })

      expect(result.success).toBe(true)
      expect(result.messageSid).toBe('mock_sent_sid_8899')
      expect(requestsMade).toHaveLength(1)

      const targetUrl = requestsMade[0].url
      expect(targetUrl).toContain(`Accounts/${dummyAccountSid}/Messages.json`)

      const headers = (requestsMade[0].options?.headers as Record<string, string>) || {}
      expect(headers.Authorization).toBeDefined()
      // Basic Auth encoding: base64(dummyAccountSid:dummyAuthToken)
      const expectedBasic = `Basic ${Buffer.from(`${dummyAccountSid}:${dummyAuthToken}`).toString('base64')}`
      expect(headers.Authorization).toBe(expectedBasic)
      expect(headers['Content-Type']).toContain('application/x-www-form-urlencoded')

      const bodyParams = new URLSearchParams(requestsMade[0].options?.body as string)
      expect(bodyParams.get('To')).toBe('+6281234567890')
      expect(bodyParams.get('From')).toBe(dummyFromNumber)
      expect(bodyParams.get('Body')).toBe('Halo, paket Anda sudah dalam pengiriman.')
    })

    it('should support MMS mediaUrl parameter in sendSms', async () => {
      const requestsMade: Array<{ url: string; options?: RequestInit }> = []
      const mockFetch = async (url: string, options?: RequestInit) => {
        requestsMade.push({ url, options })
        return {
          ok: true,
          status: 201,
          json: async () => ({
            sid: 'mock_mms_sent_9900',
            status: 'queued',
          }),
        }
      }

      const sender = new TwilioSenderService({
        accountSid: dummyAccountSid,
        authToken: dummyAuthToken,
        fetcher: mockFetch,
      })

      const result = await sender.sendSms({
        to: '+6281234567890',
        from: dummyFromNumber,
        body: 'Berikut struk transaksi Anda',
        mediaUrl: 'https://example.com/receipt.png',
      })

      expect(result.success).toBe(true)
      expect(result.messageSid).toBe('mock_mms_sent_9900')

      const bodyParams = new URLSearchParams(requestsMade[0].options?.body as string)
      expect(bodyParams.get('MediaUrl')).toBe('https://example.com/receipt.png')
    })

    it('should handle Twilio API error responses gracefully without exceptions', async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 400,
        json: async () => ({
          code: 21211,
          message: "The 'To' number is not a valid phone number.",
        }),
      })

      const sender = new TwilioSenderService({
        accountSid: dummyAccountSid,
        authToken: dummyAuthToken,
        fetcher: mockFetch,
      })

      const result = await sender.sendSms({
        to: 'invalid-number',
        from: dummyFromNumber,
        body: 'Test',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not a valid phone number')
    })
  })

  describe('SMS HTTP Routes (apps/api)', () => {
    it('should handle POST /api/v1/sms/webhook incoming Twilio payload', async () => {
      const { default: app } = await import('../../index')
      const payload = {
        MessageSid: 'mock_inbound_sms_112233',
        From: '+62899887766',
        To: '+12025550100',
        Body: 'Pesan SMS masuk dari pelanggan via webhook HTTP',
      }

      const response = await app.request('/api/v1/sms/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.ok).toBe(true)
      expect(data.data.from).toBe('+62899887766')
      expect(data.data.body).toBe('Pesan SMS masuk dari pelanggan via webhook HTTP')
    })

    it('should reject POST /api/v1/sms/webhook when missing required fields', async () => {
      const { default: app } = await import('../../index')
      const response = await app.request('/api/v1/sms/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Body: 'No from or to' }),
      })

      expect(response.status).toBe(400)
    })

    it('should handle POST /api/v1/sms/outbound successfully', async () => {
      const { default: app } = await import('../../index')
      const response = await app.request('/api/v1/sms/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountSid: dummyAccountSid,
          authToken: dummyAuthToken,
          from: dummyFromNumber,
          to: '+6281234567890',
          body: 'SMS balasan outbound dari dashboard agent',
        }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.status).toBe('success')
      expect(data.data.success).toBe(true)
    })
  })

  describe('Single Organization Guardrail & Phase 3 Checklist', () => {
    it('should strictly NOT contain or require accountId in SMS service', async () => {
      const service = new SmsService()
      const result = await service.processWebhookPayload({
        MessageSid: 'sid_1',
        From: '+1234',
        To: '+5678',
        Body: 'Test org',
      })

      expect(result).not.toHaveProperty('accountId')
      expect(result).not.toHaveProperty('account_id')
    })

    it('should verify Phase 3 checklist marks Task 3.10 as completed', () => {
      const rootDir = join(import.meta.dir, '..', '..', '..', '..', '..')
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_3_CHECKLIST.md'), 'utf-8')
      expect(checklistContent).toContain('- [x] **Task 3.10 (TDD - SMS)**:')
    })
  })
})
