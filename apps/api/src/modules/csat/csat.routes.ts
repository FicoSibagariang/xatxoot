import { Hono } from 'hono'
import { csatController } from './csat.controller'

export const csatRoutes = new Hono()

// Aggregated & Ticket routes
csatRoutes.get('/metrics', csatController.handleGetMetrics)
csatRoutes.get('/tickets/:ticketId', csatController.handleGetByTicketId)

// Public survey routes by token
csatRoutes.get('/:ticket_token', csatController.handleGetByToken)
csatRoutes.post('/:ticket_token', csatController.handleSubmitSurvey)

export default csatRoutes
