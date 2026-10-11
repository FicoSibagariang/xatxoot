import { Hono } from 'hono'
import { handleAutoAssignTicket } from '../assignment/assignment.controller'
import { authMiddleware } from '../auth/auth.middleware'
import {
  handleAssignee,
  handleGetTicket,
  handleListTickets,
  handleUpdateNote,
  handleUpdateStatus,
} from './tickets.controller'

export const ticketRoutes = new Hono()

ticketRoutes.use('*', authMiddleware)

ticketRoutes.get('/', handleListTickets)
ticketRoutes.get('/:id', handleGetTicket)
ticketRoutes.patch('/:id/status', handleUpdateStatus)
ticketRoutes.patch('/:id/note', handleUpdateNote)
ticketRoutes.patch('/:id/assignee', handleAssignee)
ticketRoutes.post('/:id/auto-assign', handleAutoAssignTicket)

export default ticketRoutes
