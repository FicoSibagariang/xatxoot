import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CreateCsatSurveyInputSchema,
  CsatRatingSchema,
  CsatSurveyMetricsSchema,
  CsatSurveySchema,
  SubmitCsatSurveyInputSchema,
  UpdateCsatSurveyInputSchema,
} from './schemas'

describe('CSAT Survey Validation Schemas (Task 3.6 - packages/shared)', () => {
  const validTicketId = '123e4567-e89b-12d3-a456-426614174001'
  const validContactId = '123e4567-e89b-12d3-a456-426614174002'
  const validSurveyId = '123e4567-e89b-12d3-a456-426614174003'

  describe('CsatRatingSchema', () => {
    it('should accept valid integer ratings from 1 to 5', () => {
      for (let rating = 1; rating <= 5; rating++) {
        const result = CsatRatingSchema.safeParse(rating)
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data).toBe(rating)
        }
      }
    })

    it('should reject ratings below 1', () => {
      expect(CsatRatingSchema.safeParse(0).success).toBe(false)
      expect(CsatRatingSchema.safeParse(-1).success).toBe(false)
      expect(CsatRatingSchema.safeParse(-5).success).toBe(false)
    })

    it('should reject ratings above 5', () => {
      expect(CsatRatingSchema.safeParse(6).success).toBe(false)
      expect(CsatRatingSchema.safeParse(10).success).toBe(false)
      expect(CsatRatingSchema.safeParse(100).success).toBe(false)
    })

    it('should reject non-integer numbers (floating points)', () => {
      expect(CsatRatingSchema.safeParse(3.5).success).toBe(false)
      expect(CsatRatingSchema.safeParse(4.2).success).toBe(false)
      expect(CsatRatingSchema.safeParse(1.1).success).toBe(false)
    })

    it('should reject non-numeric values', () => {
      expect(CsatRatingSchema.safeParse('5').success).toBe(false)
      expect(CsatRatingSchema.safeParse(null).success).toBe(false)
      expect(CsatRatingSchema.safeParse(undefined).success).toBe(false)
      expect(CsatRatingSchema.safeParse({}).success).toBe(false)
    })
  })

  describe('SubmitCsatSurveyInputSchema', () => {
    it('should validate valid submission with rating and feedback text', () => {
      const input = {
        ticketId: validTicketId,
        rating: 5,
        feedbackText: 'Pelayanan sangat cepat, ramah, dan solutif!',
      }

      const result = SubmitCsatSurveyInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.ticketId).toBe(validTicketId)
        expect(result.data.rating).toBe(5)
        expect(result.data.feedbackText).toBe('Pelayanan sangat cepat, ramah, dan solutif!')
      }
    })

    it('should validate valid submission with rating only (feedbackText omitted)', () => {
      const input = {
        ticketId: validTicketId,
        rating: 4,
      }

      const result = SubmitCsatSurveyInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.ticketId).toBe(validTicketId)
        expect(result.data.rating).toBe(4)
        expect(result.data.feedbackText).toBeUndefined()
      }
    })

    it('should validate submission with null feedbackText', () => {
      const input = {
        ticketId: validTicketId,
        rating: 3,
        feedbackText: null,
      }

      const result = SubmitCsatSurveyInputSchema.safeParse(input)
      expect(result.success).toBe(true)
    })

    it('should reject submission with invalid ticketId (non-UUID)', () => {
      const input = {
        ticketId: 'invalid-ticket-uuid',
        rating: 5,
      }

      const result = SubmitCsatSurveyInputSchema.safeParse(input)
      expect(result.success).toBe(false)
    })

    it('should reject submission with invalid rating', () => {
      const input = {
        ticketId: validTicketId,
        rating: 0,
      }

      const result = SubmitCsatSurveyInputSchema.safeParse(input)
      expect(result.success).toBe(false)
    })

    it('should reject submission when feedbackText exceeds 2000 characters', () => {
      const longText = 'a'.repeat(2001)
      const input = {
        ticketId: validTicketId,
        rating: 2,
        feedbackText: longText,
      }

      const result = SubmitCsatSurveyInputSchema.safeParse(input)
      expect(result.success).toBe(false)
    })
  })

  describe('CreateCsatSurveyInputSchema', () => {
    it('should validate valid creation payload with ticketId, contactId, and rating', () => {
      const input = {
        ticketId: validTicketId,
        contactId: validContactId,
        rating: 5,
        feedbackText: 'Sangat puas dengan bantuan agent.',
      }

      const result = CreateCsatSurveyInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.ticketId).toBe(validTicketId)
        expect(result.data.contactId).toBe(validContactId)
        expect(result.data.rating).toBe(5)
      }
    })

    it('should accept optional submittedAt timestamp', () => {
      const input = {
        ticketId: validTicketId,
        contactId: validContactId,
        rating: 4,
        submittedAt: '2026-10-11T12:00:00Z',
      }

      const result = CreateCsatSurveyInputSchema.safeParse(input)
      expect(result.success).toBe(true)
    })

    it('should reject creation without contactId or invalid contactId', () => {
      expect(
        CreateCsatSurveyInputSchema.safeParse({
          ticketId: validTicketId,
          rating: 4,
        }).success,
      ).toBe(false)

      expect(
        CreateCsatSurveyInputSchema.safeParse({
          ticketId: validTicketId,
          contactId: 'not-a-uuid',
          rating: 4,
        }).success,
      ).toBe(false)
    })
  })

  describe('UpdateCsatSurveyInputSchema', () => {
    it('should allow partial update of rating or feedbackText', () => {
      const update1 = { rating: 5 }
      expect(UpdateCsatSurveyInputSchema.safeParse(update1).success).toBe(true)

      const update2 = { feedbackText: 'Revisi komentar feedback' }
      expect(UpdateCsatSurveyInputSchema.safeParse(update2).success).toBe(true)

      const update3 = { rating: 1, feedbackText: 'Ternyata masalah belum tuntas' }
      expect(UpdateCsatSurveyInputSchema.safeParse(update3).success).toBe(true)
    })

    it('should reject invalid rating on update', () => {
      expect(UpdateCsatSurveyInputSchema.safeParse({ rating: 7 }).success).toBe(false)
    })
  })

  describe('CsatSurvey Entity Schema', () => {
    it('should validate complete CsatSurvey database record', () => {
      const entity = {
        id: validSurveyId,
        ticketId: validTicketId,
        contactId: validContactId,
        rating: 5,
        feedbackText: 'Pelayanan prima!',
        submittedAt: '2026-10-11T12:00:00Z',
        createdAt: '2026-10-11T12:00:00Z',
        updatedAt: '2026-10-11T12:00:00Z',
      }

      const result = CsatSurveySchema.safeParse(entity)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe(validSurveyId)
        expect(result.data.rating).toBe(5)
      }
    })

    it('should reject entity with invalid UUIDs', () => {
      const entity = {
        id: 'bad-id',
        ticketId: validTicketId,
        contactId: validContactId,
        rating: 5,
        submittedAt: '2026-10-11T12:00:00Z',
        createdAt: '2026-10-11T12:00:00Z',
        updatedAt: '2026-10-11T12:00:00Z',
      }

      expect(CsatSurveySchema.safeParse(entity).success).toBe(false)
    })
  })

  describe('CsatSurveyMetricsSchema', () => {
    it('should validate aggregate metrics for reporting and dashboard', () => {
      const metrics = {
        totalSurveys: 120,
        averageRating: 4.65,
        csatScorePercentage: 91.5,
        ratingDistribution: {
          '1': 3,
          '2': 2,
          '3': 5,
          '4': 30,
          '5': 80,
        },
      }

      const result = CsatSurveyMetricsSchema.safeParse(metrics)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.totalSurveys).toBe(120)
        expect(result.data.averageRating).toBe(4.65)
        expect(result.data.csatScorePercentage).toBe(91.5)
      }
    })

    it('should reject invalid percentages or ratings in metrics', () => {
      expect(
        CsatSurveyMetricsSchema.safeParse({
          totalSurveys: 10,
          averageRating: 5.5, // > 5
          csatScorePercentage: 90,
          ratingDistribution: {},
        }).success,
      ).toBe(false)

      expect(
        CsatSurveyMetricsSchema.safeParse({
          totalSurveys: 10,
          averageRating: 4.0,
          csatScorePercentage: 110, // > 100
          ratingDistribution: {},
        }).success,
      ).toBe(false)
    })
  })

  describe('Single Organization Guardrail & Phase 3 Checklist', () => {
    it('should strictly NOT contain or require accountId in any CSAT survey schema', () => {
      expect(SubmitCsatSurveyInputSchema.shape).not.toHaveProperty('accountId')
      expect(SubmitCsatSurveyInputSchema.shape).not.toHaveProperty('account_id')
      expect(CreateCsatSurveyInputSchema.shape).not.toHaveProperty('accountId')
      expect(CreateCsatSurveyInputSchema.shape).not.toHaveProperty('account_id')
      expect(UpdateCsatSurveyInputSchema.shape).not.toHaveProperty('accountId')
      expect(UpdateCsatSurveyInputSchema.shape).not.toHaveProperty('account_id')
      expect(CsatSurveySchema.shape).not.toHaveProperty('accountId')
      expect(CsatSurveySchema.shape).not.toHaveProperty('account_id')
    })

    it('should verify Phase 3 checklist marks Task 3.6 as completed', () => {
      const rootDir = join(import.meta.dir, '..', '..', '..')
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_3_CHECKLIST.md'), 'utf-8')
      expect(checklistContent).toContain(
        '- [x] **Task 3.6**: Skema validasi input tanggapan CSAT survey.',
      )
    })
  })
})
