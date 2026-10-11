import {
  type CsatRating,
  CsatRatingSchema,
  type CsatSurvey,
  type CsatSurveyMetrics,
  type Ticket,
} from '@xatxoot/shared'
import { sql } from '../../db'
import { realtimeService } from '../realtime/realtime.service'

export interface CsatInvite {
  id: string
  ticketId: string
  contactId?: string | null
  inboxId?: string | null
  token: string
  status: 'pending' | 'submitted' | 'expired'
  inviteUrl: string
  createdAt: string
  updatedAt: string
  expiresAt: string
}

export interface CreateInviteParams {
  ticketId: string
  contactId?: string | null
  inboxId?: string | null
  expiresInMs?: number
}

export interface SubmitSurveyParams {
  token: string
  rating: number
  feedbackText?: string | null
}

const memoryStore = {
  invitesByToken: new Map<string, CsatInvite>(),
  invitesByTicketId: new Map<string, CsatInvite>(),
  surveysByTicketId: new Map<string, CsatSurvey>(),
  surveysById: new Map<string, CsatSurvey>(),
}

export function resetCsatStore(): void {
  memoryStore.invitesByToken.clear()
  memoryStore.invitesByTicketId.clear()
  memoryStore.surveysByTicketId.clear()
  memoryStore.surveysById.clear()
}

export class CsatEngine {
  generateToken(): string {
    const rawUuid = crypto.randomUUID().replace(/-/g, '')
    return `csat_${rawUuid}`
  }
}

export class CsatService {
  private engine: CsatEngine

  constructor(engine?: CsatEngine) {
    this.engine = engine || new CsatEngine()
  }

  async createInvite(params: CreateInviteParams): Promise<CsatInvite> {
    const existing = memoryStore.invitesByTicketId.get(params.ticketId)
    if (existing) {
      return existing
    }

    const id = crypto.randomUUID()
    const token = this.engine.generateToken()
    const now = new Date()
    const DEFAULT_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
    const expirationMs =
      params.expiresInMs !== undefined ? params.expiresInMs : DEFAULT_EXPIRATION_MS
    const expiresAt = new Date(now.getTime() + expirationMs).toISOString()

    const invite: CsatInvite = {
      id,
      ticketId: params.ticketId,
      contactId: params.contactId ?? null,
      inboxId: params.inboxId ?? null,
      token,
      status: 'pending',
      inviteUrl: `/csat/${token}`,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt,
    }

    memoryStore.invitesByToken.set(token, invite)
    memoryStore.invitesByTicketId.set(params.ticketId, invite)

    realtimeService.broadcast({
      event: 'csat.invite.created',
      data: { invite },
    })

    return invite
  }

  async getInviteByToken(token: string): Promise<CsatInvite | null> {
    return memoryStore.invitesByToken.get(token) || null
  }

  async getInviteByTicketId(ticketId: string): Promise<CsatInvite | null> {
    return memoryStore.invitesByTicketId.get(ticketId) || null
  }

  async onTicketResolved(ticket: Ticket): Promise<CsatInvite> {
    return this.createInvite({
      ticketId: ticket.id,
      contactId: (ticket as unknown as { contactId?: string }).contactId || null,
    })
  }

