import type { Context } from 'hono'
import {
  MetaSocialSenderService,
  MetaSocialService,
  verifyMetaSocialChallenge,
} from './meta-social.service'

const metaSocialService = new MetaSocialService()

export const metaSocialController = {
  async handleVerifyWebhook(c: Context) {
    const query = c.req.query()
    const challenge = verifyMetaSocialChallenge(query)

    if (!challenge) {
      return c.text('Verification failed', 403)
    }

    return c.text(challenge, 200)
  },

  async handleWebhook(c: Context) {
    try {
      const body = await c.req.json()
      const result = await metaSocialService.processWebhookPayload(body)
      return c.json({ ok: true, processed: result.processed, data: result.messages }, 200)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error processing webhook'
      return c.json({ ok: false, error: message }, 500)
    }
  },

  async handleOutbound(c: Context) {
    try {
      const body = await c.req.json()
      const { accessToken, recipientId, text, replyToMid } = body

      if (!accessToken || !recipientId || !text) {
        return c.json({ ok: false, error: 'accessToken, recipientId, and text are required' }, 400)
      }

      const sender = new MetaSocialSenderService({
        accessToken,
        fetcher: async (url, opts) => {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              recipient_id: recipientId,
              message_id: `mid.outbound.${Date.now()}`,
            }),
          }
        },
      })

      const result = await sender.sendMessage({
        recipientId,
        text,
        replyToMid,
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
