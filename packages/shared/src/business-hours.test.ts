import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BusinessHoursSchema,
  CreateBusinessHoursInputSchema,
  DayOfWeekSchema,
  DayScheduleSchema,
  UpdateBusinessHoursInputSchema,
  WeeklyScheduleSchema,
} from './schemas'

describe('Business Hours Weekly Schedule Schemas (Task 3.5 - packages/shared)', () => {
  describe('DayOfWeekSchema', () => {
    it('should accept valid integers from 0 to 6 (Sunday to Saturday)', () => {
      for (let day = 0; day <= 6; day++) {
        expect(DayOfWeekSchema.safeParse(day).success).toBe(true)
      }
    })

    it('should accept valid day name strings (monday - sunday, case-insensitive or lowercase)', () => {
      const dayNames = [
        'sunday',
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
      ]
      for (const name of dayNames) {
        expect(DayOfWeekSchema.safeParse(name).success).toBe(true)
      }
    })

    it('should reject numbers outside 0 to 6', () => {
      expect(DayOfWeekSchema.safeParse(-1).success).toBe(false)
      expect(DayOfWeekSchema.safeParse(7).success).toBe(false)
      expect(DayOfWeekSchema.safeParse(10).success).toBe(false)
    })

    it('should reject invalid day strings', () => {
      expect(DayOfWeekSchema.safeParse('funday').success).toBe(false)
      expect(DayOfWeekSchema.safeParse('weekend').success).toBe(false)
      expect(DayOfWeekSchema.safeParse('').success).toBe(false)
    })
  })

  describe('DayScheduleSchema', () => {
    it('should validate valid DaySchedule with 24-hour time strings', () => {
      const validDay = {
        dayOfWeek: 1, // Monday
        openTime: '08:30',
        closeTime: '17:00',
        isEnabled: true,
      }

      const result = DayScheduleSchema.safeParse(validDay)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.dayOfWeek).toBe(1)
        expect(result.data.openTime).toBe('08:30')
        expect(result.data.closeTime).toBe('17:00')
        expect(result.data.isEnabled).toBe(true)
      }
    })

    it('should validate valid DaySchedule with day name string', () => {
      const validDay = {
        dayOfWeek: 'friday',
        openTime: '09:00',
        closeTime: '16:30',
        isEnabled: true,
      }

      const result = DayScheduleSchema.safeParse(validDay)
      expect(result.success).toBe(true)
    })

    it('should reject invalid time formats', () => {
      const invalidTimes = [
        '8:00', // must be 2-digit HH
        '08:60', // minutes > 59
        '24:00', // hours > 23
        '25:00',
        '08-00',
        'random',
        '',
      ]

      for (const badTime of invalidTimes) {
        expect(
          DayScheduleSchema.safeParse({
            dayOfWeek: 1,
            openTime: badTime,
            closeTime: '17:00',
            isEnabled: true,
          }).success,
        ).toBe(false)

        expect(
          DayScheduleSchema.safeParse({
            dayOfWeek: 1,
            openTime: '08:00',
            closeTime: badTime,
            isEnabled: true,
          }).success,
        ).toBe(false)
      }
    })

    it('should reject when closeTime is before or equal to openTime if isEnabled is true', () => {
      // closeTime before openTime
      const result1 = DayScheduleSchema.safeParse({
        dayOfWeek: 1,
        openTime: '17:00',
        closeTime: '09:00',
        isEnabled: true,
      })
      expect(result1.success).toBe(false)

      // closeTime equals openTime
      const result2 = DayScheduleSchema.safeParse({
        dayOfWeek: 1,
        openTime: '09:00',
        closeTime: '09:00',
        isEnabled: true,
      })
      expect(result2.success).toBe(false)
    })

    it('should allow arbitrary openTime and closeTime when isEnabled is false', () => {
      const disabledDay = {
        dayOfWeek: 0, // Sunday
        openTime: '00:00',
        closeTime: '00:00',
        isEnabled: false,
      }

      const result = DayScheduleSchema.safeParse(disabledDay)
      expect(result.success).toBe(true)
    })

    it('should allow 24-hour operation when openAllDay is true', () => {
      const allDaySchedule = {
        dayOfWeek: 2,
        openTime: '00:00',
        closeTime: '23:59',
        isEnabled: true,
        openAllDay: true,
      }

      const result = DayScheduleSchema.safeParse(allDaySchedule)
      expect(result.success).toBe(true)
    })
  })

  describe('WeeklyScheduleSchema', () => {
    it('should accept valid array of 7 distinct days', () => {
      const week = [
        { dayOfWeek: 0, openTime: '00:00', closeTime: '00:00', isEnabled: false },
        { dayOfWeek: 1, openTime: '08:00', closeTime: '17:00', isEnabled: true },
        { dayOfWeek: 2, openTime: '08:00', closeTime: '17:00', isEnabled: true },
        { dayOfWeek: 3, openTime: '08:00', closeTime: '17:00', isEnabled: true },
        { dayOfWeek: 4, openTime: '08:00', closeTime: '17:00', isEnabled: true },
        { dayOfWeek: 5, openTime: '08:00', closeTime: '17:00', isEnabled: true },
        { dayOfWeek: 6, openTime: '09:00', closeTime: '14:00', isEnabled: true },
      ]

      const result = WeeklyScheduleSchema.safeParse(week)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.length).toBe(7)
      }
    })

    it('should accept empty array as default weekly schedule', () => {
      const result = WeeklyScheduleSchema.safeParse([])
      expect(result.success).toBe(true)
    })

    it('should reject schedule with duplicate dayOfWeek', () => {
      const duplicateDays = [
        { dayOfWeek: 1, openTime: '08:00', closeTime: '12:00', isEnabled: true },
        { dayOfWeek: 1, openTime: '13:00', closeTime: '17:00', isEnabled: true },
      ]

      const result = WeeklyScheduleSchema.safeParse(duplicateDays)
      expect(result.success).toBe(false)
    })

    it('should reject schedule with more than 7 days', () => {
      const tooManyDays = [
        { dayOfWeek: 0, openTime: '08:00', closeTime: '17:00', isEnabled: true },
        { dayOfWeek: 1, openTime: '08:00', closeTime: '17:00', isEnabled: true },
        { dayOfWeek: 2, openTime: '08:00', closeTime: '17:00', isEnabled: true },
        { dayOfWeek: 3, openTime: '08:00', closeTime: '17:00', isEnabled: true },
        { dayOfWeek: 4, openTime: '08:00', closeTime: '17:00', isEnabled: true },
        { dayOfWeek: 5, openTime: '08:00', closeTime: '17:00', isEnabled: true },
        { dayOfWeek: 6, openTime: '08:00', closeTime: '17:00', isEnabled: true },
        { dayOfWeek: 'monday', openTime: '08:00', closeTime: '17:00', isEnabled: true },
      ]

      const result = WeeklyScheduleSchema.safeParse(tooManyDays)
      expect(result.success).toBe(false)
    })
  })

  describe('CreateBusinessHoursInputSchema & UpdateBusinessHoursInputSchema', () => {
    const validInboxId = '123e4567-e89b-12d3-a456-426614174000'

    it('should validate valid CreateBusinessHoursInput with default values', () => {
      const input = {
        inboxId: validInboxId,
      }

      const result = CreateBusinessHoursInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.inboxId).toBe(validInboxId)
        expect(result.data.timezone).toBe('Asia/Jakarta')
        expect(result.data.weeklySchedule).toEqual([])
        expect(result.data.enabled).toBe(true)
        expect(result.data.outOfOfficeMessage).toContain('Halo, terima kasih')
      }
    })

    it('should validate full custom CreateBusinessHoursInput', () => {
      const input = {
        inboxId: validInboxId,
        timezone: 'Asia/Makassar',
        weeklySchedule: [
          { dayOfWeek: 1, openTime: '08:00', closeTime: '17:00', isEnabled: true },
          { dayOfWeek: 2, openTime: '08:00', closeTime: '17:00', isEnabled: true },
        ],
        outOfOfficeMessage: 'Kantor sedang tutup saat ini.',
        enabled: true,
      }

      const result = CreateBusinessHoursInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.timezone).toBe('Asia/Makassar')
        expect(result.data.weeklySchedule.length).toBe(2)
        expect(result.data.outOfOfficeMessage).toBe('Kantor sedang tutup saat ini.')
      }
    })

    it('should reject invalid inboxId (non-UUID)', () => {
      const result = CreateBusinessHoursInputSchema.safeParse({
        inboxId: 'invalid-uuid-format',
      })
      expect(result.success).toBe(false)
    })

    it('should validate partial UpdateBusinessHoursInput', () => {
      const updateData = {
        enabled: false,
        outOfOfficeMessage: 'Maaf, layanan offline sementara.',
      }

      const result = UpdateBusinessHoursInputSchema.safeParse(updateData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.enabled).toBe(false)
        expect(result.data.outOfOfficeMessage).toBe('Maaf, layanan offline sementara.')
      }
    })
  })

  describe('BusinessHours Entity Schema', () => {
    it('should validate complete BusinessHours entity', () => {
      const entity = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        inboxId: '123e4567-e89b-12d3-a456-426614174002',
        timezone: 'Asia/Jakarta',
        weeklySchedule: [{ dayOfWeek: 1, openTime: '08:00', closeTime: '17:00', isEnabled: true }],
        outOfOfficeMessage: 'Saat ini kami sedang di luar jam kerja operasional.',
        enabled: true,
        createdAt: '2026-10-10T10:00:00Z',
        updatedAt: '2026-10-10T10:00:00Z',
      }

      const result = BusinessHoursSchema.safeParse(entity)
      expect(result.success).toBe(true)
    })
  })

  describe('Single Organization Guardrail & Phase 3 Checklist', () => {
    it('should strictly NOT contain or require accountId in any business hours schema', () => {
      expect(CreateBusinessHoursInputSchema.shape).not.toHaveProperty('accountId')
      expect(CreateBusinessHoursInputSchema.shape).not.toHaveProperty('account_id')
      expect(UpdateBusinessHoursInputSchema.shape).not.toHaveProperty('accountId')
      expect(UpdateBusinessHoursInputSchema.shape).not.toHaveProperty('account_id')
      expect(BusinessHoursSchema.shape).not.toHaveProperty('accountId')
      expect(BusinessHoursSchema.shape).not.toHaveProperty('account_id')
    })

    it('should verify Phase 3 checklist marks Task 3.5 as completed', () => {
      const rootDir = join(import.meta.dir, '..', '..', '..')
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_3_CHECKLIST.md'), 'utf-8')
      expect(checklistContent).toContain(
        '- [x] **Task 3.5**: Skema validasi struktur jam kerja mingguan',
      )
    })
  })
})
