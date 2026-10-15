import { Hono } from 'hono'
import { handleWhatsAppUnofficialInbound } from './whatsapp-unofficial.webhook.controller'

export const whatsappUnofficialWebhookRoutes = new Hono()

whatsappUnofficialWebhookRoutes.post('/inbound', handleWhatsAppUnofficialInbound)

export default whatsappUnofficialWebhookRoutes
