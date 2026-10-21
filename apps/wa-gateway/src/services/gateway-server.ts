import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http'
import type { BaileysConnectionManager } from './baileys-connection-manager'

import type { SendWaMessageJobPayload } from '../types/queue'
import type { OutboundMessageDispatcher } from './outbound-dispatcher'
import { OutboundMessageDispatcher as DefaultDispatcher } from './outbound-dispatcher'
import type { RedisEventPublisher } from './redis-publisher'

export interface GatewayServerOptions {
  redisPublisher?: RedisEventPublisher
  dispatcher?: OutboundMessageDispatcher
}

function parseJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      if (!body.trim()) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(body))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', (err) => reject(err))
  })
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  })
  res.end(JSON.stringify(data))
}

export function createGatewayServer(
  manager: BaileysConnectionManager,
  options?: GatewayServerOptions,
): Server {
  const dispatcher =
    options?.dispatcher ||
    new DefaultDispatcher({
      connectionManager: manager,
      redisPublisher: options?.redisPublisher,
    })

  return createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const pathname = url.pathname
    const method = req.method?.toUpperCase() || 'GET'

    // CORS preflight
    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      })
      res.end()
      return
    }

    // Health check
    if ((pathname === '/health' || pathname === '/healthz') && method === 'GET') {
      sendJson(res, 200, {
        status: 'ok',
        activeSessions: manager.getAllSessions().length,
        uptime: process.uptime(),
      })
      return
    }

    // Send outbound WhatsApp message
    if (pathname === '/api/messages/send' && method === 'POST') {
      try {
        const body = (await parseJsonBody(req)) as unknown as SendWaMessageJobPayload
        const result = await dispatcher.sendMessage(body)
        sendJson(res, 200, result)
      } catch (err) {
        console.error('[wa-gateway] Error in /api/messages/send:', err)
        sendJson(res, 500, { error: (err as Error).message })
      }
      return
    }

    // Start / ensure session
    if (pathname === '/api/sessions/start' && method === 'POST') {
      try {
        const body = await parseJsonBody(req)
        const sessionId = String(body.sessionId || '')
        if (!sessionId) {
          sendJson(res, 400, { error: 'sessionId is required' })
          return
        }

        const channelId = body.channelId ? String(body.channelId) : undefined
        const inboxId = body.inboxId ? String(body.inboxId) : undefined
        const autoStartSocket = body.autoStartSocket !== false

        let session = manager.getSession(sessionId)
        if (!session) {
          session = await manager.createSession({
            sessionId,
            channelId,
            inboxId,
          })
        }

        if (autoStartSocket && session.status !== 'connected' && session.status !== 'pairing') {
          session.startSocket().catch((err) => {
            console.error(`[wa-gateway] Failed to start socket for session ${sessionId}:`, err)
          })
        }

        sendJson(res, 200, {
          success: true,
          sessionId: session.sessionId,
          status: session.status,
          qrCode: session.currentQr,
          phoneNumber: session.phoneNumber,
        })
      } catch (err) {
        sendJson(res, 500, { error: (err as Error).message })
      }
      return
    }

    // Match /api/sessions/:sessionId/status
    const statusMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/status$/)
    if (statusMatch && method === 'GET') {
      const sessionId = statusMatch[1]
      const session = manager.getSession(sessionId)

      if (!session) {
        sendJson(res, 200, {
          sessionId,
          status: 'disconnected',
          qrCode: null,
          phoneNumber: null,
        })
        return
      }

      sendJson(res, 200, {
        sessionId: session.sessionId,
        status: session.status,
        qrCode: session.currentQr,
        phoneNumber: session.phoneNumber,
      })
      return
    }

    // Match /api/sessions/:sessionId/disconnect
    const disconnectMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/disconnect$/)
    if (disconnectMatch && method === 'POST') {
      const sessionId = disconnectMatch[1]
      await manager.disconnectSession(sessionId)

      sendJson(res, 200, {
        success: true,
        sessionId,
        status: 'disconnected',
      })
      return
    }

    // Match /api/sessions/:sessionId/groups/:groupJid
    const groupMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/groups\/([^/]+)$/)
    if (groupMatch && method === 'GET') {
      const sessionId = groupMatch[1]
      const groupJid = decodeURIComponent(groupMatch[2])
      const session = manager.getSession(sessionId)

      if (!session) {
        sendJson(res, 404, { error: 'Session not found' })
        return
      }

      const subject = await session.getGroupSubject(groupJid)
      sendJson(res, 200, {
        sessionId,
        groupJid,
        subject: subject || null,
      })
      return
    }

    // 404 Not Found
    sendJson(res, 404, { error: 'Not Found' })
  })
}
