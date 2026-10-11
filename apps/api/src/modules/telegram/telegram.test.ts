import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TelegramSenderService, TelegramService, parseTelegramUpdate } from './telegram.service'

describe('Telegram Bot API Webhook & Outbound Sender (Task 3.8 - apps/api)', () => {
  const dummyBotToken = '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ'

  describe('Telegram Webhook Update Parser (parseTelegramUpdate)', () => {
    it('should parse standard incoming text message update', () => {
      const update = {
        update_id: 10001,
        message: {
          message_id: 54321,
          from: {
            id: 998877,
            is_bot: false,
            first_name: 'Ahmad',
            last_name: 'Dahlan',
            username: 'ahmad_d',
          },
          chat: {
            id: 998877,
            type: 'private',
            first_name: 'Ahmad',
            last_name: 'Dahlan',
            username: 'ahmad_d',
          },
          date: 1760200000,
          text: 'Halo admin, mau tanya stok barang ready?',
        },
      }

      const parsed = parseTelegramUpdate(update)
      expect(parsed).not.toBeNull()
      if (parsed) {
        expect(parsed.type).toBe('message')
        expect(parsed.messageId).toBe('54321')
        expect(parsed.chatId).toBe('998877')
        expect(parsed.senderId).toBe('998877')
        expect(parsed.senderName).toBe('Ahmad Dahlan')
        expect(parsed.senderUsername).toBe('ahmad_d')
        expect(parsed.contentType).toBe('text')
        expect(parsed.content).toBe('Halo admin, mau tanya stok barang ready?')
        expect(parsed.replyToMessageId).toBeNull()
        expect(parsed.attachments).toHaveLength(0)
      }
    })

    it('should parse incoming photo update and pick highest resolution file', () => {
      const update = {
        update_id: 10002,
        message: {
          message_id: 54322,
          from: {
            id: 887766,
            is_bot: false,
            first_name: 'Siti',
          },
          chat: {
            id: 887766,
            type: 'private',
          },
          date: 1760200100,
          caption: 'Ini bukti transfer pembayaran',
          photo: [
            {
              file_id: 'thumb_id_01',
              file_unique_id: 'u01',
              file_size: 1024,
              width: 90,
              height: 90,
            },
            {
              file_id: 'medium_id_02',
              file_unique_id: 'u02',
              file_size: 10240,
              width: 320,
              height: 320,
            },
            {
              file_id: 'large_id_03',
              file_unique_id: 'u03',
              file_size: 102400,
              width: 1280,
              height: 1280,
            },
          ],
        },
      }

      const parsed = parseTelegramUpdate(update)
      expect(parsed).not.toBeNull()
      if (parsed) {
        expect(parsed.type).toBe('message')
        expect(parsed.contentType).toBe('image')
        expect(parsed.content).toBe('Ini bukti transfer pembayaran')
        expect(parsed.attachments).toHaveLength(1)
        expect(parsed.attachments[0].fileId).toBe('large_id_03')
        expect(parsed.attachments[0].fileType).toBe('image')
        expect(parsed.attachments[0].fileSize).toBe(102400)
      }
    })

    it('should parse incoming document update', () => {
      const update = {
        update_id: 10003,
        message: {
          message_id: 54323,
          from: { id: 776655, is_bot: false, first_name: 'Budi' },
          chat: { id: 776655, type: 'private' },
          date: 1760200200,
          document: {
            file_id: 'doc_file_112233',
            file_name: 'invoice_2026.pdf',
            mime_type: 'application/pdf',
            file_size: 204800,
          },
          caption: 'Lampiran invoice saya',
        },
      }

      const parsed = parseTelegramUpdate(update)
      expect(parsed).not.toBeNull()
      if (parsed) {
        expect(parsed.contentType).toBe('document')
        expect(parsed.content).toBe('Lampiran invoice saya')
        expect(parsed.attachments).toHaveLength(1)
        expect(parsed.attachments[0].fileName).toBe('invoice_2026.pdf')
        expect(parsed.attachments[0].mimeType).toBe('application/pdf')
        expect(parsed.attachments[0].fileType).toBe('file')
      }
    })

    it('should parse callback_query update from inline keyboard buttons', () => {
      const update = {
        update_id: 10004,
        callback_query: {
          id: 'cb_query_9988',
          from: { id: 998877, is_bot: false, first_name: 'Ahmad' },
          message: {
            message_id: 54320,
            chat: { id: 998877, type: 'private' },
            text: 'Silakan pilih menu bantuan:',
          },
          data: 'action_check_order_status',
        },
      }

      const parsed = parseTelegramUpdate(update)
      expect(parsed).not.toBeNull()
      if (parsed) {
        expect(parsed.type).toBe('callback_query')
        expect(parsed.callbackQueryId).toBe('cb_query_9988')
        expect(parsed.chatId).toBe('998877')
        expect(parsed.content).toBe('action_check_order_status')
        expect(parsed.contentType).toBe('interactive')
      }
    })

    it('should extract replyToMessageId if message is replying to another message', () => {
      const update = {
        update_id: 10005,
        message: {
          message_id: 54325,
          from: { id: 998877, is_bot: false, first_name: 'Ahmad' },
          chat: { id: 998877, type: 'private' },
          date: 1760200500,
          text: 'Betul, itu alamat pengiriman saya.',
          reply_to_message: {
            message_id: 54310,
            date: 1760199000,
            chat: { id: 998877, type: 'private' },
            text: 'Apakah alamat Anda di Jl. Sudirman No 10?',
          },
        },
      }

      const parsed = parseTelegramUpdate(update)
      expect(parsed).not.toBeNull()
      if (parsed) {
        expect(parsed.replyToMessageId).toBe('54310')
      }
    })

    it('should return null for unsupported or empty update payloads', () => {
      expect(parseTelegramUpdate({})).toBeNull()
      expect(parseTelegramUpdate({ update_id: 10099, channel_post: {} })).toBeNull()
    })
  })

  describe('Outbound Telegram Sender (TelegramSenderService)', () => {
    it('should send text message via Telegram Bot API', async () => {
      const requestsMade: Array<{ url: string; options?: RequestInit }> = []
      const mockFetch = async (url: string, options?: RequestInit) => {
        requestsMade.push({ url, options })
        return {
          ok: true,
          json: async () => ({
            ok: true,
            result: {
              message_id: 77701,
              chat: { id: 998877 },
              text: 'Halo, pesanan Anda sedang kami proses.',
            },
          }),
        }
      }

      const sender = new TelegramSenderService({
        botToken: dummyBotToken,
        fetcher: mockFetch,
      })

      const result = await sender.sendMessage({
        chatId: '998877',
        text: 'Halo, pesanan Anda sedang kami proses.',
        replyToMessageId: '54321',
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('77701')
      expect(requestsMade).toHaveLength(1)
      expect(requestsMade[0].url).toContain(`/bot${dummyBotToken}/sendMessage`)

      const body = JSON.parse(requestsMade[0].options?.body as string)
      expect(body.chat_id).toBe('998877')
      expect(body.text).toBe('Halo, pesanan Anda sedang kami proses.')
      expect(body.reply_to_message_id).toBe(54321)
    })

    it('should send photo attachment via sendPhoto endpoint', async () => {
      const requestsMade: Array<{ url: string; options?: RequestInit }> = []
      const mockFetch = async (url: string, options?: RequestInit) => {
        requestsMade.push({ url, options })
        return {
          ok: true,
          json: async () => ({
            ok: true,
            result: { message_id: 77702 },
          }),
        }
      }

      const sender = new TelegramSenderService({
        botToken: dummyBotToken,
        fetcher: mockFetch,
      })

      const result = await sender.sendPhoto({
        chatId: '998877',
        photo: 'https://example.com/receipt.jpg',
        caption: 'Ini bukti resi paket Anda',
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('77702')
      expect(requestsMade[0].url).toContain(`/bot${dummyBotToken}/sendPhoto`)

      const body = JSON.parse(requestsMade[0].options?.body as string)
      expect(body.chat_id).toBe('998877')
      expect(body.photo).toBe('https://example.com/receipt.jpg')
      expect(body.caption).toBe('Ini bukti resi paket Anda')
    })

    it('should send document attachment via sendDocument endpoint', async () => {
      const requestsMade: Array<{ url: string; options?: RequestInit }> = []
      const mockFetch = async (url: string, options?: RequestInit) => {
        requestsMade.push({ url, options })
        return {
          ok: true,
          json: async () => ({
            ok: true,
            result: { message_id: 77703 },
          }),
        }
      }

      const sender = new TelegramSenderService({
        botToken: dummyBotToken,
        fetcher: mockFetch,
      })

      const result = await sender.sendDocument({
        chatId: '998877',
        document: 'https://example.com/terms.pdf',
        caption: 'Buku panduan layanan',
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('77703')
      expect(requestsMade[0].url).toContain(`/bot${dummyBotToken}/sendDocument`)
    })

    it('should answer callback query via answerCallbackQuery endpoint', async () => {
      const requestsMade: Array<{ url: string; options?: RequestInit }> = []
      const mockFetch = async (url: string, options?: RequestInit) => {
        requestsMade.push({ url, options })
        return {
          ok: true,
          json: async () => ({ ok: true, result: true }),
        }
      }

      const sender = new TelegramSenderService({
        botToken: dummyBotToken,
        fetcher: mockFetch,
      })

      const result = await sender.answerCallbackQuery({
        callbackQueryId: 'cb_query_9988',
        text: 'Permintaan diproses',
      })

      expect(result.success).toBe(true)
      expect(requestsMade[0].url).toContain(`/bot${dummyBotToken}/answerCallbackQuery`)
      const body = JSON.parse(requestsMade[0].options?.body as string)
      expect(body.callback_query_id).toBe('cb_query_9988')
      expect(body.text).toBe('Permintaan diproses')
    })

    it('should handle Telegram Bot API error responses gracefully', async () => {
      const mockFetch = async () => ({
        ok: false,
        status: 403,
        json: async () => ({
          ok: false,
          error_code: 403,
          description: 'Forbidden: bot was blocked by the user',
        }),
      })

      const sender = new TelegramSenderService({
        botToken: dummyBotToken,
        fetcher: mockFetch,
      })

      const result = await sender.sendMessage({
        chatId: '998877',
        text: 'Halo',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Forbidden: bot was blocked by the user')
    })
  })

  describe('Telegram HTTP Routes (apps/api)', () => {
    it('should handle POST /api/v1/telegram/webhook/:botToken successfully', async () => {
      const { default: app } = await import('../../index')
      const response = await app.request(`/api/v1/telegram/webhook/${dummyBotToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          update_id: 20001,
          message: {
            message_id: 11223,
            from: { id: 554433, is_bot: false, first_name: 'Dewi' },
            chat: { id: 554433, type: 'private' },
            date: 1760200800,
            text: 'Halo admin telegram',
          },
        }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.ok).toBe(true)
      expect(data.data.senderName).toBe('Dewi')
      expect(data.data.content).toBe('Halo admin telegram')
    })

    it('should handle POST /api/v1/telegram/outbound successfully', async () => {
      const { default: app } = await import('../../index')
      const response = await app.request('/api/v1/telegram/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: dummyBotToken,
          chatId: '554433',
          text: 'Pesan balasan dari agent web',
        }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.status).toBe('success')
      expect(data.data.success).toBe(true)
    })
  })

  describe('Single Organization Guardrail & Phase 3 Checklist', () => {
    it('should strictly NOT contain or require accountId in any Telegram processing method', async () => {
      const service = new TelegramService({ botToken: dummyBotToken })
      const result = await service.processWebhookUpdate({
        update_id: 1,
        message: {
          message_id: 10,
          from: { id: 100, is_bot: false, first_name: 'Test' },
          chat: { id: 100, type: 'private' },
          text: 'Test',
        },
      })

      expect(result).not.toHaveProperty('accountId')
      expect(result).not.toHaveProperty('account_id')
    })

    it('should verify Phase 3 checklist marks Task 3.8 as completed', () => {
      const rootDir = join(import.meta.dir, '..', '..', '..', '..', '..')
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_3_CHECKLIST.md'), 'utf-8')
      expect(checklistContent).toContain('- [x] **Task 3.8 (TDD - Telegram)**:')
    })
  })
})
