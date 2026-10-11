import { Hono } from 'hono'
import { authMiddleware } from '../auth/auth.middleware'
import {
  handleAutoAssignTicket,
  handleGetNextRoundRobin,
  handleUpdateUserAvailability,
} from './assignment.controller'

export const assignmentRoutes = new Hono()

assignmentRoutes.use('*', authMiddleware)

assignmentRoutes.post('/round-robin', handleAutoAssignTicket)
assignmentRoutes.get('/round-robin/next', handleGetNextRoundRobin)
assignmentRoutes.patch('/users/:id/availability', handleUpdateUserAvailability)

export default assignmentRoutes
