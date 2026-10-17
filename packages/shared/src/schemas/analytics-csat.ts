import { z } from 'zod'

// ==========================================
// Phase 3: Customer Satisfaction (CSAT) Surveys (Task 3.6)
// ==========================================

export const CsatRatingSchema = z
  .number()
  .int('Rating harus berupa bilangan bulat')
  .min(1, 'Rating minimal 1')
  .max(5, 'Rating maksimal 5')
export type CsatRating = z.infer<typeof CsatRatingSchema>

export const SubmitCsatSurveyInputSchema = z.object({
  ticketId: z.string().uuid('Ticket ID harus berformat UUID yang valid'),
  rating: CsatRatingSchema,
  feedbackText: z
    .string()
    .max(2000, 'Teks umpan balik maksimal 2000 karakter')
    .nullable()
    .optional(),
})
export type SubmitCsatSurveyInput = z.infer<typeof SubmitCsatSurveyInputSchema>

export const CreateCsatSurveyInputSchema = z.object({
  ticketId: z.string().uuid('Ticket ID harus berformat UUID yang valid'),
  contactId: z.string().uuid('Contact ID harus berformat UUID yang valid'),
  rating: CsatRatingSchema,
  feedbackText: z
    .string()
    .max(2000, 'Teks umpan balik maksimal 2000 karakter')
    .nullable()
    .optional(),
  submittedAt: z.string().or(z.date()).optional(),
})
export type CreateCsatSurveyInput = z.infer<typeof CreateCsatSurveyInputSchema>

export const UpdateCsatSurveyInputSchema = z.object({
  rating: CsatRatingSchema.optional(),
  feedbackText: z
    .string()
    .max(2000, 'Teks umpan balik maksimal 2000 karakter')
    .nullable()
    .optional(),
})
export type UpdateCsatSurveyInput = z.infer<typeof UpdateCsatSurveyInputSchema>

export const CsatSurveySchema = z.object({
  id: z.string().uuid(),
  ticketId: z.string().uuid(),
  contactId: z.string().uuid(),
  rating: CsatRatingSchema,
  feedbackText: z.string().nullable().optional(),
  submittedAt: z.string().or(z.date()),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type CsatSurvey = z.infer<typeof CsatSurveySchema>

export const CsatSurveyMetricsSchema = z.object({
  totalSurveys: z.number().int().nonnegative(),
  averageRating: z.number().min(0).max(5),
  csatScorePercentage: z.number().min(0).max(100),
  ratingDistribution: z.record(z.string(), z.number().int()),
})
export type CsatSurveyMetrics = z.infer<typeof CsatSurveyMetricsSchema>

// ==========================================
// Phase 4: Reporting & Metrics Filters (Task 4.5)
// ==========================================

export const ReportMetricTypeSchema = z.enum([
  'conversations_count',
  'incoming_messages_count',
  'outgoing_messages_count',
  'first_response_time',
  'resolution_time',
  'csat_score',
])
export type ReportMetricType = z.infer<typeof ReportMetricTypeSchema>

export const ReportGroupBySchema = z.enum([
  'day',
  'week',
  'month',
  'year',
  'agent',
  'inbox',
  'team',
  'label',
])
export type ReportGroupBy = z.infer<typeof ReportGroupBySchema>

export const ReportFilterQueryRawSchema = z.object({
  since: z.string().or(z.date()).optional(),
  until: z.string().or(z.date()).optional(),
  agentId: z.string().uuid('Agent ID harus berformat UUID yang valid').optional(),
  userId: z.string().uuid('User ID harus berformat UUID yang valid').optional(),
  inboxId: z.string().uuid('Inbox ID harus berformat UUID yang valid').optional(),
  teamId: z.string().uuid('Team ID harus berformat UUID yang valid').optional(),
  labelId: z.string().uuid('Label ID harus berformat UUID yang valid').optional(),
  type: ReportMetricTypeSchema.optional(),
  groupBy: ReportGroupBySchema.optional(),
})

export const ReportFilterQuerySchema = ReportFilterQueryRawSchema.refine(
  (data) => {
    if (data.since && data.until) {
      const sinceDate = new Date(data.since)
      const untilDate = new Date(data.until)
      return sinceDate.getTime() <= untilDate.getTime()
    }
    return true
  },
  {
    message: 'Waktu mulai (since) tidak boleh lebih besar dari waktu selesai (until)',
    path: ['since'],
  },
)
export type ReportFilterQuery = z.infer<typeof ReportFilterQueryRawSchema>

export const ReportingEventSchema = z.object({
  id: z.string().uuid(),
  eventType: z.string(),
  conversationId: z.string().uuid().nullable().optional(),
  ticketId: z.string().uuid().nullable().optional(),
  userId: z.string().uuid().nullable().optional(),
  inboxId: z.string().uuid().nullable().optional(),
  valueInSeconds: z.number().int().nullable().optional(),
  createdAt: z.string().or(z.date()),
})
export type ReportingEvent = z.infer<typeof ReportingEventSchema>

export const ReportingMetricSummarySchema = z.object({
  conversationsCount: z.number().int().nonnegative().default(0),
  incomingMessagesCount: z.number().int().nonnegative().default(0),
  outgoingMessagesCount: z.number().int().nonnegative().default(0),
  avgFirstResponseTimeSeconds: z.number().nonnegative().default(0),
  avgResolutionTimeSeconds: z.number().nonnegative().default(0),
  avgCsatScore: z.number().min(0).max(5).default(0),
  totalResolvedTickets: z.number().int().nonnegative().default(0),
})
export type ReportingMetricSummary = z.infer<typeof ReportingMetricSummarySchema>

export const ReportingDataPointSchema = z.object({
  timestamp: z.string().or(z.date()),
  value: z.number(),
  count: z.number().int().optional(),
  agentId: z.string().uuid().optional(),
  inboxId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
})
export type ReportingDataPoint = z.infer<typeof ReportingDataPointSchema>
