import { z } from 'zod'

// ==========================================
// Phase 3: Business Hours & Weekly Schedule (Task 3.5)
// ==========================================

export const DayOfWeekNameSchema = z.enum([
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
])
export type DayOfWeekName = z.infer<typeof DayOfWeekNameSchema>

export const DayOfWeekSchema = z.union([z.number().int().min(0).max(6), DayOfWeekNameSchema])
export type DayOfWeek = z.infer<typeof DayOfWeekSchema>

export const DayScheduleSchema = z
  .object({
    dayOfWeek: DayOfWeekSchema,
    openTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format openTime harus HH:mm (24-jam)'),
    closeTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Format closeTime harus HH:mm (24-jam)'),
    isEnabled: z.boolean().default(true),
    openAllDay: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (!data.isEnabled || data.openAllDay) {
        return true
      }
      return data.closeTime > data.openTime
    },
    {
      message: 'closeTime harus setelah openTime ketika isEnabled aktif',
      path: ['closeTime'],
    },
  )
export type DaySchedule = z.infer<typeof DayScheduleSchema>

export const WeeklyScheduleSchema = z
  .array(DayScheduleSchema)
  .max(7, 'Jadwal mingguan maksimal 7 hari')
  .refine(
    (days) => {
      const seenDays = new Set<number>()
      const dayMap: Record<string, number> = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      }

      for (const day of days) {
        let normalizedDay: number
        if (typeof day.dayOfWeek === 'number') {
          normalizedDay = day.dayOfWeek
        } else {
          normalizedDay = dayMap[day.dayOfWeek.toLowerCase()] ?? -1
        }

        if (seenDays.has(normalizedDay)) {
          return false
        }
        seenDays.add(normalizedDay)
      }
      return true
    },
    {
      message: 'Tidak boleh ada hari yang duplikat dalam jadwal mingguan',
    },
  )
export type WeeklySchedule = z.infer<typeof WeeklyScheduleSchema>

export const CreateBusinessHoursInputSchema = z.object({
  inboxId: z.string().uuid('Inbox ID harus berformat UUID yang valid'),
  timezone: z.string().min(1, 'Timezone wajib diisi').default('Asia/Jakarta'),
  weeklySchedule: WeeklyScheduleSchema.default([]),
  outOfOfficeMessage: z
    .string()
    .min(1, 'Pesan di luar jam kerja wajib diisi')
    .default(
      'Halo, terima kasih telah menghubungi kami. Saat ini kami sedang di luar jam operasional kerja.',
    ),
  enabled: z.boolean().default(true),
})
export type CreateBusinessHoursInput = z.infer<typeof CreateBusinessHoursInputSchema>

export const UpdateBusinessHoursInputSchema = z.object({
  timezone: z.string().min(1).optional(),
  weeklySchedule: WeeklyScheduleSchema.optional(),
  outOfOfficeMessage: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
})
export type UpdateBusinessHoursInput = z.infer<typeof UpdateBusinessHoursInputSchema>

export const BusinessHoursSchema = z.object({
  id: z.string().uuid(),
  inboxId: z.string().uuid(),
  timezone: z.string(),
  weeklySchedule: WeeklyScheduleSchema,
  outOfOfficeMessage: z.string(),
  enabled: z.boolean(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type BusinessHours = z.infer<typeof BusinessHoursSchema>
