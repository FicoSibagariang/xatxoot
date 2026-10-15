export { DisconnectReason } from '@whiskeysockets/baileys'
export {
  BaileysConnectionManager,
  baileysConnectionManager,
  type CreateSessionParams,
} from './services/baileys-connection-manager'
export { BaileysSession, type SessionInitParams } from './services/baileys-session'
export { mapDisconnectReasonToStatus } from './services/disconnect-handler'
export {
  RedisEventPublisher,
  type RedisPublisherClient,
  type RedisPublisherOptions,
} from './services/redis-publisher'
export { createSocketConfig, DEFAULT_BROWSER } from './services/socket-config'
export type {
  ConnectionEventHandlers,
  GatewayConnectionStatus,
  SocketConfigOptions,
} from './types/connection'
export {
  createOutboundWorker,
  type CreateWorkerOptions,
  type OutboundJob,
  processOutboundJob,
} from './services/bullmq-worker'
export { extractInboundMessage } from './services/message-parser'
export {
  type DispatchResult,
  type OutboundDispatcherOptions,
  OutboundMessageDispatcher,
} from './services/outbound-dispatcher'
export {
  REDIS_CHANNEL_WA_INBOUND_MESSAGE,
  REDIS_CHANNEL_WA_MESSAGE_STATUS,
  REDIS_CHANNEL_WA_SESSION_QR,
  type WaInboundMessageEvent,
  WaInboundMessageEventSchema,
  type WaInboundMessageType,
  WaInboundMessageTypeSchema,
  type WaMessageStatusEvent,
  WaMessageStatusEventSchema,
  type WaSessionQrEvent,
  WaSessionQrEventSchema,
} from './types/events'
export {
  BULLMQ_QUEUE_WA_OUTBOUND,
  JOB_NAME_SEND_MESSAGE,
  JOB_NAME_SEND_REACTION,
  type SendWaMessageJobPayload,
  SendWaMessageJobPayloadSchema,
  type SendWaReactionJobPayload,
  SendWaReactionJobPayloadSchema,
} from './types/queue'
export {
  createGatewayServer,
  type GatewayServerOptions,
} from './services/gateway-server'

// Global error handlers to prevent daemon crash on socket timeouts
process.on('uncaughtException', (err) => {
  console.error('[wa-gateway] Uncaught exception:', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[wa-gateway] Unhandled rejection:', reason)
})

// Start HTTP gateway daemon when executed as entrypoint
const isDirectRun =
  process.argv[1]?.endsWith('src/index.ts') || process.argv[1]?.endsWith('dist/index.js')
if (isDirectRun) {
  const { existsSync, readdirSync } = await import('node:fs')
  const { join } = await import('node:path')
  const port = Number(process.env.PORT_GATEWAY || 8801)
  const host = process.env.HOST || '0.0.0.0'
  const { baileysConnectionManager } = await import('./services/baileys-connection-manager')
  const { createGatewayServer } = await import('./services/gateway-server')
  const { OutboundMessageDispatcher } = await import('./services/outbound-dispatcher')
  const { createOutboundWorker } = await import('./services/bullmq-worker')

  const outboundDispatcher = new OutboundMessageDispatcher({
    connectionManager: baileysConnectionManager,
  })

  // Start BullMQ outbound worker in background
  try {
    createOutboundWorker({
      dispatcher: outboundDispatcher,
    })
    console.log('[wa-gateway] Outbound BullMQ worker initialized')
  } catch (err) {
    console.warn('[wa-gateway] Could not start BullMQ worker:', err)
  }

  const server = createGatewayServer(baileysConnectionManager, { dispatcher: outboundDispatcher })
  server.listen(port, host, async () => {
    console.log(`[wa-gateway] WhatsApp Gateway server running at http://${host}:${port}`)

    // Auto-resume existing authenticated sessions
    const sessionsDir = './data/sessions'
    if (existsSync(sessionsDir)) {
      try {
        const entries = readdirSync(sessionsDir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const credsPath = join(sessionsDir, entry.name, 'creds.json')
            if (existsSync(credsPath)) {
              const sessionId = entry.name
              console.log(`[wa-gateway] Resuming authenticated session: ${sessionId}`)
              const session = await baileysConnectionManager.createSession({ sessionId })
              session.startSocket().catch((err) => {
                console.error(`[wa-gateway] Failed to auto-resume session ${sessionId}:`, err)
              })
            }
          }
        }
      } catch (err) {
        console.error('[wa-gateway] Failed to scan sessions dir:', err)
      }
    }
  })
}
