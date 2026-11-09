export { DisconnectReason } from '@whiskeysockets/baileys'
export {
  type AuthAdapterOptions,
  type EncryptedAuthStorage,
  type EncryptedAuthStateResult,
  InMemorySessionStorage,
  RedisSessionStorage,
  type SessionMetadata,
  decryptData,
  deleteEncryptedSession,
  encryptData,
  listEncryptedSessions,
  useEncryptedAuthState,
} from './services/baileys-encrypted-auth-adapter'
export {
  deriveKey,
  getDefaultEncryptionKey,
} from './services/session-crypto'
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
  BULLMQ_QUEUE_WA_OUTBOUND_DLQ,
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
export {
  RawMessageDumper,
  rawMessageDumper,
  type RawMessageDumperOptions,
} from './services/raw-message-dumper'

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
  const { existsSync, readdirSync, readFileSync } = await import('node:fs')
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

    // Purge expired raw message dumps
    const { rawMessageDumper } = await import('./services/raw-message-dumper')
    rawMessageDumper
      .purgeExpiredDumps()
      .then((purged) => {
        if (purged > 0) {
          console.log(`[wa-gateway] Purged ${purged} expired raw dump file(s)`)
        }
      })
      .catch((err) => {
        console.warn('[wa-gateway] Failed to purge expired raw dumps:', err)
      })

    // Auto-resume existing authenticated sessions from encrypted session store
    try {
      const { listEncryptedSessions } = await import('./services/baileys-encrypted-auth-adapter')
      const activeSessions = await listEncryptedSessions()
      for (const meta of activeSessions) {
        console.log(
          `[wa-gateway] Resuming authenticated session from encrypted store: ${meta.sessionId} (channel: ${meta.channelId || 'unknown'})`,
        )
        const session = await baileysConnectionManager.createSession({
          sessionId: meta.sessionId,
          channelId: meta.channelId,
          inboxId: meta.inboxId,
        })
        session.startSocket().catch((err) => {
          console.error(`[wa-gateway] Failed to auto-resume session ${meta.sessionId}:`, err)
        })
      }
    } catch (err) {
      console.warn('[wa-gateway] Failed to load sessions from encrypted store:', err)
    }
  })
}
