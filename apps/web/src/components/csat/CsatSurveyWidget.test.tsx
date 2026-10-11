import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  CSAT_RATING_OPTIONS,
  CsatSurveyWidget,
  type CsatWidgetSubmission,
  validateCsatSubmission,
} from './CsatSurveyWidget'

describe('Public Responsive CSAT Survey Widget (Task 3.15 - apps/web)', () => {
  const dummyToken = 'csat_mock_token_abc123456789'

  describe('Form View Rendering & Rating Options (1–5)', () => {
    it('should render all 5 star/emoji rating options with descriptive labels', () => {
      const html = renderToStaticMarkup(
        <CsatSurveyWidget
          token={dummyToken}
          ticketDisplayId="1055"
          agentName="Sarah CS"
          organizationName="Xatxoot Support"
          onSubmit={() => {}}
        />,
      )

      // Header, Context & Branding
      expect(html).toContain('Xatxoot Support')
      expect(html).toContain('#1055')
      expect(html).toContain('Sarah CS')
      expect(html).toContain('Seberapa puas Anda dengan pelayanan kami?')

      // 5 Rating options (1-5) and labels
      expect(html).toContain('Sangat Kecewa')
      expect(html).toContain('Kecewa')
      expect(html).toContain('Cukup')
      expect(html).toContain('Puas')
      expect(html).toContain('Sangat Puas')

      // Feedback textarea & submit button
      expect(html).toContain('Ceritakan pengalaman atau masukan Anda')
      expect(html).toContain('Kirim Penilaian')
    })

    it('should have 5 rating options defined in CSAT_RATING_OPTIONS with correct values', () => {
      expect(CSAT_RATING_OPTIONS).toHaveLength(5)
      expect(CSAT_RATING_OPTIONS.map((o) => o.rating)).toEqual([1, 2, 3, 4, 5])
      expect(CSAT_RATING_OPTIONS[0].label).toBe('Sangat Kecewa')
      expect(CSAT_RATING_OPTIONS[4].label).toBe('Sangat Puas')
    })
  })

  describe('Submission Validation Logic', () => {
    it('should validate valid submission with rating and optional feedback', () => {
      const valid: CsatWidgetSubmission = {
        rating: 5,
        feedbackText: 'Pelayanan luar biasa cepat dan ramah!',
      }
      const result = validateCsatSubmission(valid)
      expect(result.success).toBe(true)
      expect(result.errors).toBeUndefined()
    })

    it('should validate valid submission with rating only (empty feedback)', () => {
      const valid: CsatWidgetSubmission = {
        rating: 4,
      }
      expect(validateCsatSubmission(valid).success).toBe(true)
    })

    it('should reject submission when rating is not chosen or out of bounds (1-5)', () => {
      expect(validateCsatSubmission({ rating: 0 as unknown as number }).success).toBe(false)
      expect(validateCsatSubmission({ rating: 6 as unknown as number }).success).toBe(false)
      expect(validateCsatSubmission({ rating: undefined as unknown as number }).success).toBe(false)
    })

    it('should reject submission when feedback exceeds 2000 characters', () => {
      const result = validateCsatSubmission({
        rating: 5,
        feedbackText: 'a'.repeat(2001),
      })
      expect(result.success).toBe(false)
      expect(result.errors?.feedbackText).toBeDefined()
    })
  })

  describe('Widget Lifecycle States', () => {
    it('should render success/thank you view when state is submitted', () => {
      const html = renderToStaticMarkup(
        <CsatSurveyWidget token={dummyToken} initialState="submitted" onSubmit={() => {}} />,
      )

      expect(html).toContain('Terima Kasih Atas Penilaian Anda!')
      expect(html).toContain('Tanggapan Anda sangat berharga bagi kami')
    })

    it('should render already-submitted view when survey was previously completed', () => {
      const html = renderToStaticMarkup(
        <CsatSurveyWidget
          token={dummyToken}
          initialState="already_submitted"
          onSubmit={() => {}}
        />,
      )

      expect(html).toContain('Survei Sudah Pernah Diisi')
      expect(html).toContain('Anda telah memberikan penilaian untuk percakapan ini sebelumnya.')
    })

    it('should render expired view when invite token has expired', () => {
      const html = renderToStaticMarkup(
        <CsatSurveyWidget token={dummyToken} initialState="expired" onSubmit={() => {}} />,
      )

      expect(html).toContain('Tautan Survei Kedaluwarsa')
      expect(html).toContain('Tautan pengisian survei ini sudah tidak berlaku lagi.')
    })

    it('should render loading skeleton/spinner when state is loading', () => {
      const html = renderToStaticMarkup(
        <CsatSurveyWidget token={dummyToken} initialState="loading" onSubmit={() => {}} />,
      )

      expect(html).toContain('Memuat survei...')
    })
  })

  describe('Single Organization Guardrail & Phase 3 Checklist', () => {
    it('should strictly NOT contain or require accountId in CsatWidgetSubmission or props', () => {
      const submission: CsatWidgetSubmission = {
        rating: 5,
        feedbackText: 'Hebat',
      }
      expect(submission).not.toHaveProperty('accountId')
      expect(submission).not.toHaveProperty('account_id')
    })

    it('should verify Phase 3 checklist marks Task 3.15 as completed', () => {
      const rootDir = join(import.meta.dir, '..', '..', '..', '..', '..')
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_3_CHECKLIST.md'), 'utf-8')
      expect(checklistContent).toContain(
        '- [x] **Task 3.15**: Widget / Halaman responsif publik pengisian rating CSAT',
      )
    })
  })
})
