import { Hono } from 'hono'
import { reportRoutes } from './modules/analytics/analytics.routes'
import { assignmentRoutes } from './modules/assignment/assignment.routes'
import { authRoutes } from './modules/auth/auth.routes'
import { botFlowRoutes, botSessionRoutes } from './modules/bots/bots.routes'
import {
  businessHoursRoutes,
  inboxBusinessHoursRoutes,
} from './modules/business-hours/business-hours.routes'
import { cannedResponseRoutes } from './modules/canned-responses/canned-responses.routes'
import { conversationRoutes } from './modules/conversations/conversations.routes'
import { csatRoutes } from './modules/csat/csat.routes'
import { emailRoutes } from './modules/email/email.routes'
import {
  articleRoutes,
  categoryRoutes,
  portalRoutes,
  publicPortalRoutes,
} from './modules/help-center/help-center.routes'
import { inboxRoutes } from './modules/inboxes/inboxes.routes'
import { metaSocialRoutes } from './modules/meta-social/meta-social.routes'
import { realtimeRoutes } from './modules/realtime/realtime.routes'
import { slashCommandRoutes } from './modules/slash-commands/slash-commands.routes'
import { smsRoutes } from './modules/sms/sms.routes'
import { teamRoutes } from './modules/teams/teams.routes'
import { telegramRoutes } from './modules/telegram/telegram.routes'
import { ticketRoutes } from './modules/tickets/tickets.routes'
import { whatsappCloudWebhookRoutes } from './modules/webhooks/whatsapp-cloud.webhook.routes'
import { whatsappTemplateRoutes } from './modules/whatsapp-templates/whatsapp-templates.routes'
import { widgetRoutes } from './modules/widget/widget.routes'

const app = new Hono()

app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

app.route('/api/v1/auth', authRoutes)
app.route('/api/v1/inboxes', inboxBusinessHoursRoutes)
app.route('/api/v1/inboxes', inboxRoutes)
app.route('/api/v1/conversations', conversationRoutes)
app.route('/api/v1/tickets', ticketRoutes)
app.route('/api/v1/teams', teamRoutes)
app.route('/api/v1/canned-responses', cannedResponseRoutes)
app.route('/api/v1/slash-commands', slashCommandRoutes)
app.route('/api/v1/assignment', assignmentRoutes)
app.route('/api/v1/bot-flows', botFlowRoutes)
app.route('/api/v1/bot-sessions', botSessionRoutes)
app.route('/api/v1/whatsapp-templates', whatsappTemplateRoutes)
app.route('/api/v1/realtime', realtimeRoutes)
app.route('/api/v1/webhooks/whatsapp-cloud', whatsappCloudWebhookRoutes)
app.route('/api/v1/widget', widgetRoutes)
app.route('/api/v1/email', emailRoutes)
app.route('/api/v1/telegram', telegramRoutes)
app.route('/api/v1/meta-social', metaSocialRoutes)
app.route('/api/v1/sms', smsRoutes)
app.route('/api/v1/business-hours', businessHoursRoutes)
app.route('/api/v1/csat', csatRoutes)
app.route('/api/v1/reports', reportRoutes)
app.route('/portal', publicPortalRoutes)
app.route('/api/v1/portals', portalRoutes)
app.route('/api/v1/categories', categoryRoutes)
app.route('/api/v1/articles', articleRoutes)

export default app
