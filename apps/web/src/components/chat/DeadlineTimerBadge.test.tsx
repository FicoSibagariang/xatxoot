import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChatListPanel, ConversationThread } from '../layout/WhatsAppLayout'
import type { ConversationItem } from '../layout/types'
import { DeadlineTimerBadge, calculateDeadlineStatus } from './DeadlineTimerBadge'

describe('Deadline Timer Badge & Inbox SLA Indicator (Task 2.18 - apps/web)', () => {
  const baseTime = new Date('2026-10-11T10:00:00.000Z')

  describe('calculateDeadlineStatus Helper', () => {
    it('should return hasDeadline false when deadlineAt is null, undefined, or invalid', () => {
      expect(calculateDeadlineStatus(null, baseTime)).toEqual({
        hasDeadline: false,
        isApproaching: false,
        isBreached: false,
        remainingMs: 0,
        label: '',
        severity: 'none',
      })
      expect(calculateDeadlineStatus(undefined, baseTime)).toEqual({
        hasDeadline: false,
        isApproaching: false,
        isBreached: false,
        remainingMs: 0,
        label: '',
        severity: 'none',
      })
      expect(calculateDeadlineStatus('invalid-date', baseTime)).toEqual({
        hasDeadline: false,
        isApproaching: false,
        isBreached: false,
        remainingMs: 0,
        label: '',
        severity: 'none',
      })
    })

    it('should identify safe deadline when remaining time is > 60 minutes', () => {
      // 2 hours in the future
      const futureDeadline = new Date(baseTime.getTime() + 2 * 60 * 60 * 1000).toISOString()
      const status = calculateDeadlineStatus(futureDeadline, baseTime)

      expect(status.hasDeadline).toBe(true)
      expect(status.severity).toBe('safe')
      expect(status.isApproaching).toBe(false)
      expect(status.isBreached).toBe(false)
      expect(status.label).toContain('2j')
    })

    it('should identify warning deadline when remaining time is between 15 and 60 minutes', () => {
      // 45 minutes in the future
      const futureDeadline = new Date(baseTime.getTime() + 45 * 60 * 1000).toISOString()
      const status = calculateDeadlineStatus(futureDeadline, baseTime)

      expect(status.hasDeadline).toBe(true)
      expect(status.severity).toBe('warning')
      expect(status.isApproaching).toBe(false)
      expect(status.isBreached).toBe(false)
      expect(status.label).toContain('45m')
    })

    it('should identify urgent/approaching deadline when remaining time is <= 15 minutes', () => {
      // 10 minutes in the future
      const urgentDeadline = new Date(baseTime.getTime() + 10 * 60 * 1000).toISOString()
      const status = calculateDeadlineStatus(urgentDeadline, baseTime)

      expect(status.hasDeadline).toBe(true)
      expect(status.severity).toBe('urgent')
      expect(status.isApproaching).toBe(true)
      expect(status.isBreached).toBe(false)
      expect(status.label).toContain('10m')
    })

    it('should identify breached deadline when remaining time is <= 0', () => {
      // 5 minutes in the past
      const pastDeadline = new Date(baseTime.getTime() - 5 * 60 * 1000).toISOString()
      const status = calculateDeadlineStatus(pastDeadline, baseTime)

      expect(status.hasDeadline).toBe(true)
      expect(status.severity).toBe('breached')
      expect(status.isApproaching).toBe(true)
      expect(status.isBreached).toBe(true)
      expect(status.label).toContain('Lewat 5m')
    })
  })

  describe('DeadlineTimerBadge Component Rendering', () => {
    it('should not render anything if deadlineAt is not provided', () => {
      const html = renderToStaticMarkup(<DeadlineTimerBadge deadlineAt={null} />)
      expect(html).not.toContain('data-testid="deadline-timer-badge"')
    })

    it('should not render anything if ticket status is resolved', () => {
      const futureDeadline = new Date(baseTime.getTime() + 10 * 60 * 1000).toISOString()
      const html = renderToStaticMarkup(
        <DeadlineTimerBadge deadlineAt={futureDeadline} status="resolved" now={baseTime} />,
      )
      expect(html).not.toContain('data-testid="deadline-timer-badge"')
    })

    it('should render red warning badge when deadline is approaching (urgent)', () => {
      const urgentDeadline = new Date(baseTime.getTime() + 10 * 60 * 1000).toISOString()
      const html = renderToStaticMarkup(
        <DeadlineTimerBadge deadlineAt={urgentDeadline} status="open" now={baseTime} />,
      )

      expect(html).toContain('data-testid="deadline-timer-badge"')
      expect(html).toContain('data-severity="urgent"')
      // Visual red warning styling
      expect(
        html.includes('text-rose-600') ||
          html.includes('text-red-600') ||
          html.includes('bg-rose-50') ||
          html.includes('bg-red-50'),
      ).toBe(true)
      expect(html).toContain('10m')
      expect(html).toContain('⏱️')
    })

    it('should render red alert badge when deadline is breached', () => {
      const breachedDeadline = new Date(baseTime.getTime() - 15 * 60 * 1000).toISOString()
      const html = renderToStaticMarkup(
        <DeadlineTimerBadge deadlineAt={breachedDeadline} status="open" now={baseTime} />,
      )

      expect(html).toContain('data-testid="deadline-timer-badge"')
      expect(html).toContain('data-severity="breached"')
      expect(
        html.includes('text-rose-700') ||
          html.includes('text-red-700') ||
          html.includes('bg-rose-100') ||
          html.includes('bg-rose-50'),
      ).toBe(true)
      expect(html).toContain('Lewat 15m')
    })

    it('should render amber warning badge when deadline is moderate', () => {
      const warningDeadline = new Date(baseTime.getTime() + 35 * 60 * 1000).toISOString()
      const html = renderToStaticMarkup(
        <DeadlineTimerBadge deadlineAt={warningDeadline} status="open" now={baseTime} />,
      )

      expect(html).toContain('data-testid="deadline-timer-badge"')
      expect(html).toContain('data-severity="warning"')
      expect(html.includes('text-amber-700') || html.includes('bg-amber-50')).toBe(true)
      expect(html).toContain('35m')
    })
  })

  describe('Integration with ChatListPanel (Inbox Column 2)', () => {
    const mockConversations: ConversationItem[] = [
      {
        id: 'conv-urgent',
        contactName: 'Budi Santoso',
        contactPhone: '+6281234567890',
        channel: 'whatsapp',
        lastMessage: 'Tolong segera dibantu kak',
        lastMessageTimestamp: '10:00',
        ticket: {
          id: 't-101',
          ticketNumber: 'T-101',
          status: 'open',
          priority: 'urgent',
          deadlineAt: new Date(baseTime.getTime() + 8 * 60 * 1000).toISOString(), // 8 mins remaining (urgent/red)
        },
      },
      {
        id: 'conv-safe',
        contactName: 'Siti Rahma',
        contactPhone: '+6289876543210',
        channel: 'whatsapp',
        lastMessage: 'Terima kasih infonya',
        lastMessageTimestamp: '09:40',
        ticket: {
          id: 't-102',
          ticketNumber: 'T-102',
          status: 'open',
          priority: 'medium',
          deadlineAt: new Date(baseTime.getTime() + 120 * 60 * 1000).toISOString(), // 2 hours (safe)
        },
      },
      {
        id: 'conv-resolved',
        contactName: 'Andi Pratama',
        contactPhone: '+628111222333',
        channel: 'whatsapp',
        lastMessage: 'Sudah selesai ya',
        lastMessageTimestamp: '08:00',
        ticket: {
          id: 't-103',
          ticketNumber: 'T-103',
          status: 'resolved',
          deadlineAt: new Date(baseTime.getTime() - 10 * 60 * 1000).toISOString(),
        },
      },
    ]

    it('should render deadline timer indicator in inbox conversation list with red warning for urgent ticket', () => {
      const html = renderToStaticMarkup(
        <ChatListPanel
          conversations={mockConversations}
          selectedConversationId="conv-urgent"
          activeFilter="all"
          searchQuery=""
          now={baseTime}
          onSelectConversation={() => {}}
          onFilterChange={() => {}}
          onSearchChange={() => {}}
          onNewChat={() => {}}
        />,
      )

      expect(html).toContain('data-testid="chat-list-panel"')
      // Should show deadline badge for conv-urgent with red styling
      expect(html).toContain('data-testid="deadline-timer-badge"')
      expect(html).toContain('data-severity="urgent"')
      expect(html).toContain('8m')

      // Should show deadline badge for conv-safe
      expect(html).toContain('data-severity="safe"')
      expect(html).toContain('2j')
    })
  })

  describe('Integration with ConversationThread Header (Column 3)', () => {
    const urgentConv: ConversationItem = {
      id: 'conv-urgent',
      contactName: 'Budi Santoso',
      contactPhone: '+6281234567890',
      channel: 'whatsapp',
      lastMessage: 'Tolong segera dibantu kak',
      ticket: {
        id: 't-101',
        ticketNumber: 'T-101',
        status: 'open',
        priority: 'urgent',
        deadlineAt: new Date(baseTime.getTime() + 5 * 60 * 1000).toISOString(), // 5 mins left
      },
    }

    it('should render deadline timer badge in ConversationThread header', () => {
      const html = renderToStaticMarkup(
        <ConversationThread
          conversation={urgentConv}
          isDrawerOpen={false}
          now={baseTime}
          onToggleDrawer={() => {}}
          onSendMessage={() => {}}
          onAssignTicket={() => {}}
          onResolveTicket={() => {}}
        />,
      )

      expect(html).toContain('data-testid="conversation-thread"')
      expect(html).toContain('data-testid="thread-header"')
      expect(html).toContain('data-testid="deadline-timer-badge"')
      expect(html).toContain('data-severity="urgent"')
      expect(html).toContain('5m')
    })
  })
})
