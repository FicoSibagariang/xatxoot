import {
  type CsatRating,
  CsatRatingSchema,
  type CsatSurvey,
  type CsatSurveyMetrics,
  type Ticket,
} from '@xatxoot/shared'
import { sql, toIsoString, toValidUuid } from '../../db'
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

function mapInviteRow(row: Record<string, unknown>): CsatInvite {
  return {
    id: String(row.id),
    ticketId: String(row.ticketId),
    contactId: (row.contactId as string | null) ?? null,
    inboxId: (row.inboxId as string | null) ?? null,
    token: String(row.token),
    status: row.status as CsatInvite['status'],
    inviteUrl: String(row.inviteUrl),
    createdAt: toIsoString(row.createdAt) || (row.createdAt as string),
    updatedAt: toIsoString(row.updatedAt) || (row.updatedAt as string),
    expiresAt: toIsoString(row.expiresAt) || (row.expiresAt as string),
  }
}

function mapSurveyRow(row: Record<string, unknown>): CsatSurvey {
  return {
    id: String(row.id),
    ticketId: String(row.ticketId),
    contactId: (row.contactId as string | null) ?? null,
    rating: Number(row.rating) as CsatRating,
    feedbackText: (row.feedbackText as string | null) ?? null,
    submittedAt: toIsoString(row.submittedAt) || (row.submittedAt as string),
    createdAt: toIsoString(row.createdAt) || (row.createdAt as string),
    updatedAt: toIsoString(row.updatedAt) || (row.updatedAt as string),
  }
}

async function ensureContactExists(contactId: string): Promise<void> {
  const validContactId = toValidUuid(contactId)
  await sql`
    INSERT INTO contacts (id, name, created_at, updated_at)
    VALUES (${validContactId}, 'Contact ' || ${validContactId}, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `
}

async function ensureInboxExists(inboxId: string): Promise<void> {
  const validInboxId = toValidUuid(inboxId)
  await sql`
    INSERT INTO inboxes (id, name, channel_type, channel_id, created_at, updated_at)
    VALUES (${validInboxId}, 'Inbox ' || ${validInboxId}, 'api', ${crypto.randomUUID()}, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `
}

async function ensureTicketExists(ticketId: string): Promise<void> {
  const validTicketId = toValidUuid(ticketId)
  const defaultConvId = '00000000-0000-0000-0000-000000000001'
  const defaultInboxId = '00000000-0000-0000-0000-000000000001'
  await sql`
    INSERT INTO inboxes (id, name, channel_type, channel_id)
    VALUES (${defaultInboxId}, 'Default Inbox', 'api', ${crypto.randomUUID()})
    ON CONFLICT (id) DO NOTHING
  `
  await sql`
    INSERT INTO conversations (id, inbox_id)
    VALUES (${defaultConvId}, ${defaultInboxId})
    ON CONFLICT (id) DO NOTHING
  `
  await sql`
    INSERT INTO tickets (id, conversation_id, status)
    VALUES (${validTicketId}, ${defaultConvId}, 'open')
    ON CONFLICT (id) DO NOTHING
  `
}

export async function resetCsatStore(): Promise<void> {
  await sql`DELETE FROM csat_surveys`
  await sql`DELETE FROM csat_invites`
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
    const validTicketId = toValidUuid(params.ticketId)
    const existing = await this.getInviteByTicketId(validTicketId)
    if (existing) {
      return existing
    }

    await ensureTicketExists(validTicketId)

    let contactId: string | null = null
    if (params.contactId) {
      contactId = toValidUuid(params.contactId)
      await ensureContactExists(contactId)
    }

    let inboxId: string | null = null
    if (params.inboxId) {
      inboxId = toValidUuid(params.inboxId)
      await ensureInboxExists(inboxId)
    }

    const id = crypto.randomUUID()
    const token = this.engine.generateToken()
    const now = new Date()
    const DEFAULT_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
    const expirationMs =
      params.expiresInMs !== undefined ? params.expiresInMs : DEFAULT_EXPIRATION_MS
    const expiresAt = new Date(now.getTime() + expirationMs).toISOString()
    const inviteUrl = `/csat/${token}`

    const rows = await sql`
      INSERT INTO csat_invites (
        id, ticket_id, contact_id, inbox_id, token, status, invite_url, expires_at, created_at, updated_at
      ) VALUES (
        ${id}, ${validTicketId}, ${contactId}, ${inboxId},
        ${token}, 'pending', ${inviteUrl}, ${expiresAt}, ${now.toISOString()}, ${now.toISOString()}
      )
      RETURNING
        id, ticket_id as "ticketId", contact_id as "contactId", inbox_id as "inboxId",
        token, status, invite_url as "inviteUrl", expires_at as "expiresAt",
        created_at as "createdAt", updated_at as "updatedAt"
    `

    const invite = mapInviteRow(rows[0])

    realtimeService.broadcast({
      event: 'csat.invite.created',
      data: { invite },
    })

    return invite
  }

  async getInviteByToken(token: string): Promise<CsatInvite | null> {
    const rows = await sql`
      SELECT
        id, ticket_id as "ticketId", contact_id as "contactId", inbox_id as "inboxId",
        token, status, invite_url as "inviteUrl", expires_at as "expiresAt",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM csat_invites
      WHERE token = ${token}
      LIMIT 1
    `
    if (rows && rows.length > 0) {
      return mapInviteRow(rows[0])
    }
    return null
  }

  async getInviteByTicketId(ticketId: string): Promise<CsatInvite | null> {
    const validTicketId = toValidUuid(ticketId)
    const rows = await sql`
      SELECT
        id, ticket_id as "ticketId", contact_id as "contactId", inbox_id as "inboxId",
        token, status, invite_url as "inviteUrl", expires_at as "expiresAt",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM csat_invites
      WHERE ticket_id = ${validTicketId}
      LIMIT 1
    `
    if (rows && rows.length > 0) {
      return mapInviteRow(rows[0])
    }
    return null
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
    let contactId = invite.contactId || null
    if (contactId) {
      contactId = toValidUuid(contactId)
      await ensureContactExists(contactId)
    }

    const surveyRows = await sql`
      INSERT INTO csat_surveys (
        id, ticket_id, contact_id, rating, feedback_text, submitted_at, created_at, updated_at
      ) VALUES (
        ${id}, ${invite.ticketId}, ${contactId}, ${parsedRating.data},
        ${params.feedbackText ?? null}, ${submittedAtIso}, ${submittedAtIso}, ${submittedAtIso}
      )
      RETURNING
        id, ticket_id as "ticketId", contact_id as "contactId", rating,
        feedback_text as "feedbackText", submitted_at as "submittedAt",
        created_at as "createdAt", updated_at as "updatedAt"
    `

    const survey = mapSurveyRow(surveyRows[0])

    await sql`
      UPDATE csat_invites
      SET status = 'submitted', updated_at = ${submittedAtIso}
      WHERE id = ${invite.id}
    `

    realtimeService.broadcast({
      event: 'csat.survey.submitted',
      data: { survey },
    })

    return survey
  }

  async getSurveyByTicketId(ticketId: string): Promise<CsatSurvey | null> {
    const validTicketId = toValidUuid(ticketId)
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
      WHERE ticket_id = ${validTicketId}
      LIMIT 1
    `
    if (rows && rows.length > 0) {
      return mapSurveyRow(rows[0])
    }

    return null
  }

  async getMetrics(): Promise<CsatSurveyMetrics> {
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
    const surveys = (rows || []).map(mapSurveyRow)
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
