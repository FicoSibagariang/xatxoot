import { Hono } from 'hono'
import { authMiddleware } from '../auth/auth.middleware'
import {
  handleAddMember,
  handleCreateTeam,
  handleDeleteTeam,
  handleGetTeam,
  handleListMembers,
  handleListTeams,
  handleRemoveMember,
  handleUpdateTeam,
} from './teams.controller'

export const teamRoutes = new Hono()

// Apply authentication middleware to all teams endpoints
teamRoutes.use('*', authMiddleware)

// 1. Teams CRUD
teamRoutes.get('/', handleListTeams)
teamRoutes.post('/', handleCreateTeam)
teamRoutes.get('/:id', handleGetTeam)
teamRoutes.patch('/:id', handleUpdateTeam)
teamRoutes.delete('/:id', handleDeleteTeam)

// 2. Team Members Management
teamRoutes.get('/:id/members', handleListMembers)
teamRoutes.post('/:id/members', handleAddMember)
teamRoutes.delete('/:id/members/:userId', handleRemoveMember)

export default teamRoutes
