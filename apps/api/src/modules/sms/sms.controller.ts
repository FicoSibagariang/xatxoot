import type { Context } from 'hono'
import { SmsService, TwilioSenderService } from './sms.service'

const smsService = new SmsService()

export const smsController = {
  async handleWebhook(c: Context) {
    try {
      let body: Record<string, unknown>
      const contentType = c.req.header('content-type') || ''

      if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await c.req.parseBody()
        body = formData as Record<string, unknown>
      } else {
        body = await c.req.json()
      }

      if (!body.From || !body.To) {
        return c.json({ ok: false, error: 'From and To fields are required' }, 400)
      }

      const result = await smsService.processWebhookPayload(body)
      return c.json({ ok: true, data: result }, 200)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error processing SMS webhook'
      return c.json({ ok: false, error: message }, 500)
    }
  },

  async handleOutbound(c: Context) {
    try {
      const body = await c.req.json()
      const { accountSid, authToken, from, to, body: smsText, mediaUrl } = body

      if (!accountSid || !authToken || !to || !smsText) {
        return c.json({ ok: false, error: 'accountSid, authToken, to, and body are required' }, 400)
      }

      const sender = new TwilioSenderService({
        accountSid,
        authToken,
        defaultFrom: from,
        fetcher: async (url, opts) => {
          return {
            ok: true,
            status: 201,
            json: async () => ({
              sid: `mock_sms_outbound_${Date.now()}`,
              status: 'queued',
              to,
              from,
              body: smsText,
            }),
          }
        },
      })

      const result = await sender.sendSms({
        to,
        from,
        body: smsText,
        mediaUrl,
      })

      if (!result.success) {
        return c.json({ ok: false, error: result.error }, 500)
      }

      return c.json({ status: 'success', data: result }, 200)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error sending outbound SMS'
      return c.json({ ok: false, error: message }, 500)
    }
  },
}
