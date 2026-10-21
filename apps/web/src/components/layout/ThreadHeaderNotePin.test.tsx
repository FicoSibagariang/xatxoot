import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { TicketSeparatorPill } from '../chat'
import { ThreadTicketHeaderActions } from './EmptyConversationState'
import type { TicketSummary } from './types'

describe('Thread Header Note Pin & Separator Pill (Issue #296 - TDD RED)', () => {
  const emptyNoteTicket: TicketSummary = {
    id: 't-1001',
    ticketNumber: '1001',
    status: 'open',
    internalNote: '',
  }

  const activeNoteTicket: TicketSummary = {
    id: 't-1002',
    ticketNumber: '1002',
    status: 'open',
    internalNote: 'Catatan penting: kirim invoice sebelum jam 17:00.',
    internalNoteUpdatedAt: '2026-10-21T09:30:00.000Z',
    internalNoteUpdatedBy: 'Siti Supervisor',
  }

  it('ThreadTicketHeaderActions should render neutral note pin button when ticket has no internal note', () => {
    const html = renderToStaticMarkup(
      <ThreadTicketHeaderActions
        ticket={emptyNoteTicket}
        isTicketAssignedToMe={true}
        isTicketAssignedToOther={false}
        isTicketResolved={false}
        onAssignTicket={() => {}}
        onResolveTicket={() => {}}
        onSaveInternalNote={() => {}}
      />,
    )

    expect(html).toContain('data-testid="btn-ticket-note-pin"')
    expect(html).toContain('Catatan')
    expect(html).toContain('data-has-note="false"')
  })

  it('ThreadTicketHeaderActions should render active amber pin button when ticket has internal note', () => {
    const html = renderToStaticMarkup(
      <ThreadTicketHeaderActions
        ticket={activeNoteTicket}
        isTicketAssignedToMe={true}
        isTicketAssignedToOther={false}
        isTicketResolved={false}
        onAssignTicket={() => {}}
        onResolveTicket={() => {}}
        onSaveInternalNote={() => {}}
      />,
    )

    expect(html).toContain('data-testid="btn-ticket-note-pin"')
    expect(html).toContain('data-has-note="true"')
    expect(html).toContain('bg-amber-100')
    expect(html).toContain('text-amber-900')
  })

  it('TicketSeparatorPill should render note badge when internalNote is provided', () => {
    const html = renderToStaticMarkup(
      <TicketSeparatorPill
        ticketNumber="1002"
        text="Tiket #1002 Dimulai"
        internalNote="Catatan penting: kirim invoice sebelum jam 17:00."
      />,
    )

    expect(html).toContain('data-testid="ticket-pill-note-badge"')
    expect(html).toContain('📌')
  })
})
