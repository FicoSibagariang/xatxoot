import { Hono } from 'hono'
import { authMiddleware } from '../auth/auth.middleware'
import {
  handleGetTemplate,
  handleListTemplates,
  handleSendTemplateMessage,
  handleSyncTemplates,
} from './whatsapp-templates.controller'

export const whatsappTemplateRoutes = new Hono()

whatsappTemplateRoutes.use('*', authMiddleware)

whatsappTemplateRoutes.get('/', handleListTemplates)
whatsappTemplateRoutes.get('/:id', handleGetTemplate)
whatsappTemplateRoutes.post('/sync', handleSyncTemplates)
whatsappTemplateRoutes.post('/send', handleSendTemplateMessage)

export default whatsappTemplateRoutes
