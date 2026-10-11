import { Hono } from 'hono'
import { authMiddleware } from '../auth/auth.middleware'
import {
  handleCreateBotFlow,
  handleDeleteBotFlow,
  handleGetBotFlow,
  handleGetBotSession,
  handleListBotFlows,
  handleProcessUserInput,
  handleStartBotSession,
  handleUpdateBotFlow,
} from './bots.controller'

export const botFlowRoutes = new Hono()
botFlowRoutes.use('*', authMiddleware)
botFlowRoutes.post('/', handleCreateBotFlow)
botFlowRoutes.get('/', handleListBotFlows)
botFlowRoutes.get('/:id', handleGetBotFlow)
botFlowRoutes.patch('/:id', handleUpdateBotFlow)
botFlowRoutes.delete('/:id', handleDeleteBotFlow)

export const botSessionRoutes = new Hono()
botSessionRoutes.use('*', authMiddleware)
botSessionRoutes.post('/start', handleStartBotSession)
botSessionRoutes.get('/:id', handleGetBotSession)
botSessionRoutes.post('/:id/message', handleProcessUserInput)
