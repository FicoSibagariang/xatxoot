import type { MiddlewareHandler } from 'hono'
import pino from 'pino'
import { metricsRegistry } from '../modules/metrics/metrics.service'

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  timestamp: pino.stdTimeFunctions.isoTime,
})

export const requestIdMiddleware: MiddlewareHandler = async (c, next) => {
  const start = performance.now()
  const incomingId = c.req.header('x-request-id')
  const requestId =
    incomingId && incomingId.trim().length > 0 ? incomingId.trim() : crypto.randomUUID()

  // Set to context
  c.set('requestId', requestId)

  const reqLogger = logger.child({
    requestId,
    method: c.req.method,
    path: c.req.path,
  })
  c.set('logger', reqLogger)

  await next()

  const durationMs = performance.now() - start
  const durationSec = durationMs / 1000

  // Set response header
  c.res.headers.set('x-request-id', requestId)

  // Record metrics
  metricsRegistry.recordHttpRequest(c.req.method, c.req.path, c.res.status, durationSec)

  if (process.env.NODE_ENV !== 'test') {
    reqLogger.info(
      {
        status: c.res.status,
        durationMs: Math.round(durationMs * 100) / 100,
      },
      `${c.req.method} ${c.req.path} ${c.res.status}`,
    )
  }
}
