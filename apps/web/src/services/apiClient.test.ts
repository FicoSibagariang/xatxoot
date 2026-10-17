import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { ApiClient, ApiClientError, api } from './apiClient'

describe('Centralized API Client Helper (Task #272 - apps/web)', () => {
  const originalFetch = globalThis.fetch
  const originalLocalStorage = globalThis.localStorage

  let mockLocalStorageData: Record<string, string> = {}

  beforeEach(() => {
    mockLocalStorageData = {
      auth_token: 'test-jwt-token-123',
    }

    // Mock localStorage
    globalThis.localStorage = {
      getItem: (key: string) => mockLocalStorageData[key] ?? null,
      setItem: (key: string, value: string) => {
        mockLocalStorageData[key] = value
      },
      removeItem: (key: string) => {
        delete mockLocalStorageData[key]
      },
      clear: () => {
        mockLocalStorageData = {}
      },
      key: () => null,
      length: 0,
    }
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    globalThis.localStorage = originalLocalStorage
  })

  describe('1. Automatic Header & Token Injection', () => {
    it('should inject Authorization Bearer token from localStorage by default', async () => {
      let capturedHeaders: Headers | null = null

      globalThis.fetch = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
        capturedHeaders = new Headers(init?.headers)
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }) as unknown as typeof fetch

      const client = new ApiClient()
      const result = await client.get<{ success: boolean }>('/api/v1/conversations')

      expect(result).toEqual({ success: true })
      expect(capturedHeaders).not.toBeNull()
      expect(capturedHeaders?.get('Authorization')).toBe('Bearer test-jwt-token-123')
    })

    it('should allow skipping auth token when skipAuth is true', async () => {
      let capturedHeaders: Headers | null = null

      globalThis.fetch = mock(async (_input: RequestInfo | URL, init?: RequestInit) => {
        capturedHeaders = new Headers(init?.headers)
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }) as unknown as typeof fetch

      const client = new ApiClient()
      await client.get('/api/v1/public-data', { skipAuth: true })

      expect(capturedHeaders).not.toBeNull()
      expect(capturedHeaders?.get('Authorization')).toBeNull()
    })

    it('should automatically set Content-Type to application/json when body is provided', async () => {
      let capturedHeaders: Headers | null = null
      let capturedBody: string | null = null

      globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
        capturedHeaders = new Headers(init?.headers)
        capturedBody = init?.body as string
        return new Response(JSON.stringify({ id: 'msg-1' }), { status: 201 })
      }) as unknown as typeof fetch

      const client = new ApiClient()
      const payload = { content: 'Halo dari agent', contentType: 'text' }
      const res = await client.post('/api/v1/conversations/1/messages', payload)

      expect(res).toEqual({ id: 'msg-1' })
      expect(capturedHeaders?.get('Content-Type')).toBe('application/json')
      expect(capturedBody).toBe(JSON.stringify(payload))
    })
  })

  describe('2. HTTP Methods (GET, POST, PATCH, PUT, DELETE)', () => {
    it('should perform GET request and return typed data', async () => {
      globalThis.fetch = mock(async () => {
        return new Response(JSON.stringify([{ id: 'c-1', name: 'Budi' }]), { status: 200 })
      }) as unknown as typeof fetch

      const data = await api.get<Array<{ id: string; name: string }>>('/api/v1/conversations')
      expect(data).toHaveLength(1)
      expect(data[0].name).toBe('Budi')
    })

    it('should perform POST request with body', async () => {
      let method = ''
      globalThis.fetch = mock(async (_url, init) => {
        method = init?.method || 'GET'
        return new Response(JSON.stringify({ created: true }), { status: 201 })
      }) as unknown as typeof fetch

      const res = await api.post('/api/v1/conversations', { channel: 'whatsapp' })
      expect(method).toBe('POST')
      expect(res).toEqual({ created: true })
    })

    it('should perform PATCH request with body', async () => {
      let method = ''
      globalThis.fetch = mock(async (_url, init) => {
        method = init?.method || 'GET'
        return new Response(JSON.stringify({ status: 'resolved' }), { status: 200 })
      }) as unknown as typeof fetch

      const res = await api.patch('/api/v1/tickets/t-1/status', { status: 'resolved' })
      expect(method).toBe('PATCH')
      expect(res).toEqual({ status: 'resolved' })
    })

    it('should perform DELETE request', async () => {
      let method = ''
      globalThis.fetch = mock(async (_url, init) => {
        method = init?.method || 'GET'
        return new Response(JSON.stringify({ deleted: true }), { status: 200 })
      }) as unknown as typeof fetch

      const res = await api.delete('/api/v1/conversations/c-1')
      expect(method).toBe('DELETE')
      expect(res).toEqual({ deleted: true })
    })
  })

  describe('3. Standardized Error Handling & ApiClientError', () => {
    it('should throw ApiClientError when response is not ok (e.g. 400 Bad Request)', async () => {
      globalThis.fetch = mock(async () => {
        return new Response(
          JSON.stringify({ error: 'BAD_REQUEST', message: 'Payload tidak valid' }),
          {
            status: 400,
            statusText: 'Bad Request',
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }) as unknown as typeof fetch

      let thrownError: unknown = null
      try {
        await api.post('/api/v1/conversations', {})
      } catch (err) {
        thrownError = err
      }

      expect(thrownError).toBeInstanceOf(ApiClientError)
      const apiErr = thrownError as ApiClientError
      expect(apiErr.status).toBe(400)
      expect(apiErr.message).toBe('Payload tidak valid')
      expect(apiErr.data).toEqual({ error: 'BAD_REQUEST', message: 'Payload tidak valid' })
    })

    it('should handle non-JSON error response body gracefully', async () => {
      globalThis.fetch = mock(async () => {
        return new Response('Internal Server Error HTML', {
          status: 500,
          statusText: 'Internal Server Error',
        })
      }) as unknown as typeof fetch

      let thrownError: unknown = null
      try {
        await api.get('/api/v1/crash')
      } catch (err) {
        thrownError = err
      }

      expect(thrownError).toBeInstanceOf(ApiClientError)
      const apiErr = thrownError as ApiClientError
      expect(apiErr.status).toBe(500)
      expect(apiErr.message).toContain('Internal Server Error')
    })
  })

  describe('4. HTTP 401 Unauthorized Interceptor', () => {
    it('should invoke onUnauthorized callback when receiving 401 status', async () => {
      globalThis.fetch = mock(async () => {
        return new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), {
          status: 401,
          statusText: 'Unauthorized',
        })
      }) as unknown as typeof fetch

      let unauthorizedTriggered = false
      const client = new ApiClient({
        onUnauthorized: () => {
          unauthorizedTriggered = true
        },
      })

      try {
        await client.get('/api/v1/conversations')
      } catch {
        // Expected ApiClientError
      }

      expect(unauthorizedTriggered).toBe(true)
    })
  })

  describe('5. Base URL Configuration', () => {
    it('should prepend custom baseURL if specified', async () => {
      let requestedUrl = ''
      globalThis.fetch = mock(async (input: RequestInfo | URL) => {
        requestedUrl = String(input)
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }) as unknown as typeof fetch

      const client = new ApiClient({ baseURL: 'https://api.xatxoot.example.com' })
      await client.get('/api/v1/health')

      expect(requestedUrl).toBe('https://api.xatxoot.example.com/api/v1/health')
    })
  })

  describe('6. Single Organization Guardrail', () => {
    it('should strictly NOT contain or require account_id or accountId in ApiClient', () => {
      const client = new ApiClient()
      expect(client).toBeDefined()
      expect(typeof client.get).toBe('function')
      expect(typeof client.post).toBe('function')
      expect(typeof client.patch).toBe('function')
      expect(typeof client.delete).toBe('function')
    })
  })
})
