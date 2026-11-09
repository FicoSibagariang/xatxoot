import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sql } from './index'

describe('Reusable SQL Fragments and Type-Safe Query Mappers (Issue #311 - TDD RED)', () => {
  it('should export standard column fragments from db/fragments.ts', async () => {
    const fragments = await import('./fragments')
    expect(fragments.CONTACT_COLUMNS).toBeDefined()
    expect(fragments.CONVERSATION_COLUMNS).toBeDefined()
    expect(fragments.TICKET_COLUMNS).toBeDefined()
    expect(fragments.MESSAGE_COLUMNS).toBeDefined()
    expect(typeof fragments.contactColumns).toBe('function')
    expect(typeof fragments.conversationColumns).toBe('function')
    expect(typeof fragments.ticketColumns).toBe('function')
    expect(typeof fragments.messageColumns).toBe('function')
  })

  it('fragments must strictly NOT contain account_id or accountId (Single Organization Rule)', async () => {
    const fragmentsPath = join(import.meta.dir, 'fragments.ts')
    const content = readFileSync(fragmentsPath, 'utf-8')
    expect(content.toLowerCase()).not.toContain('account_id')
    expect(content).not.toContain('accountId')
  })

  it('fragments should execute successfully in native Bun SQL queries', async () => {
    const { CONTACT_COLUMNS, CONVERSATION_COLUMNS, TICKET_COLUMNS, MESSAGE_COLUMNS } = await import(
      './fragments'
    )

    const contactRes = await sql`SELECT ${CONTACT_COLUMNS} FROM contacts LIMIT 1`
    expect(contactRes).toBeDefined()

    const convRes = await sql`SELECT ${CONVERSATION_COLUMNS} FROM conversations LIMIT 1`
    expect(convRes).toBeDefined()

    const ticketRes = await sql`SELECT ${TICKET_COLUMNS} FROM tickets LIMIT 1`
    expect(ticketRes).toBeDefined()

    const msgRes = await sql`SELECT ${MESSAGE_COLUMNS} FROM messages LIMIT 1`
    expect(msgRes).toBeDefined()
  })

  it('mappers should validate and convert raw database rows into camelCase domain models conforming to Zod schema', async () => {
    const { mapRowToContact, mapRowToConversation, mapRowToTicket, mapRowToMessage } = await import(
      './fragments'
    )

    // 1. Contact mapper
    const rawContact = {
      id: crypto.randomUUID(),
      company_id: null,
      name: 'John Doe',
      phone_number: '+628123456789',
      email: 'john@example.com',
      avatar_url: null,
      identifier: '628123456789',
      contact_type: 'customer',
      custom_attributes: JSON.stringify({ tier: 'vip' }),
      additional_attributes: '{}',
      blocked: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const contact = mapRowToContact(rawContact)
    expect(contact.id).toBe(rawContact.id)
    expect(contact.name).toBe('John Doe')
    expect(contact.phoneNumber).toBe('+628123456789')
    expect(contact.contactType).toBe('customer')
    expect(contact.customAttributes).toEqual({ tier: 'vip' })

    // 2. Conversation mapper
    const rawConv = {
      id: crypto.randomUUID(),
      inbox_id: crypto.randomUUID(),
      contact_id: rawContact.id,
      contact_inbox_id: crypto.randomUUID(),
      active_ticket_id: null,
      unread_count: 3,
      last_message_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const conv = mapRowToConversation(rawConv)
    expect(conv.id).toBe(rawConv.id)
    expect(conv.inboxId).toBe(rawConv.inbox_id)
    expect(conv.unreadCount).toBe(3)

    // 3. Ticket mapper
    const rawTicket = {
      id: crypto.randomUUID(),
      display_id: 101,
      conversation_id: rawConv.id,
      assignee_id: null,
      team_id: null,
      status: 'open',
      priority: 'high',
      snoozed_until: null,
      waiting_since: null,
      deadline_at: null,
      first_reply_created_at: null,
      opened_at: new Date().toISOString(),
      resolved_at: null,
      internal_note: 'Pelanggan prioritas',
      internal_note_updated_by: null,
      internal_note_updated_at: null,
      custom_attributes: '{}',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const ticket = mapRowToTicket(rawTicket)
    expect(ticket.id).toBe(rawTicket.id)
    expect(ticket.displayId).toBe(101)
    expect(ticket.status).toBe('open')
    expect(ticket.priority).toBe('high')
    expect(ticket.internalNote).toBe('Pelanggan prioritas')

    // 4. Message mapper
    const rawMsg = {
      id: crypto.randomUUID(),
      conversation_id: rawConv.id,
      ticket_id: rawTicket.id,
      sender_type: 'contact',
      sender_id: null,
      message_type: 'incoming',
      content: 'Halo CS',
      content_type: 'text',
      status: 'delivered',
      external_source_id: 'ext_msg_101',
      content_attributes: JSON.stringify({ senderName: 'John Doe' }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const message = mapRowToMessage(rawMsg)
    expect(message.id).toBe(rawMsg.id)
    expect(message.conversationId).toBe(rawConv.id)
    expect(message.content).toBe('Halo CS')
    expect(message.senderType).toBe('contact')
    expect(message.contentAttributes).toEqual({ senderName: 'John Doe' })
    expect(message.senderName).toBe('John Doe')
  })
})
