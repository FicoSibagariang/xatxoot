import { describe, expect, it, mock } from 'bun:test'
import { conversationService } from './conversations.service'

// Mock the db module to return predefined rows without accessing a real PostgreSQL instance
mock.module('../../db', {
  sql: async (strings: TemplateStringsArray, ...values: unknown[]) => {
    // Return rows matching the SELECT in listConversations with inbox metadata
    return [
      {
        id: 'conv-1',
        inboxId: 'inbox-1',
        contactId: null,
        contactInboxId: null,
        activeTicketId: null,
        unreadCount: 0,
        lastMessageAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        inboxName: 'Test Inbox',
        channelType: 'whatsapp',
      },
    ]
  },
})

describe('ConversationService.listConversations includes inbox metadata', () => {
  it('should return inboxName and channel fields in each conversation item', async () => {
    const result = await conversationService.listConversations()
    expect(result.length).toBeGreaterThan(0)
    const conv = result[0]
    expect(conv).toHaveProperty('inboxName')
    expect(conv.inboxName).toBe('Test Inbox')
    expect(conv).toHaveProperty('channel')
    expect(conv.channel).toBe('whatsapp')
  })
})