  async submitSurvey(params: SubmitSurveyParams): Promise<CsatSurvey> {
    const invite = await this.getInviteByToken(params.token)
    if (!invite) {
      const err = new Error('CSAT invite not found or invalid token')
      ;(err as unknown as { statusCode: number }).statusCode = 404
      throw err
    }

    const now = new Date()
    if (new Date(invite.expiresAt).getTime() < now.getTime()) {
      const err = new Error('CSAT invite has expired')
      ;(err as unknown as { statusCode: number }).statusCode = 410
      throw err
    }

    if (invite.status === 'submitted') {
      const err = new Error('CSAT survey already submitted for this ticket')
      ;(err as unknown as { statusCode: number }).statusCode = 409
      throw err
    }

    const parsedRating = CsatRatingSchema.safeParse(params.rating)
    if (!parsedRating.success) {
      const err = new Error(
        parsedRating.error.issues[0]?.message || 'Invalid rating (must be integer 1-5)',
      )
      ;(err as unknown as { statusCode: number }).statusCode = 400
      throw err
    }

    if (params.feedbackText && params.feedbackText.length > 2000) {
      const err = new Error('Teks umpan balik maksimal 2000 karakter')
      ;(err as unknown as { statusCode: number }).statusCode = 400
      throw err
    }

    const id = crypto.randomUUID()
    const submittedAtIso = now.toISOString()
    const contactId = invite.contactId || crypto.randomUUID()

    const survey: CsatSurvey = {
      id,
      ticketId: invite.ticketId,
      contactId,
      rating: parsedRating.data as CsatRating,
      feedbackText: params.feedbackText ?? null,
      submittedAt: submittedAtIso,
      createdAt: submittedAtIso,
      updatedAt: submittedAtIso,
    }

    // Update invite status
    invite.status = 'submitted'
    invite.updatedAt = submittedAtIso

    memoryStore.surveysById.set(id, survey)
    memoryStore.surveysByTicketId.set(invite.ticketId, survey)

    try {
      await sql`
        INSERT INTO csat_surveys (
          id, ticket_id, contact_id, rating, feedback_text, submitted_at, created_at, updated_at
        ) VALUES (
          ${survey.id}, ${survey.ticketId}, ${survey.contactId}, ${survey.rating},
          ${survey.feedbackText}, ${survey.submittedAt}, ${survey.createdAt}, ${survey.updatedAt}
        )
      `
    } catch {
      // Memory fallback for tests / offline mode
    }

    realtimeService.broadcast({
      event: 'csat.survey.submitted',
      data: { survey },
    })

    return survey
  }

  async getSurveyByTicketId(ticketId: string): Promise<CsatSurvey | null> {
    try {
      const rows = await sql`
        SELECT
          id,
          ticket_id as "ticketId",
          contact_id as "contactId",
          rating,
          feedback_text as "feedbackText",
          submitted_at as "submittedAt",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM csat_surveys
        WHERE ticket_id = ${ticketId}
        LIMIT 1
      `
      if (rows.length > 0) {
        return rows[0] as unknown as CsatSurvey
      }
    } catch {
      // Memory fallback
    }

    return memoryStore.surveysByTicketId.get(ticketId) || null
  }

  async getMetrics(): Promise<CsatSurveyMetrics> {
    let surveys = Array.from(memoryStore.surveysById.values())

    try {
      const rows = await sql`
        SELECT
          id,
          ticket_id as "ticketId",
          contact_id as "contactId",
          rating,
          feedback_text as "feedbackText",
          submitted_at as "submittedAt",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM csat_surveys
      `
      if (rows.length > 0) {
        surveys = rows as unknown as CsatSurvey[]
      }
    } catch {
      // Use memory surveys
    }

    const totalSurveys = surveys.length
    if (totalSurveys === 0) {
      return {
        totalSurveys: 0,
        averageRating: 0,
        csatScorePercentage: 0,
        ratingDistribution: {
          '1': 0,
          '2': 0,
          '3': 0,
          '4': 0,
          '5': 0,
        },
      }
    }

    const distribution: Record<string, number> = {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    }

    let ratingSum = 0
    let satisfiedCount = 0 // Rating 4 and 5

    for (const survey of surveys) {
      const r = String(survey.rating)
      distribution[r] = (distribution[r] || 0) + 1
      ratingSum += survey.rating
      if (survey.rating >= 4) {
        satisfiedCount += 1
      }
    }

    const averageRating = Number((ratingSum / totalSurveys).toFixed(2))
    const csatScorePercentage = Number(((satisfiedCount / totalSurveys) * 100).toFixed(2))

    return {
      totalSurveys,
      averageRating,
      csatScorePercentage,
      ratingDistribution: distribution,
    }
  }
}

export const csatService = new CsatService()
