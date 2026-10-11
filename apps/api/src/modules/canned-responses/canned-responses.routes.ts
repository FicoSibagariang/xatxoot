import { Hono } from 'hono'
import { authMiddleware } from '../auth/auth.middleware'
import {
  handleCreateCannedResponse,
  handleDeleteCannedResponse,
  handleGetCannedResponse,
  handleListCannedResponses,
  handleUpdateCannedResponse,
} from './canned-responses.controller'

export const cannedResponseRoutes = new Hono()

// Apply authentication middleware to all canned-responses endpoints
cannedResponseRoutes.use('*', authMiddleware)

cannedResponseRoutes.get('/', handleListCannedResponses)
cannedResponseRoutes.post('/', handleCreateCannedResponse)
cannedResponseRoutes.get('/:id', handleGetCannedResponse)
cannedResponseRoutes.patch('/:id', handleUpdateCannedResponse)
cannedResponseRoutes.delete('/:id', handleDeleteCannedResponse)

export default cannedResponseRoutes
