import { Hono } from 'hono'
import { authMiddleware } from '../auth/auth.middleware'
import {
  handleCreateSlashCommand,
  handleDeleteSlashCommand,
  handleExecuteSlashCommand,
  handleGetSlashCommand,
  handleListSlashCommands,
  handleUpdateSlashCommand,
} from './slash-commands.controller'

export const slashCommandRoutes = new Hono()

// Apply authentication middleware to all slash-commands endpoints
slashCommandRoutes.use('*', authMiddleware)

slashCommandRoutes.get('/', handleListSlashCommands)
slashCommandRoutes.post('/', handleCreateSlashCommand)
slashCommandRoutes.post('/execute', handleExecuteSlashCommand)
slashCommandRoutes.get('/:id', handleGetSlashCommand)
slashCommandRoutes.patch('/:id', handleUpdateSlashCommand)
slashCommandRoutes.delete('/:id', handleDeleteSlashCommand)

export default slashCommandRoutes
