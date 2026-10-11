import { Hono } from 'hono'
import { authRoutes } from './modules/auth/auth.routes'
import { cannedResponseRoutes } from './modules/canned-responses/canned-responses.routes'
import { conversationRoutes } from './modules/conversations/conversations.routes'
import { inboxRoutes } from './modules/inboxes/inboxes.routes'
import { realtimeRoutes } from './modules/realtime/realtime.routes'
import { slashCommandRoutes } from './modules/slash-commands/slash-commands.routes'
import { teamRoutes } from './modules/teams/teams.routes'
import { ticketRoutes } from './modules/tickets/tickets.routes'
import { whatsappCloudWebhookRoutes } from './modules/webhooks/whatsapp-cloud.webhook.routes'
import { widgetRoutes } from './modules/widget/widget.routes'

const app = new Hono()

app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

app.route('/api/v1/auth', authRoutes)
app.route('/api/v1/inboxes', inboxRoutes)
app.route('/api/v1/conversations', conversationRoutes)
app.route('/api/v1/tickets', ticketRoutes)
app.route('/api/v1/teams', teamRoutes)
app.route('/api/v1/canned-responses', cannedResponseRoutes)
app.route('/api/v1/slash-commands', slashCommandRoutes)
app.route('/api/v1/realtime', realtimeRoutes)
app.route('/api/v1/webhooks/whatsapp-cloud', whatsappCloudWebhookRoutes)
app.route('/api/v1/widget', widgetRoutes)

export default app
