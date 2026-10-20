import { beforeEach, describe, expect, it } from 'bun:test'
import app from '../../index'
import { conversationService } from '../conversations/conversations.service'
import { inboxService } from '../inboxes/inboxes.service'
import { ticketService } from '../tickets/tickets.service'
import { resetMessageStore } from './messages.service'

describe('Ticket Reply Assignment Enforcement (Issue #285 - TDD RED)', () => {
  beforeEach(() => {
    resetMessageStore()
  })

  it('POST /api/v1/conversations/:id/messages should reject reply on unassigned active ticket with 403', async () => {
    const { inbox } = await inboxService.createInbox({
      name: 'Unassigned Guard Inbox',
      channelType: 'whatsapp_cloud',
      channel: {
        phoneNumber: '+6281234567891',
        phoneNumberId: '1000000009',
        wabaId: 'waba_00000009',
        accessToken: 'EAAB_guard_token',
        webhookVerifyToken: 'guard_verify',
      },
    })

    const inbound = await conversationService.handleInboundMessage({
      inboxId: inbox.id,
      senderNumber: '+6289988771122',
      senderName: 'Pelanggan Unassigned',
      content: 'Tolong bantu saya sekarang',
    })

    const conversationId = inbound.conversation.id
    const ticketId = inbound.ticket.id

    // Ensure ticket is unassigned
    await ticketService.updateTicket(ticketId, { assignedTo: null })

    // Agent attempts to send reply
    const res = await app.request(`/api/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer agent-access-token',
      },
      body: JSON.stringify({
        content: 'Halo kak, saya coba balas tanpa claim tiket.',
      }),
    })

    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe(
      'Tiket harus ditugaskan secara eksplisit terlebih dahulu sebelum mengirim pesan balasan',
    )
  })

  it('POST /api/v1/conversations/:id/messages should reject reply when ticket is assigned to another agent with 403', async () => {
    const { inbox } = await inboxService.createInbox({
      name: 'Other Agent Guard Inbox',
      channelType: 'whatsapp_cloud',
      channel: {
        phoneNumber: '+6281234567892',
        phoneNumberId: '1000000010',
        wabaId: 'waba_00000010',
        accessToken: 'EAAB_guard_token_2',
        webhookVerifyToken: 'guard_verify_2',
      },
    })

    const inbound = await conversationService.handleInboundMessage({
      inboxId: inbox.id,
      senderNumber: '+6289988771133',
      senderName: 'Pelanggan Other Agent',
      content: 'Mau komplain pesanan',
    })

    const conversationId = inbound.conversation.id
    const ticketId = inbound.ticket.id

    // Assign to a different agent (not mock-agent-id)
    await ticketService.updateTicket(ticketId, {
      assignedTo: 'different-agent-uuid-999',
    })

    const res = await app.request(`/api/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer agent-access-token',
      },
      body: JSON.stringify({
        content: 'Halo kak, saya menyela tiket agen lain.',
      }),
    })

    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('Tiket ini sedang ditangani oleh agen lain')
  })

  it('POST /api/v1/conversations/:id/messages should succeed with 201 when ticket is assigned to current agent', async () => {
    const { inbox } = await inboxService.createInbox({
      name: 'My Assigned Guard Inbox',
      channelType: 'whatsapp_cloud',
      channel: {
        phoneNumber: '+6281234567893',
        phoneNumberId: '1000000011',
        wabaId: 'waba_00000011',
        accessToken: 'EAAB_guard_token_3',
        webhookVerifyToken: 'guard_verify_3',
      },
    })

    const inbound = await conversationService.handleInboundMessage({
      inboxId: inbox.id,
      senderNumber: '+6289988771144',
      senderName: 'Pelanggan Sukses',
      content: 'Pertanyaan saya',
    })

    const conversationId = inbound.conversation.id
    const ticketId = inbound.ticket.id

    // Assign explicitly to the agent
    await ticketService.updateTicket(ticketId, {
      assignedTo: 'mock-agent-id',
    })

    const res = await app.request(`/api/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer agent-access-token',
      },
      body: JSON.stringify({
        content: 'Halo kak, saya agen yang ditugaskan resmi membantu Anda.',
      }),
    })

    expect(res.status).toBe(201)
    const body = (await res.json()) as { message: { id: string; content: string } }
    expect(body.message).toBeDefined()
    expect(body.message.content).toContain('agen yang ditugaskan')
  })

  it('POST /api/v1/conversations/:id/messages should succeed with 201 when active ticket is resolved', async () => {
    const { inbox } = await inboxService.createInbox({
      name: 'Resolved Ticket Inbox',
      channelType: 'whatsapp_cloud',
      channel: {
        phoneNumber: '+6281234567894',
        phoneNumberId: '1000000012',
        wabaId: 'waba_00000012',
        accessToken: 'EAAB_guard_token_4',
        webhookVerifyToken: 'guard_verify_4',
      },
    })

    const inbound = await conversationService.handleInboundMessage({
      inboxId: inbox.id,
      senderNumber: '+6289988771155',
      senderName: 'Pelanggan Resolved',
      content: 'Sudah beres',
    })

    const conversationId = inbound.conversation.id
    const ticketId = inbound.ticket.id

    // Resolve ticket
    await ticketService.updateTicketStatus(ticketId, 'resolved')

    const res = await app.request(`/api/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer agent-access-token',
      },
      body: JSON.stringify({
        content: 'Terima kasih telah menghubungi kami!',
      }),
    })

    expect(res.status).toBe(201)
  })
})
