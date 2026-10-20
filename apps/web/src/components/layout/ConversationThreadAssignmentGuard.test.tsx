import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ConversationThread } from './ConversationThread'
import type { ConversationItem, LayoutUser } from './types'

describe('ConversationThread Ticket Assignment Guard (Issue #285 - TDD RED)', () => {
  const currentAgent: LayoutUser = {
    id: 'agent-me-123',
    name: 'Budi Santoso',
    email: 'budi@xatxoot.com',
    role: 'agent',
    status: 'online',
  }

  it('Scenario A: should render unassigned banner and CTA claim button when ticket has no assigned agent', () => {
    const unassignedConv: ConversationItem = {
      id: 'conv-unassigned-1',
      contactName: 'Pelanggan Butuh Bantuan',
      channel: 'whatsapp',
      ticket: {
        id: 'ticket-unassigned-1',
        ticketNumber: '1001',
        status: 'open',
        assignedTo: undefined,
      },
    }

    const html = renderToStaticMarkup(
      <ConversationThread
        conversation={unassignedConv}
        currentUser={currentAgent}
        isDrawerOpen={false}
        onToggleDrawer={() => {}}
        onSendMessage={() => {}}
        onAssignTicket={() => {}}
        onResolveTicket={() => {}}
      />,
    )

    expect(html).toContain('data-testid="unassigned-ticket-banner"')
    expect(html).toContain('Percakapan ini belum ditugaskan. Ambil tiket untuk mulai membalas.')
    expect(html).toContain('data-testid="btn-claim-ticket"')
    expect(html).toContain('Ambil Tiket Ini')

    // Input field should be locked/hidden
    expect(html).not.toContain('placeholder="Ketik pesan atau ketik / untuk balasan cepat..."')
  })

  it('Scenario B: should render warning banner when ticket is assigned to another agent', () => {
    const otherAgentConv: ConversationItem = {
      id: 'conv-other-1',
      contactName: 'Pelanggan Kasus Spesial',
      channel: 'whatsapp',
      ticket: {
        id: 'ticket-other-1',
        ticketNumber: '1002',
        status: 'open',
        assignedTo: 'agent-other-456',
        assignedAgentName: 'Siti Aminah',
      },
    }

    const html = renderToStaticMarkup(
      <ConversationThread
        conversation={otherAgentConv}
        currentUser={currentAgent}
        isDrawerOpen={false}
        onToggleDrawer={() => {}}
        onSendMessage={() => {}}
        onAssignTicket={() => {}}
        onResolveTicket={() => {}}
      />,
    )

    expect(html).toContain('data-testid="assigned-other-ticket-banner"')
    expect(html).toContain('Tiket ini sedang ditangani oleh Siti Aminah')
    expect(html).toContain('data-testid="btn-reassign-ticket"')
    expect(html).toContain('Ambil Alih')

    // Input field should be locked/hidden
    expect(html).not.toContain('placeholder="Ketik pesan atau ketik / untuk balasan cepat..."')
  })

  it('Scenario C: should render normal unlocked input bar when ticket is assigned to current agent', () => {
    const myConv: ConversationItem = {
      id: 'conv-my-1',
      contactName: 'Pelanggan Saya',
      channel: 'whatsapp',
      ticket: {
        id: 'ticket-my-1',
        ticketNumber: '1003',
        status: 'open',
        assignedTo: currentAgent.id,
        assignedAgentName: currentAgent.name,
      },
    }

    const html = renderToStaticMarkup(
      <ConversationThread
        conversation={myConv}
        currentUser={currentAgent}
        isDrawerOpen={false}
        onToggleDrawer={() => {}}
        onSendMessage={() => {}}
        onAssignTicket={() => {}}
        onResolveTicket={() => {}}
      />,
    )

    expect(html).not.toContain('data-testid="unassigned-ticket-banner"')
    expect(html).not.toContain('data-testid="assigned-other-ticket-banner"')
    expect(html).toContain('placeholder="Ketik pesan atau ketik / untuk balasan cepat..."')
    expect(html).toContain('Kirim')
  })

  it('Scenario D: should render normal unlocked input bar when ticket is resolved', () => {
    const resolvedConv: ConversationItem = {
      id: 'conv-res-1',
      contactName: 'Pelanggan Sudah Selesai',
      channel: 'whatsapp',
      ticket: {
        id: 'ticket-res-1',
        ticketNumber: '1004',
        status: 'resolved',
        assignedTo: undefined, // unassigned but resolved
      },
    }

    const html = renderToStaticMarkup(
      <ConversationThread
        conversation={resolvedConv}
        currentUser={currentAgent}
        isDrawerOpen={false}
        onToggleDrawer={() => {}}
        onSendMessage={() => {}}
        onAssignTicket={() => {}}
        onResolveTicket={() => {}}
      />,
    )

    expect(html).not.toContain('data-testid="unassigned-ticket-banner"')
    expect(html).not.toContain('data-testid="assigned-other-ticket-banner"')
    expect(html).toContain('placeholder="Ketik pesan atau ketik / untuk balasan cepat..."')
  })
})
