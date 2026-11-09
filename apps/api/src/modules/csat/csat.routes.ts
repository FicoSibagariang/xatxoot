import { Hono } from 'hono'
import { rateLimiter } from '../../middleware/rate-limiter'
import { csatController } from './csat.controller'

export const csatRoutes = new Hono()

const csatPublicLimiter = rateLimiter({
  max: 10,
  windowMs: 60_000,
  message: 'Terlalu banyak permintaan pengisian survei. Silakan coba lagi nanti.',
})

// Aggregated & Ticket routes
csatRoutes.get('/metrics', csatController.handleGetMetrics)
csatRoutes.get('/tickets/:ticketId', csatController.handleGetByTicketId)

// Public survey routes by token
csatRoutes.get('/:ticket_token', csatController.handleGetByToken)
csatRoutes.post('/:ticket_token', csatPublicLimiter, csatController.handleSubmitSurvey)

export default csatRoutes
