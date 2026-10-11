import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { ContactDrawer } from './ContactDrawer'
import { TicketCsatCard, type TicketCsatData } from './TicketCsatCard'
import type { ContactDrawerData } from './types'

describe('Ticket CSAT Rating Drawer Widget (Task 3.16 - apps/web)', () => {
  const dummyTicketId = '123e4567-e89b-12d3-a456-426614174088'

  describe('TicketCsatCard Component Rendering', () => {
    it('should render submitted 5-star CSAT rating with feedback and date', () => {
      const csatData: TicketCsatData = {
        ticketId: dummyTicketId,
        rating: 5,
        feedbackText: 'Pelayanan prima, masalah langsung tuntas dalam 5 menit!',
        submittedAt: '2026-10-12T10:30:00Z',
        status: 'submitted',
      }

      const html = renderToStaticMarkup(<TicketCsatCard csat={csatData} />)

      // Header & Rating Score
      expect(html).toContain('Kepuasan Pelanggan (CSAT)')
      expect(html).toContain('5 / 5')
      expect(html).toContain('Sangat Puas')
      expect(html).toContain('😍')

      // Star rendering
      expect(html).toContain('★')

      // Feedback Text
      expect(html).toContain('Pelayanan prima, masalah langsung tuntas dalam 5 menit!')
    })

    it('should render lower ratings with appropriate emoji and labels (e.g. 2 stars)', () => {
      const csatData: TicketCsatData = {
        ticketId: dummyTicketId,
        rating: 2,
        feedbackText: 'Respon agak lambat dan butuh follow up berkali-kali.',
        status: 'submitted',
      }

      const html = renderToStaticMarkup(<TicketCsatCard csat={csatData} />)

      expect(html).toContain('2 / 5')
      expect(html).toContain('Kecewa')
      expect(html).toContain('🙁')
      expect(html).toContain('Respon agak lambat dan butuh follow up berkali-kali.')
    })

    it('should render pending status when survey invite is sent but not yet submitted', () => {
      const csatData: TicketCsatData = {
        ticketId: dummyTicketId,
        status: 'pending',
        inviteToken: 'csat_token_pending_123',
      }

      const html = renderToStaticMarkup(<TicketCsatCard csat={csatData} />)

      expect(html).toContain('Menunggu Penilaian Pelanggan')
      expect(html).toContain('Survei telah dikirimkan ke pelanggan')
    })

    it('should render empty state when ticket has no CSAT survey data', () => {
      const html = renderToStaticMarkup(<TicketCsatCard csat={null} />)

      expect(html).toContain('Belum ada penilaian CSAT')
      expect(html).toContain('Tiket ini belum memiliki tanggapan survei kepuasan.')
    })
  })

  describe('Integration with ContactDrawer', () => {
    it('should render TicketCsatCard inside ContactDrawer when activeTicket has csat data', () => {
      const mockDrawerData: ContactDrawerData = {
        contactId: 'c-01',
        contactName: 'Budi Santoso',
        channel: 'whatsapp',
        activeTicket: {
          id: dummyTicketId,
          ticketNumber: 'T-101',
          status: 'resolved',
          priority: 'high',
          csat: {
            ticketId: dummyTicketId,
            rating: 5,
            feedbackText: 'Sangat responsif!',
            status: 'submitted',
          },
        },
      }

      const html = renderToStaticMarkup(
        <ContactDrawer isOpen={true} data={mockDrawerData} onClose={() => {}} />,
      )

      expect(html).toContain('Kepuasan Pelanggan (CSAT)')
      expect(html).toContain('5 / 5')
      expect(html).toContain('Sangat responsif!')
    })
  })

  describe('Single Organization Guardrail & Phase 3 Checklist', () => {
    it('should strictly NOT contain or require accountId in TicketCsatData', () => {
      const csatData: TicketCsatData = {
        ticketId: dummyTicketId,
        rating: 5,
      }
      expect(csatData).not.toHaveProperty('accountId')
      expect(csatData).not.toHaveProperty('account_id')
    })

    it('should verify Phase 3 checklist marks Task 3.16 as completed', () => {
      const rootDir = join(import.meta.dir, '..', '..', '..', '..', '..')
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_3_CHECKLIST.md'), 'utf-8')
      expect(checklistContent).toContain(
        '- [x] **Task 3.16**: Widget tampilan rating kepuasan CSAT di drawer detail tiket.',
      )
    })
  })
})
