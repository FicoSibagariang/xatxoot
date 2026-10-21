import { describe, expect, it, mock } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { TicketNotePopover } from './TicketNotePopover'

describe('TicketNotePopover Component (Issue #296 - TDD RED)', () => {
  it('should render popover with textarea, metadata, and action buttons', () => {
    const html = renderToStaticMarkup(
      <TicketNotePopover
        isOpen={true}
        ticketNumber="1003"
        initialNote="Pelanggan VIP, proses penawaran harga khusus."
        updatedAt="2026-10-21T10:00:00.000Z"
        updatedBy="Budi CS"
        onSave={() => {}}
        onClose={() => {}}
        onDelete={() => {}}
      />,
    )

    expect(html).toContain('data-testid="ticket-note-popover"')
    expect(html).toContain('data-testid="ticket-note-textarea"')
    expect(html).toContain('Pelanggan VIP, proses penawaran harga khusus.')
    expect(html).toContain('data-testid="ticket-note-meta"')
    expect(html).toContain('Budi CS')
    expect(html).toContain('data-testid="btn-save-ticket-note"')
    expect(html).toContain('data-testid="btn-cancel-ticket-note"')
    expect(html).toContain('data-testid="btn-delete-ticket-note"')
  })

  it('should not render anything when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <TicketNotePopover
        isOpen={false}
        ticketNumber="1003"
        initialNote=""
        onSave={() => {}}
        onClose={() => {}}
      />,
    )

    expect(html).toBe('')
  })
})
