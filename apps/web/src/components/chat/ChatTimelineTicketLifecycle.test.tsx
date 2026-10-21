import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChatTimeline } from './ChatTimeline'
import {
  TicketOpenedPill,
  TicketResolvedPill,
  formatLifecycleDuration,
} from './TicketLifecyclePills'
import type { TimelineMessage } from './types'

describe('ChatTimeline Ticket Lifecycle Events (Issue #287 - TDD RED)', () => {
  it('formatLifecycleDuration helper should format milliseconds into human-readable Indonesian duration', () => {
    expect(formatLifecycleDuration(30 * 1000)).toBe('kurang dari 1 menit')
    expect(formatLifecycleDuration(5 * 60 * 1000)).toBe('5 menit')
    expect(formatLifecycleDuration(65 * 60 * 1000)).toBe('1 jam 5 menit')
    expect(formatLifecycleDuration(26 * 60 * 60 * 1000)).toBe('1 hari 2 jam')
  })

  it('TicketOpenedPill should render ticket number and timestamp', () => {
    const html = renderToStaticMarkup(
      <TicketOpenedPill ticketNumber="1006" timestamp="14:30" dateText="21 Oktober 2026" />,
    )

    expect(html).toContain('data-testid="ticket-opened-pill"')
    expect(html).toContain('Tiket #1006 Dibuka')
    expect(html).toContain('14:30')
    expect(html).toContain('🎫')
  })

  it('TicketResolvedPill should render resolver agent name, time, and handling duration', () => {
    const html = renderToStaticMarkup(
      <TicketResolvedPill
        ticketNumber="1006"
        resolvedBy="Budi Santoso"
        timestamp="14:55"
        durationText="25 menit"
      />,
    )

    expect(html).toContain('data-testid="ticket-resolved-pill"')
    expect(html).toContain('Tiket #1006 Diselesaikan')
    expect(html).toContain('Budi Santoso')
    expect(html).toContain('14:55')
    expect(html).toContain('Durasi: 25 menit')
    expect(html).toContain('🏁')
  })

  it('ChatTimeline should render TicketOpenedPill for the first ticket in the timeline', () => {
    const messages: TimelineMessage[] = [
      {
        id: 'msg-first-1',
        conversationId: 'conv-01',
        ticketId: 't-1006',
        ticketDisplayId: '1006',
        senderType: 'contact',
        senderName: 'Pelanggan',
        messageType: 'incoming',
        contentType: 'text',
        content: 'Halo, mau tanya produk ready?',
        timestamp: '14:30',
        dateGroup: 'HARI INI',
      },
    ]

    const html = renderToStaticMarkup(<ChatTimeline messages={messages} />)

    expect(html).toContain('data-testid="ticket-opened-pill"')
    expect(html).toContain('1006')
  })

  it('ChatTimeline should render TicketResolvedPill when activity message has eventType ticket_resolved', () => {
    const messages: TimelineMessage[] = [
      {
        id: 'msg-1',
        conversationId: 'conv-01',
        ticketId: 't-1006',
        ticketDisplayId: '1006',
        senderType: 'contact',
        senderName: 'Pelanggan',
        messageType: 'incoming',
        contentType: 'text',
        content: 'Terima kasih solusinya!',
        timestamp: '14:50',
        dateGroup: 'HARI INI',
      },
      {
        id: 'msg-resolved',
        conversationId: 'conv-01',
        ticketId: 't-1006',
        ticketDisplayId: '1006',
        senderType: 'system',
        messageType: 'activity',
        contentType: 'text',
        content: 'Tiket #1006 diselesaikan oleh Budi Santoso. (Waktu penanganan: 25 menit)',
        contentAttributes: {
          eventType: 'ticket_resolved',
          ticketDisplayId: 1006,
          resolvedBy: 'Budi Santoso',
          durationMs: 25 * 60 * 1000,
          durationText: '25 menit',
          openedAt: '2026-10-21T14:30:00.000Z',
          resolvedAt: '2026-10-21T14:55:00.000Z',
        },
        timestamp: '14:55',
        dateGroup: 'HARI INI',
      },
    ]

    const html = renderToStaticMarkup(<ChatTimeline messages={messages} />)

    expect(html).toContain('data-testid="ticket-resolved-pill"')
    expect(html).toContain('Budi Santoso')
    expect(html).toContain('25 menit')
  })
})
