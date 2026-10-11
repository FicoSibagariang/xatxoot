import { Hono } from 'hono'
import { metaSocialController } from './meta-social.controller'

export const metaSocialRoutes = new Hono()

metaSocialRoutes.get('/webhook', metaSocialController.handleVerifyWebhook)
metaSocialRoutes.post('/webhook', metaSocialController.handleWebhook)
metaSocialRoutes.post('/outbound', metaSocialController.handleOutbound)
