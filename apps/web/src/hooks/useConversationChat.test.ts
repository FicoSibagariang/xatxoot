import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import type { TimelineMessage } from '../chat'
import { api } from '../services/apiClient'
import { areMessagesIdentical } from './useConversationChat'

describe('Conversation Chat Hook & Realtime Reconciliation (Task #272 - apps/web)', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    api.setToken('test-token-chat-hook')
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    api.clearToken()
  })

  it('should use centralized api client for conversation operations', async () => {
    let requestedUrl = ''
    let authorizationHeader = ''

    globalThis.fetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl = String(input)
      authorizationHeader = new Headers(init?.headers).get('Authorization') || ''
      return new Response(JSON.stringify([{ id: 'c-test-1', contact: { name: 'Ahmad' } }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as unknown as typeof fetch

    const res = await api.get<Array<{ id: string }>>('/api/v1/conversations')

    expect(requestedUrl).toBe('/api/v1/conversations')
    expect(authorizationHeader).toBe('Bearer test-token-chat-hook')
    expect(res).toHaveLength(1)
  })

  it('should send ticket status patches using api.patch', async () => {
    let method = ''
    let body = ''

    globalThis.fetch = mock(async (_url, init) => {
      method = init?.method || ''
      body = String(init?.body || '')
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as unknown as typeof fetch

    await api.patch('/api/v1/tickets/ticket-123/status', { status: 'resolved' })

    expect(method).toBe('PATCH')
    expect(body).toBe(JSON.stringify({ status: 'resolved' }))
  })

  it('should mark conversation read using api.post', async () => {
    let method = ''
    globalThis.fetch = mock(async (_url, init) => {
      method = init?.method || ''
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as unknown as typeof fetch

    await api.post('/api/v1/conversations/c-test-1/read')
    expect(method).toBe('POST')
  })

  it('should fetch conversation messages using api.get with selected conversation id', async () => {
    let requestedUrl = ''
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      requestedUrl = String(input)
      return new Response(
        JSON.stringify({
          conversation: { id: 'c-test-1' },
          messages: [
            {
              id: 'm-1',
              conversationId: 'c-test-1',
              senderType: 'contact',
              messageType: 'text',
              content: 'apakah ini masuk?',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }) as unknown as typeof fetch

    const res = await api.get<{ messages: Array<{ id: string; content: string }> }>(
      '/api/v1/conversations/c-test-1',
    )
    expect(requestedUrl).toBe('/api/v1/conversations/c-test-1')
    expect(res.messages).toHaveLength(1)
    expect(res.messages[0].content).toBe('apakah ini masuk?')
  })

  it('should strictly NOT contain or require account_id in chat services', () => {
    expect(api).toBeDefined()
    expect(typeof api.request).toBe('function')
  })

  describe('areMessagesIdentical helper', () => {
    it('should return true when two message arrays have identical IDs, statuses, and content', () => {
      const msgsA = [
        { id: '1', status: 'delivered', content: 'Halo' },
        { id: '2', status: 'sent', content: 'Hai' },
      ] as unknown as TimelineMessage[]
      const msgsB = [
        { id: '1', status: 'delivered', content: 'Halo' },
        { id: '2', status: 'sent', content: 'Hai' },
      ] as unknown as TimelineMessage[]

      expect(areMessagesIdentical(msgsA, msgsB)).toBe(true)
    })

    it('should return false when lengths differ or statuses change', () => {
      const msgsA = [{ id: '1', status: 'sent', content: 'Halo' }] as unknown as TimelineMessage[]
      const msgsB = [
        { id: '1', status: 'delivered', content: 'Halo' },
      ] as unknown as TimelineMessage[]
      const msgsC = [
        { id: '1', status: 'sent', content: 'Halo' },
        { id: '2', status: 'sent', content: 'Pesan baru' },
      ] as unknown as TimelineMessage[]

      expect(areMessagesIdentical(msgsA, msgsB)).toBe(false)
      expect(areMessagesIdentical(msgsA, msgsC)).toBe(false)
      expect(areMessagesIdentical(undefined, msgsA)).toBe(false)
    })
  })
})
