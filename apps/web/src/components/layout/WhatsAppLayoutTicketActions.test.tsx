import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ConversationThread } from './WhatsAppLayout'
import type { ConversationItem, LayoutUser, TicketSummary } from './types'

describe('ConversationThread Quick Ticket Actions (Resolve & Assign buttons)', () => {
  const mockUser: LayoutUser = {
    id: '3b87d597-cde4-4b3e-8cce-e3bd24ac1c4f',
    name: 'Petugas CS',
    email: 'agent@xatxoot.local',
    role: 'agent',
    status: 'online',
  }

  const baseTicket: TicketSummary = {
    id: 'ticket-101',
    ticketNumber: '1006',
    status: 'open',
    priority: 'high',
    assignedTo: undefined,
  }

  const baseConversation: ConversationItem = {
    id: 'conv-101',
    contactName: 'Budi Santoso',
    contactPhone: '+6281234567890',
    channel: 'whatsapp',
    lastMessage: 'Mohon info pesanan saya',
    lastMessageTimestamp: '10:00',
    unreadCount: 0,
    ticket: baseTicket,
  }

  it('should render Resolve button when ticket status is open', () => {
    const html = renderToStaticMarkup(
      <ConversationThread
        currentUser={mockUser}
        conversation={baseConversation}
        isDrawerOpen={false}
        onToggleDrawer={() => {}}
        onSendMessage={() => {}}
        onAssignTicket={() => {}}
        onResolveTicket={() => {}}
      />,
    )

    expect(html).toContain('data-testid="btn-resolve-ticket"')
    expect(html).toContain('>Resolve<')
  })

  it('should render "Buka Kembali" button when ticket status is resolved', () => {
    const resolvedConversation: ConversationItem = {
      ...baseConversation,
      ticket: {
        ...baseTicket,
        status: 'resolved',
      },
    }

    const html = renderToStaticMarkup(
      <ConversationThread
        currentUser={mockUser}
        conversation={resolvedConversation}
        isDrawerOpen={false}
        onToggleDrawer={() => {}}
        onSendMessage={() => {}}
        onAssignTicket={() => {}}
        onResolveTicket={() => {}}
      />,
    )

    expect(html).toContain('data-testid="btn-resolve-ticket"')
    expect(html).toContain('>Buka Kembali<')
  })

  it('should render "Assign" button when ticket is unassigned', () => {
    const html = renderToStaticMarkup(
      <ConversationThread
        currentUser={mockUser}
        conversation={baseConversation}
        isDrawerOpen={false}
        onToggleDrawer={() => {}}
        onSendMessage={() => {}}
        onAssignTicket={() => {}}
        onResolveTicket={() => {}}
      />,
    )

    expect(html).toContain('data-testid="btn-assign-ticket"')
    expect(html).toContain('>Assign<')
  })

  it('should render "Unassign" button when ticket is assigned to current user', () => {
    const assignedConversation: ConversationItem = {
      ...baseConversation,
      ticket: {
        ...baseTicket,
        assignedTo: mockUser.id,
      },
    }

    const html = renderToStaticMarkup(
      <ConversationThread
        currentUser={mockUser}
        conversation={assignedConversation}
        isDrawerOpen={false}
        onToggleDrawer={() => {}}
        onSendMessage={() => {}}
        onAssignTicket={() => {}}
        onResolveTicket={() => {}}
      />,
    )

    expect(html).toContain('data-testid="btn-assign-ticket"')
    expect(html).toContain('>Unassign<')
  })

  it('should render "Ditugaskan" button when ticket is assigned to someone else', () => {
    const otherUserConversation: ConversationItem = {
      ...baseConversation,
      ticket: {
        ...baseTicket,
        assignedTo: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      },
    }

    const html = renderToStaticMarkup(
      <ConversationThread
        currentUser={mockUser}
        conversation={otherUserConversation}
        isDrawerOpen={false}
        onToggleDrawer={() => {}}
        onSendMessage={() => {}}
        onAssignTicket={() => {}}
        onResolveTicket={() => {}}
      />,
    )

    expect(html).toContain('data-testid="btn-assign-ticket"')
    expect(html).toContain('>Ditugaskan<')
  })

  it('should NOT render Assign or Resolve buttons when conversation has no ticket', () => {
    const conversationWithoutTicket: ConversationItem = {
      ...baseConversation,
      ticket: undefined,
    }

    const html = renderToStaticMarkup(
      <ConversationThread
        currentUser={mockUser}
        conversation={conversationWithoutTicket}
        isDrawerOpen={false}
        onToggleDrawer={() => {}}
        onSendMessage={() => {}}
        onAssignTicket={() => {}}
        onResolveTicket={() => {}}
      />,
    )

    expect(html).not.toContain('data-testid="btn-assign-ticket"')
    expect(html).not.toContain('data-testid="btn-resolve-ticket"')
  })
})
