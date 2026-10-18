import { Hono } from 'hono'
import { authMiddleware } from '../auth/auth.middleware'
import {
  handleCreateContact,
  handleGetContact,
  handleListContacts,
  handleUpdateContact,
} from './contacts.controller'

export const contactRoutes = new Hono()

// Apply authentication guard
contactRoutes.use('*', authMiddleware)

contactRoutes.get('/', handleListContacts)
contactRoutes.post('/', handleCreateContact)
contactRoutes.get('/:id', handleGetContact)
contactRoutes.patch('/:id', handleUpdateContact)

export default contactRoutes
