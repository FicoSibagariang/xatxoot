import { beforeEach, describe, expect, it } from 'bun:test'
import app from './index'
import { healthService } from './modules/health/health.service'
import { metricsRegistry } from './modules/metrics/metrics.service'

describe('Deep Health Probes, Correlation ID, and Prometheus Metrics (Issue #320 - TDD RED)', () => {
  beforeEach(() => {
    metricsRegistry.reset()
  })

  describe('1. Liveness & Readiness Probes (/livez, /readyz)', () => {
    it('GET /livez should return 200 OK with server uptime and status', async () => {
      const res = await app.request('/livez')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.status).toBe('ok')
      expect(typeof data.uptime).toBe('number')
      expect(data.uptime).toBeGreaterThanOrEqual(0)
      expect(data.timestamp).toBeDefined()
    })

    it('GET /readyz should return 200 when database and redis are healthy', async () => {
      const res = await app.request('/readyz')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.status).toBe('ready')
      expect(data.checks).toBeDefined()
      expect(data.checks.database.status).toBe('ok')
      expect(data.checks.redis.status).toBe('ok')
    })

    it('GET /readyz should return 503 Service Unavailable when database check fails', async () => {
      // Mock database check failure
      const originalCheckDb = healthService.checkDatabase
      healthService.checkDatabase = async () => ({
        status: 'error',
        error: 'Database connection timeout',
      })

      try {
        const res = await app.request('/readyz')
        expect(res.status).toBe(503)

        const data = await res.json()
        expect(data.status).toBe('unhealthy')
        expect(data.checks.database.status).toBe('error')
        expect(data.checks.database.error).toBe('Database connection timeout')
      } finally {
        healthService.checkDatabase = originalCheckDb
      }
    })

    it('GET /readyz should return 503 Service Unavailable when redis check fails', async () => {
      // Mock redis check failure
      const originalCheckRedis = healthService.checkRedis
      healthService.checkRedis = async () => ({
        status: 'error',
        error: 'Redis connection refused (ECONNREFUSED)',
      })

      try {
        const res = await app.request('/readyz')
        expect(res.status).toBe(503)

        const data = await res.json()
        expect(data.status).toBe('unhealthy')
        expect(data.checks.redis.status).toBe('error')
        expect(data.checks.redis.error).toBe('Redis connection refused (ECONNREFUSED)')
      } finally {
        healthService.checkRedis = originalCheckRedis
      }
    })
  })

  describe('2. Correlation ID Middleware (x-request-id)', () => {
    it('should inject a unique x-request-id header on all HTTP responses if not provided', async () => {
      const res = await app.request('/livez')
      expect(res.status).toBe(200)

      const requestId = res.headers.get('x-request-id')
      expect(requestId).toBeDefined()
      expect(typeof requestId).toBe('string')
      expect(requestId?.length).toBeGreaterThan(10)
    })

    it('should preserve existing incoming x-request-id header from client', async () => {
      const incomingId = 'req-trace-test-custom-uuid-12345'
      const res = await app.request('/livez', {
        headers: {
          'x-request-id': incomingId,
        },
      })

      expect(res.status).toBe(200)
      expect(res.headers.get('x-request-id')).toBe(incomingId)
    })
  })

  describe('3. Prometheus Metrics Endpoint (/metrics)', () => {
    it('should expose metrics in Prometheus text format on GET /metrics', async () => {
      // Send sample requests to populate metrics
      await app.request('/livez')
      await app.request('/non-existent-probe-test-404')

      const res = await app.request('/metrics')
      expect(res.status).toBe(200)
      const contentType = res.headers.get('content-type') || ''
      expect(contentType).toContain('text/plain')

      const text = await res.text()
      // Standard Prometheus metric assertions
      expect(text).toContain('# TYPE http_requests_total counter')
      expect(text).toContain('http_requests_total')
      expect(text).toContain('# TYPE http_request_duration_seconds histogram')
      expect(text).toContain('http_request_duration_seconds')
      expect(text).toContain('# TYPE sse_active_connections gauge')
      expect(text).toContain('sse_active_connections')
      expect(text).toContain('# TYPE db_query_duration_seconds gauge')
      expect(text).toContain('db_query_duration_seconds{quantile="0.95"}')
      expect(text).toContain('db_query_duration_seconds{quantile="0.99"}')
    })
  })
})
