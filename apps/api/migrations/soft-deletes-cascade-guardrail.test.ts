import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sql } from '../src/db'
import { contactService } from '../src/modules/contacts/contacts.service'
import { conversationService } from '../src/modules/conversations/conversations.service'
import { inboxService } from '../src/modules/inboxes/inboxes.service'

describe('Soft Deletes & Cascade Deletion Mitigation Guardrail (Issue #315)', () => {
  const migrationPath = join(
    import.meta.dir,
    '..',
    'migrations',
    '016_soft_deletes_cascade_guardrail.sql',
  )

  it('should have 016_soft_deletes_cascade_guardrail.sql migration file', () => {
    expect(existsSync(migrationPath)).toBe(true)
    const content = readFileSync(migrationPath, 'utf-8')
    expect(content).toContain('ALTER TABLE inboxes ADD COLUMN IF NOT EXISTS deleted_at')
    expect(content).toContain('ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_at')
    expect(content).toContain('ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_at')
    expect(content).toContain('ON DELETE RESTRICT')
  })

  it('should provide archiveInbox method on inboxService and filter out archived inboxes in listInboxes', async () => {
    expect(typeof (inboxService as unknown as Record<string, unknown>).archiveInbox).toBe(
      'function',
    )

    // Create test inbox
    const res = await inboxService.createInbox({
      name: `Test Archive Inbox ${Date.now()}`,
      channelType: 'web_widget',
      websiteUrl: 'https://example.com',
      widgetColor: '#25D366',
    })
    const inbox = res.inbox
    expect(inbox).toBeDefined()
    expect(inbox.id).toBeDefined()

    // Listed before archive
    const listBefore = await inboxService.listInboxes()
    expect(listBefore.some((i) => i.id === inbox.id)).toBe(true)

    // Archive inbox
    const archived = await inboxService.archiveInbox(inbox.id)
    expect(archived).toBe(true)

    // Should NOT appear in listInboxes after archiving
    const listAfter = await inboxService.listInboxes()
    expect(listAfter.some((i) => i.id === inbox.id)).toBe(false)
  })

  it('should provide archiveContact method on contactService and filter out archived contacts in listContacts', async () => {
    expect(typeof (contactService as unknown as Record<string, unknown>).archiveContact).toBe(
      'function',
    )

    // Create test contact
    const contact = await contactService.createContact({
      name: `Soft Delete Contact ${Date.now()}`,
      phoneNumber: `+62899${Date.now().toString().slice(-7)}`,
    })
    expect(contact).toBeDefined()
    expect(contact.id).toBeDefined()

    // Listed before archive
    const listBefore = await contactService.listContacts()
    expect(listBefore.some((c) => c.id === contact.id)).toBe(true)

    // Archive contact
    const archived = await contactService.archiveContact(contact.id)
    expect(archived).toBe(true)

    // Should NOT appear in listContacts after archiving
    const listAfter = await contactService.listContacts()
    expect(listAfter.some((c) => c.id === contact.id)).toBe(false)
  })

  it('should provide archiveConversation method and filter out archived conversations in listConversations', async () => {
    expect(
      typeof (conversationService as unknown as Record<string, unknown>).archiveConversation,
    ).toBe('function')

    // Setup inbox & contact for conversation
    const res = await inboxService.createInbox({
      name: `Conv Inbox ${Date.now()}`,
      channelType: 'web_widget',
      websiteUrl: 'https://example.com',
      widgetColor: '#25D366',
    })
    const inbox = res.inbox
    const contact = await contactService.createContact({
      name: `Conv Contact ${Date.now()}`,
      phoneNumber: `+62811${Date.now().toString().slice(-7)}`,
    })

    const convId = crypto.randomUUID()
    const now = new Date().toISOString()
    await sql`
      INSERT INTO conversations (id, inbox_id, contact_id, unread_count, last_message_at, created_at, updated_at)
      VALUES (${convId}, ${inbox.id}, ${contact.id}, 0, ${now}, ${now}, ${now})
    `

    // Listed before archive
    const listBefore = await conversationService.listConversations()
    expect(listBefore.some((c) => c.id === convId)).toBe(true)

    // Archive conversation
    const archived = await conversationService.archiveConversation(convId)
    expect(archived).toBe(true)

    // Should NOT appear in listConversations after archiving
    const listAfter = await conversationService.listConversations()
    expect(listAfter.some((c) => c.id === convId)).toBe(false)
  })

  it('should prevent accidental hard deletion of inbox when active conversation or ticket history exists (CASCADE mitigation)', async () => {
    const res = await inboxService.createInbox({
      name: `Protected Inbox ${Date.now()}`,
      channelType: 'web_widget',
      websiteUrl: 'https://example.com',
      widgetColor: '#25D366',
    })
    const inbox = res.inbox
    const contact = await contactService.createContact({
      name: `Protected Contact ${Date.now()}`,
      phoneNumber: `+62822${Date.now().toString().slice(-7)}`,
    })

    const convId = crypto.randomUUID()
    const now = new Date().toISOString()
    await sql`
      INSERT INTO conversations (id, inbox_id, contact_id, unread_count, last_message_at, created_at, updated_at)
      VALUES (${convId}, ${inbox.id}, ${contact.id}, 0, ${now}, ${now}, ${now})
    `

    // Creating a message
    await sql`
      INSERT INTO messages (id, conversation_id, sender_type, content, message_type, status)
      VALUES (${crypto.randomUUID()}, ${convId}, 'contact', 'Protected history message', 'incoming', 'sent')
    `

    // Attempting a hard SQL DELETE on the inbox must fail due to foreign key RESTRICT constraint!
    let deleteFailed = false
    try {
      await sql`DELETE FROM inboxes WHERE id = ${inbox.id}`
    } catch (err) {
      deleteFailed = true
      expect((err as Error).message).toMatch(/foreign key constraint|violates foreign key/i)
    }

    expect(deleteFailed).toBe(true)

    // Verify conversation and message history are preserved intact
    const preservedConv = await sql`SELECT id FROM conversations WHERE id = ${convId}`
    expect(preservedConv.length).toBe(1)

    const preservedMsg = await sql`SELECT id FROM messages WHERE conversation_id = ${convId}`
    expect(preservedMsg.length).toBeGreaterThanOrEqual(1)
  })
})
