import { Hono } from 'hono'
import { generatorRoutes } from './modules/generator/generator.routes'
import { graphMessagesRoutes } from './modules/messages/graph-messages.routes'
import { verifyWebhookChallenge } from './modules/webhook/webhook-verifier'

const app = new Hono()

const DEFAULT_VERIFY_TOKEN = 'xatxoot_verify_token'

app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

app.get('/webhook', (c) => {
  const query = c.req.query()
  const expectedToken =
    process.env.WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN &&
    !process.env.WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN.startsWith('replace_with_')
      ? process.env.WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN
      : DEFAULT_VERIFY_TOKEN

  const result = verifyWebhookChallenge(query, expectedToken)

  if (!result.success) {
    return c.text(result.error ?? 'Verification failed', (result.status ?? 400) as 400 | 403)
  }

  return c.text(result.challenge ?? '')
})

app.route('/', graphMessagesRoutes)
app.route('/', generatorRoutes)

const simPort = Number(process.env.PORT_SIMULATOR || process.env.PORT_WA_SIMULATOR || 3002)
const simHost = process.env.HOST || '0.0.0.0'
;(app as unknown as { port: number; hostname: string }).port = simPort
;(app as unknown as { port: number; hostname: string }).hostname = simHost

export default app
