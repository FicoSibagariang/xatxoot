import type { Context } from 'hono'
import { EmailService } from './email.service'

const emailService = new EmailService()

export const emailController = {
  async handleInbound(c: Context) {
    try {
      const body = await c.req.json()
      if (!body.from || !body.to || !body.subject) {
        return c.json({ error: 'Field from, to, dan subject wajib diisi' }, 400)
      }

      const result = await emailService.processInboundEmail(body)
      return c.json({ status: 'success', data: result }, 200)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memproses email inbound'
      return c.json({ error: message }, 500)
    }
  },

  async handleOutbound(c: Context) {
    try {
      const body = await c.req.json()
      if (!body.to || !body.subject || !body.text) {
        return c.json({ error: 'Field to, subject, dan text wajib diisi' }, 400)
      }

      const result = await emailService.sendReplyEmail(body)
      if (!result.success) {
        return c.json({ error: result.error || 'Gagal mengirim email' }, 500)
      }

      return c.json({ status: 'success', data: result }, 200)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal mengirim email outbound'
      return c.json({ error: message }, 500)
    }
  },
}
