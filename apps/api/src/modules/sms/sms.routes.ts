import { Hono } from 'hono'
import { smsController } from './sms.controller'

export const smsRoutes = new Hono()

smsRoutes.post('/webhook', smsController.handleWebhook)
smsRoutes.post('/outbound', smsController.handleOutbound)
