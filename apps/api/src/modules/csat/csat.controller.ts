import type { Context } from 'hono'
import { csatService } from './csat.service'

export const csatController = {
  async handleGetByToken(c: Context) {
    try {
      const token = c.req.param('ticket_token')
      if (!token) {
        return c.json({ ok: false, error: 'Ticket token is required' }, 400)
      }

      const invite = await csatService.getInviteByToken(token)
      if (!invite) {
        return c.json({ ok: false, error: 'CSAT invite not found or invalid token' }, 404)
      }

      return c.json(
        {
          ok: true,
          data: {
            ticketId: invite.ticketId,
            status: invite.status,
            isSubmitted: invite.status === 'submitted',
            expiresAt: invite.expiresAt,
          },
        },
        200,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error fetching CSAT invite'
      return c.json({ ok: false, error: message }, 500)
    }
  },

  async handleSubmitSurvey(c: Context) {
    try {
      const token = c.req.param('ticket_token')
      if (!token) {
        return c.json({ ok: false, error: 'Ticket token is required' }, 400)
      }

      const body = await c.req.json()
      const { rating, feedbackText } = body

      if (rating === undefined || rating === null) {
        return c.json({ ok: false, error: 'Rating is required' }, 400)
      }

      const survey = await csatService.submitSurvey({
        token,
        rating,
        feedbackText,
      })

      return c.json({ ok: true, data: survey }, 200)
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode || 500
      const message = err instanceof Error ? err.message : 'Error submitting CSAT survey'
      return c.json({ ok: false, error: message }, statusCode as 400 | 404 | 409 | 410 | 500)
    }
  },

  async handleGetByTicketId(c: Context) {
    try {
      const ticketId = c.req.param('ticketId')
      if (!ticketId) {
        return c.json({ ok: false, error: 'Ticket ID is required' }, 400)
      }

      const survey = await csatService.getSurveyByTicketId(ticketId)
      return c.json({ ok: true, data: survey }, 200)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error fetching ticket CSAT survey'
      return c.json({ ok: false, error: message }, 500)
    }
  },

  async handleGetMetrics(c: Context) {
    try {
      const metrics = await csatService.getMetrics()
      return c.json({ ok: true, data: metrics }, 200)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error calculating CSAT metrics'
      return c.json({ ok: false, error: message }, 500)
    }
  },
}
