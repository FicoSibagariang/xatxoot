import { Hono } from 'hono'
import { telegramController } from './telegram.controller'

export const telegramRoutes = new Hono()

telegramRoutes.post('/webhook/:botToken', telegramController.handleWebhook)
telegramRoutes.post('/outbound', telegramController.handleOutbound)
