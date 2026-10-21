import { beforeEach, describe, expect, it } from 'bun:test'
import { conversationService, resetConversationStore } from '../conversations/conversations.service'
import { messageStore } from '../messages/message-store'
import { resetTicketStore, ticketService } from './tickets.service'

describe('Ticket Lifecycle Events (Issue #287 - TDD RED)', () => {
  beforeEach(() => {
    resetConversationStore()
    resetTicketStore()
  })

  it('ticketService.createTicket should create a ticket_opened activity message with displayId and timestamp', async () => {
    const convId = 'conv-lifecycle-01'
    const ticket = await ticketService.createTicket({
      conversationId: convId,
      status: 'open',
      priority: 'high',
    })

    expect(ticket).toBeDefined()
    expect(ticket.id).toBeDefined()

    // Check messageStore for ticket_opened activity message
    const msgs = Array.from(messageStore.messages.values()).filter(
      (m) => m.conversationId === convId && m.messageType === 'activity',
    )

    expect(msgs.length).toBeGreaterThanOrEqual(1)
    const openedMsg = msgs.find(
      (m) => (m.contentAttributes as Record<string, unknown>)?.eventType === 'ticket_opened',
    )

    expect(openedMsg).toBeDefined()
    expect(openedMsg?.content).toContain(`Tiket #${ticket.displayId} dibuka.`)
    expect(openedMsg?.ticketId).toBe(ticket.id)
    const attrs = openedMsg?.contentAttributes as Record<string, unknown>
    expect(attrs.eventType).toBe('ticket_opened')
    expect(attrs.ticketDisplayId).toBe(ticket.displayId)
  })

  it('ticketService.updateTicketStatus to resolved should enrich ticket_resolved activity message with agent name and duration', async () => {
    const convId = 'conv-lifecycle-02'
    const ticket = await ticketService.createTicket({
      conversationId: convId,
      status: 'open',
    })

    // Simulate 15 minutes elapsed
    const pastTime = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    ticket.openedAt = pastTime
    ticket.createdAt = pastTime

    const resolvedTicket = await ticketService.updateTicketStatus(ticket.id, 'resolved', null, {
      agentName: 'Budi Santoso',
      agentId: 'agent-123',
    })

    expect(resolvedTicket.status).toBe('resolved')
    expect(resolvedTicket.resolvedAt).toBeDefined()

    const msgs = Array.from(messageStore.messages.values()).filter(
      (m) => m.conversationId === convId && m.messageType === 'activity',
    )

    const resolvedMsg = msgs.find(
      (m) => (m.contentAttributes as Record<string, unknown>)?.eventType === 'ticket_resolved',
    )

    expect(resolvedMsg).toBeDefined()
    expect(resolvedMsg?.content).toContain(
      `Tiket #${ticket.displayId} diselesaikan oleh Budi Santoso`,
    )
    expect(resolvedMsg?.content).toContain('Waktu penanganan:')

    const attrs = resolvedMsg?.contentAttributes as Record<string, unknown>
    expect(attrs.eventType).toBe('ticket_resolved')
    expect(attrs.resolvedBy).toBe('Budi Santoso')
    expect(typeof attrs.durationMs).toBe('number')
    expect(Number(attrs.durationMs)).toBeGreaterThanOrEqual(14 * 60 * 1000)
    expect(attrs.durationText).toBeDefined()
  })
})
