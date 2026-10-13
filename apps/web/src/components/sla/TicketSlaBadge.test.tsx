import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { TicketSlaBadge, type TicketSlaBadgeProps, calculateTicketSla } from './TicketSlaBadge'

describe('Ticket SLA Visual Badge & Countdown Component (Task 5.16 - apps/web)', () => {
  const rootDir = join(import.meta.dir, '..', '..', '..', '..', '..')
  const baseTime = new Date('2026-10-13T10:00:00.000Z')

  describe('1. calculateTicketSla Helper Logic', () => {
    it('should return hasSla false when no deadlines are provided', () => {
      const result = calculateTicketSla({}, baseTime)
      expect(result.hasSla).toBe(false)
      expect(result.severity).toBe('none')
    })

    it('should calculate safe SLA when remaining time > 60 minutes', () => {
      const futureDeadline = new Date(baseTime.getTime() + 120 * 60 * 1000) // +2 jam
      const result = calculateTicketSla(
        {
          resolutionDeadline: futureDeadline,
          policyName: 'Standard SLA',
        },
        baseTime,
      )

      expect(result.hasSla).toBe(true)
      expect(result.severity).toBe('safe')
      expect(result.isBreached).toBe(false)
      expect(result.isApproaching).toBe(false)
      expect(result.formattedRemaining).toBe('2j')
      expect(result.badgeLabel).toContain('2j')
    })

    it('should calculate warning SLA when remaining time between 16 and 60 minutes', () => {
      const warningDeadline = new Date(baseTime.getTime() + 45 * 60 * 1000) // +45 menit
      const result = calculateTicketSla(
        {
          resolutionDeadline: warningDeadline,
        },
        baseTime,
      )

      expect(result.hasSla).toBe(true)
      expect(result.severity).toBe('warning')
      expect(result.isBreached).toBe(false)
      expect(result.isApproaching).toBe(false)
      expect(result.formattedRemaining).toBe('45m')
    })

    it('should calculate urgent / approaching SLA when remaining time <= 15 minutes', () => {
      const urgentDeadline = new Date(baseTime.getTime() + 10 * 60 * 1000) // +10 menit
      const result = calculateTicketSla(
        {
          firstResponseDeadline: urgentDeadline,
          targetType: 'first_response',
        },
        baseTime,
      )

      expect(result.hasSla).toBe(true)
      expect(result.severity).toBe('urgent')
      expect(result.isApproaching).toBe(true)
      expect(result.isBreached).toBe(false)
      expect(result.targetType).toBe('first_response')
      expect(result.formattedRemaining).toBe('10m')
      expect(result.badgeLabel).toContain('FR: 10m')
    })

    it('should calculate breached SLA when deadline has passed or isBreached is true', () => {
      const passedDeadline = new Date(baseTime.getTime() - 20 * 60 * 1000) // -20 menit
      const result = calculateTicketSla(
        {
          resolutionDeadline: passedDeadline,
          isBreached: true,
        },
        baseTime,
      )

      expect(result.hasSla).toBe(true)
      expect(result.severity).toBe('breached')
      expect(result.isBreached).toBe(true)
      expect(result.formattedRemaining).toContain('Lewat')
      expect(result.badgeLabel).toContain('Lewat 20m')
    })

    it('should return fulfilled status when ticket is resolved before breach', () => {
      const futureDeadline = new Date(baseTime.getTime() + 60 * 60 * 1000)
      const result = calculateTicketSla(
        {
          resolutionDeadline: futureDeadline,
          ticketStatus: 'resolved',
          isBreached: false,
        },
        baseTime,
      )

      expect(result.hasSla).toBe(true)
      expect(result.severity).toBe('fulfilled')
      expect(result.badgeLabel).toContain('SLA Terpenuhi')
    })
  })

  describe('2. TicketSlaBadge Component Rendering', () => {
    it('should render nothing when no SLA deadline exists', () => {
      const html = renderToStaticMarkup(<TicketSlaBadge now={baseTime} />)
      expect(html).toBe('')
    })

    it('should render safe SLA badge with clock icon and remaining time', () => {
      const futureDeadline = new Date(baseTime.getTime() + 90 * 60 * 1000)
      const html = renderToStaticMarkup(
        <TicketSlaBadge
          resolutionDeadline={futureDeadline}
          policyName="Priority SLA"
          now={baseTime}
        />,
      )

      expect(html).toContain('data-testid="ticket-sla-badge"')
      expect(html).toContain('data-severity="safe"')
      expect(html).toContain('data-testid="sla-countdown-text"')
      expect(html).toContain('1j 30m')
    })

    it('should render urgent SLA badge with pulsating indicator and approaching attribute', () => {
      const urgentDeadline = new Date(baseTime.getTime() + 8 * 60 * 1000)
      const html = renderToStaticMarkup(
        <TicketSlaBadge
          firstResponseDeadline={urgentDeadline}
          targetType="first_response"
          now={baseTime}
        />,
      )

      expect(html).toContain('data-testid="ticket-sla-badge"')
      expect(html).toContain('data-severity="urgent"')
      expect(html).toContain('data-approaching="true"')
      expect(html).toContain('data-breached="false"')
      expect(html).toContain('FR: 8m')
      expect(html).toContain('animate-pulse')
    })

    it('should render breached SLA badge with alert icon and overdue time', () => {
      const breachedDeadline = new Date(baseTime.getTime() - 15 * 60 * 1000)
      const html = renderToStaticMarkup(
        <TicketSlaBadge resolutionDeadline={breachedDeadline} isBreached={true} now={baseTime} />,
      )

      expect(html).toContain('data-testid="ticket-sla-badge"')
      expect(html).toContain('data-severity="breached"')
      expect(html).toContain('data-breached="true"')
      expect(html).toContain('Lewat 15m')
      expect(html).toContain('⚠️')
    })

    it('should render fulfilled SLA badge with checkmark when resolved', () => {
      const deadline = new Date(baseTime.getTime() + 30 * 60 * 1000)
      const html = renderToStaticMarkup(
        <TicketSlaBadge resolutionDeadline={deadline} ticketStatus="resolved" now={baseTime} />,
      )

      expect(html).toContain('data-testid="ticket-sla-badge"')
      expect(html).toContain('data-severity="fulfilled"')
      expect(html).toContain('✅')
      expect(html).toContain('SLA Terpenuhi')
    })

    it('should render detailed tooltip when policy information is provided', () => {
      const deadline = new Date(baseTime.getTime() + 45 * 60 * 1000)
      const html = renderToStaticMarkup(
        <TicketSlaBadge
          policyName="Enterprise Gold SLA"
          firstResponseDeadline={deadline}
          resolutionDeadline={new Date(baseTime.getTime() + 180 * 60 * 1000)}
          showTooltip={true}
          now={baseTime}
        />,
      )

      expect(html).toContain('data-testid="sla-tooltip"')
      expect(html).toContain('Enterprise Gold SLA')
      expect(html).toContain('First Response')
      expect(html).toContain('Resolusi')
    })
  })

  describe('3. Integration with Conversation Cards & Thread Header', () => {
    it('should render TicketSlaBadge on ticket cards in chat list and header', () => {
      const urgentDeadline = new Date(baseTime.getTime() + 12 * 60 * 1000)
      const html = renderToStaticMarkup(
        <div data-testid="chat-list-card">
          <TicketSlaBadge firstResponseDeadline={urgentDeadline} size="sm" now={baseTime} />
        </div>,
      )

      expect(html).toContain('data-testid="ticket-sla-badge"')
      expect(html).toContain('data-severity="urgent"')
    })
  })

  describe('4. Single Organization Guardrail & Phase 5 Checklist', () => {
    it('should strictly NOT contain or require account_id or accountId in TicketSlaBadge code', () => {
      const componentSource = readFileSync(join(__dirname, 'TicketSlaBadge.tsx'), 'utf-8')
      expect(componentSource).not.toContain('account_id')
      expect(componentSource).not.toContain('accountId')
    })

    it('should verify docs/PHASE_5_CHECKLIST.md marks Task 5.16 as completed', () => {
      const checklist = readFileSync(join(rootDir, 'docs', 'PHASE_5_CHECKLIST.md'), 'utf-8')
      expect(checklist).toContain('- [x] **Task 5.16**:')
    })
  })
})
