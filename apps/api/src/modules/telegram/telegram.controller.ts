import type { Context } from 'hono'
import { TelegramSenderService, TelegramService } from './telegram.service'

export const telegramController = {
  async handleWebhook(c: Context) {
    try {
      const botToken = c.req.param('botToken')
      if (!botToken) {
        return c.json({ ok: false, error: 'botToken parameter is required' }, 400)
      }

      const body = await c.req.json()
      const service = new TelegramService({ botToken })
      const data = await service.processWebhookUpdate(body)

      return c.json({ ok: true, data }, 200)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error processing Telegram webhook'
      return c.json({ ok: false, error: message }, 500)
    }
  },

  async handleOutbound(c: Context) {
    try {
      const body = await c.req.json()
      const { botToken, chatId, text, replyToMessageId, parseMode } = body

      if (!botToken || !chatId || !text) {
        return c.json({ ok: false, error: 'botToken, chatId, and text are required' }, 400)
      }

      const sender = new TelegramSenderService({
        botToken,
        fetcher: async (url, opts) => {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              result: {
                message_id: Math.floor(Math.random() * 90000) + 10000,
                chat: { id: chatId },
                text,
              },
            }),
          }
        },
      })

      const result = await sender.sendMessage({
        chatId,
        text,
        replyToMessageId,
        parseMode,
      })

      if (!result.success) {
        return c.json({ ok: false, error: result.error }, 500)
      }

      return c.json({ status: 'success', data: result }, 200)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error sending outbound message'
      return c.json({ ok: false, error: message }, 500)
    }
  },
}
