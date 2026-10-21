import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { api } from '../services/apiClient'

describe('useConversationChat - Ticket Note Persistence (Issue #296 - TDD RED)', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    api.setToken('test-token-note-save')
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    api.clearToken()
  })

  it('should send PATCH /api/v1/tickets/:id/note with internalNote payload', async () => {
    let method = ''
    let requestedUrl = ''
    let body = ''

    globalThis.fetch = mock(async (url, init) => {
      requestedUrl = String(url)
      method = init?.method || ''
      body = String(init?.body || '')
      return new Response(
        JSON.stringify({
          ticket: {
            id: 't-999',
            internalNote: 'Catatan operasional baru',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }) as unknown as typeof fetch

    const res = await api.patch<{ ticket: { id: string; internalNote: string } }>(
      '/api/v1/tickets/t-999/note',
      { internalNote: 'Catatan operasional baru' },
    )

    expect(requestedUrl).toBe('/api/v1/tickets/t-999/note')
    expect(method).toBe('PATCH')
    expect(body).toBe(JSON.stringify({ internalNote: 'Catatan operasional baru' }))
    expect(res.ticket.internalNote).toBe('Catatan operasional baru')
  })
})
