import type { Context } from 'hono'
import { BusinessHoursService } from './business-hours.service'

export const businessHoursService = new BusinessHoursService()

export const businessHoursController = {
  async handleEvaluate(c: Context) {
    try {
      const body = await c.req.json()
      const { config, conversationId, incomingMessageDate } = body

      if (!config || !conversationId) {
        return c.json({ ok: false, error: 'config and conversationId are required' }, 400)
      }

      const result = await businessHoursService.evaluateOutOfOffice({
        config,
        conversationId,
        incomingMessageDate,
      })

      return c.json({ ok: true, data: result }, 200)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error evaluating business hours'
      return c.json({ ok: false, error: message }, 500)
    }
  },

  async handleGetByInbox(c: Context) {
    try {
      const inboxId = c.req.param('inboxId')
      if (!inboxId) {
        return c.json({ ok: false, error: 'inboxId is required' }, 400)
      }

      const config = await businessHoursService.getBusinessHours(inboxId)
      return c.json({ ok: true, data: config }, 200)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error fetching business hours'
      return c.json({ ok: false, error: message }, 500)
    }
  },

  async handleUpsertByInbox(c: Context) {
    try {
      const inboxId = c.req.param('inboxId')
      const body = await c.req.json()

      const config = await businessHoursService.upsertBusinessHours({
        ...body,
        inboxId: inboxId || body.inboxId,
      })

      return c.json({ ok: true, data: config }, 200)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error upserting business hours'
      return c.json({ ok: false, error: message }, 500)
    }
  },
}
