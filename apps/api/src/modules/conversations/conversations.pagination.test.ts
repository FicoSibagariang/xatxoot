import { describe, expect, it } from 'bun:test'
import { Hono } from 'hono'
import { conversationRoutes } from './conversations.routes'
import { conversationService, resetConversationStore } from './conversations.service'

describe('Reverse Cursor-Based Pagination on Conversations (Issue #306 - TDD RED)', () => {
  const inboxId = '11111111-1111-4111-a111-111111111111'
  const sourceId = '628123456789'
  const senderPhone = '+628123456789'

  it('should support reverse cursor pagination with limit and before cursor in getConversationById', async () => {
    await resetConversationStore()

    // 1. Seed 5 messages across sequential timestamps
    const baseTime = Date.now() + 1000
    let convId = ''

    for (let i = 1; i <= 5; i++) {
      const res = await conversationService.handleInboundMessage({
        inboxId,
        sourceId,
        senderPhone,
        senderName: 'Budi Santoso',
        content: `Pesan ke-${i}`,
        externalId: `WAM_PAGINATION_${i}`,
        createdAt: new Date(baseTime + i * 1000).toISOString(),
      })
      convId = res.conversation.id
    }

    // Normalize all messages in the conversation to have sequential timestamps
    const allDetail = await conversationService.getConversationById(convId, { limit: 100 })
    const allMsgs = allDetail?.messages || []
    const totalCount = allMsgs.length

    // 2. Fetch initial batch with limit = 2 (should return latest 2 messages)
    const initialBatch = await conversationService.getConversationById(convId, { limit: 2 })
    expect(initialBatch).not.toBeNull()
    expect(initialBatch?.messages.length).toBe(2)
    expect(initialBatch?.messages[0].id).toBe(allMsgs[totalCount - 2].id)
    expect(initialBatch?.messages[1].id).toBe(allMsgs[totalCount - 1].id)
    expect(initialBatch?.pagination).toBeDefined()
    expect(initialBatch?.pagination?.hasMore).toBe(true)
    expect(initialBatch?.pagination?.limit).toBe(2)
    expect(initialBatch?.pagination?.nextCursor).toBe(initialBatch?.messages[0].id)

    // 3. Fetch second batch before nextCursor with limit = 2
    const secondBatch = await conversationService.getConversationById(convId, {
      limit: 2,
      before: initialBatch?.pagination?.nextCursor,
    })
    expect(secondBatch).not.toBeNull()
    expect(secondBatch?.messages.length).toBe(2)
    expect(secondBatch?.messages[0].id).toBe(allMsgs[totalCount - 4].id)
    expect(secondBatch?.messages[1].id).toBe(allMsgs[totalCount - 3].id)
    expect(secondBatch?.pagination?.hasMore).toBe(totalCount > 4)
    expect(secondBatch?.pagination?.nextCursor).toBe(secondBatch?.messages[0].id)
  })

  it('GET /api/v1/conversations/:id should respect limit and before query parameters', async () => {
    await resetConversationStore()

    const app = new Hono()
    // Bypass auth middleware in test app
    app.route('/api/v1/conversations', conversationRoutes)

    const baseTime = Date.now() + 1000
    let convId = ''

    for (let i = 1; i <= 4; i++) {
      const res = await conversationService.handleInboundMessage({
        inboxId,
        sourceId,
        senderPhone,
        senderName: 'Budi Santoso',
        content: `Konten API ${i}`,
        externalId: `WAM_API_PAGINATION_${i}`,
        createdAt: new Date(baseTime + i * 1000).toISOString(),
      })
      convId = res.conversation.id
    }

    // Call GET /api/v1/conversations/:id?limit=2
    const res = await app.request(`/api/v1/conversations/${convId}?limit=2`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer valid-access-token',
      },
    })

    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      messages: Array<{ content: string }>
      pagination?: { hasMore: boolean; nextCursor?: string; limit: number }
    }
    expect(json.messages.length).toBe(2)
    expect(json.messages[0].content).toBe('Konten API 3')
    expect(json.messages[1].content).toBe('Konten API 4')
    expect(json.pagination).toBeDefined()
    expect(json.pagination?.hasMore).toBe(true)
    expect(json.pagination?.limit).toBe(2)
  })
})
