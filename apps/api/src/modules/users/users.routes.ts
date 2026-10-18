import { Hono } from 'hono'
import { authMiddleware } from '../auth/auth.middleware'
import {
  handleCreateUser,
  handleDeleteUser,
  handleGetUser,
  handleListUsers,
  handleUpdateUser,
} from './users.controller'

export const userRoutes = new Hono()

// Apply authentication middleware to all users endpoints
userRoutes.use('*', authMiddleware)

userRoutes.get('/', handleListUsers)
userRoutes.post('/', handleCreateUser)
userRoutes.get('/:id', handleGetUser)
userRoutes.patch('/:id', handleUpdateUser)
userRoutes.delete('/:id', handleDeleteUser)

export default userRoutes
