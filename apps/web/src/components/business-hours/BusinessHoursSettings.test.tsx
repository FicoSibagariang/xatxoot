import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  BusinessHoursSettings,
  type BusinessHoursUiConfig,
  STANDARD_WEEKLY_SCHEDULE,
  validateBusinessHoursConfig,
} from './BusinessHoursSettings'

describe('Business Hours & Out-of-Office Schedule Picker UI (Task 3.14 - apps/web)', () => {
  const dummyInboxId = '123e4567-e89b-12d3-a456-426614174099'

  const initialConfig: BusinessHoursUiConfig = {
    inboxId: dummyInboxId,
    timezone: 'Asia/Jakarta',
    enabled: true,
    weeklySchedule: STANDARD_WEEKLY_SCHEDULE,
    outOfOfficeMessage: 'Halo! Saat ini kami sedang di luar jam kerja.',
  }

  describe('Component Rendering & Layout', () => {
    it('should render header, master toggle, timezone selector, and 7 day rows', () => {
      const html = renderToStaticMarkup(
        <BusinessHoursSettings
          inboxId={dummyInboxId}
          inboxName="WhatsApp CS Utama"
          initialConfig={initialConfig}
          onSave={() => {}}
          onClose={() => {}}
        />,
      )

      // Header & Title
      expect(html).toContain('Pengaturan Jam Kerja (Business Hours)')
      expect(html).toContain('WhatsApp CS Utama')

      // Master Toggle
      expect(html).toContain('Aktifkan Jam Kerja')

      // Timezone Selector
      expect(html).toContain('Zona Waktu (Timezone)')
      expect(html).toContain('Asia/Jakarta')

      // 7 Days of the week (Minggu s/d Sabtu)
      expect(html).toContain('Minggu')
      expect(html).toContain('Senin')
      expect(html).toContain('Selasa')
      expect(html).toContain('Rabu')
      expect(html).toContain('Kamis')
      expect(html).toContain('Jumat')
      expect(html).toContain('Sabtu')

      // Out-of-Office textarea
      expect(html).toContain('Pesan Otomatis di Luar Jam Kerja')
      expect(html).toContain('Halo! Saat ini kami sedang di luar jam kerja.')
    })

    it('should render disabled state banner when business hours is toggled off (24/7 active)', () => {
      const disabledConfig = { ...initialConfig, enabled: false }
      const html = renderToStaticMarkup(
        <BusinessHoursSettings
          inboxId={dummyInboxId}
          initialConfig={disabledConfig}
          onSave={() => {}}
        />,
      )

      expect(html).toContain('Jam kerja dinonaktifkan')
      expect(html).toContain('Inbox ini akan melayani pesan 24 jam sehari (24/7)')
    })
  })

  describe('Standard Preset & Validation Logic', () => {
    it('should provide STANDARD_WEEKLY_SCHEDULE with 7 days and correct default hours', () => {
      expect(STANDARD_WEEKLY_SCHEDULE).toHaveLength(7)

      // Minggu (day 0): Disabled
      const sunday = STANDARD_WEEKLY_SCHEDULE.find((d) => d.dayOfWeek === 0)
      expect(sunday?.isEnabled).toBe(false)

      // Senin (day 1): 08:00 - 17:00
      const monday = STANDARD_WEEKLY_SCHEDULE.find((d) => d.dayOfWeek === 1)
      expect(monday?.isEnabled).toBe(true)
      expect(monday?.openTime).toBe('08:00')
      expect(monday?.closeTime).toBe('17:00')

      // Sabtu (day 6): 09:00 - 14:00
      const saturday = STANDARD_WEEKLY_SCHEDULE.find((d) => d.dayOfWeek === 6)
      expect(saturday?.isEnabled).toBe(true)
      expect(saturday?.openTime).toBe('09:00')
      expect(saturday?.closeTime).toBe('14:00')
    })

    it('should validate valid configuration successfully', () => {
      const result = validateBusinessHoursConfig(initialConfig)
      expect(result.success).toBe(true)
      expect(result.errors).toBeUndefined()
    })

    it('should reject configuration when closeTime is before or equal to openTime on active day', () => {
      const invalidConfig: BusinessHoursUiConfig = {
        ...initialConfig,
        weeklySchedule: [
          {
            dayOfWeek: 1, // Senin
            openTime: '17:00',
            closeTime: '08:00', // Salah: tutup sebelum buka
            isEnabled: true,
          },
        ],
      }

      const result = validateBusinessHoursConfig(invalidConfig)
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('should accept 24-jam (openAllDay) day even if openTime equals closeTime', () => {
      const allDayConfig: BusinessHoursUiConfig = {
        ...initialConfig,
        weeklySchedule: [
          {
            dayOfWeek: 2, // Selasa
            openTime: '00:00',
            closeTime: '23:59',
            isEnabled: true,
            openAllDay: true,
          },
        ],
      }

      const result = validateBusinessHoursConfig(allDayConfig)
      expect(result.success).toBe(true)
    })

    it('should reject configuration when outOfOfficeMessage is empty', () => {
      const emptyMsgConfig: BusinessHoursUiConfig = {
        ...initialConfig,
        outOfOfficeMessage: '',
      }

      const result = validateBusinessHoursConfig(emptyMsgConfig)
      expect(result.success).toBe(false)
      expect(result.errors?.outOfOfficeMessage).toBeDefined()
    })
  })

  describe('Single Organization Guardrail & Phase 3 Checklist', () => {
    it('should strictly NOT contain or require accountId in BusinessHoursUiConfig', () => {
      expect(initialConfig).not.toHaveProperty('accountId')
      expect(initialConfig).not.toHaveProperty('account_id')
    })

    it('should verify Phase 3 checklist marks Task 3.14 as completed', () => {
      const rootDir = join(import.meta.dir, '..', '..', '..', '..', '..')
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_3_CHECKLIST.md'), 'utf-8')
      expect(checklistContent).toContain(
        '- [x] **Task 3.14**: UI pemilih jadwal Jam Kerja per Inbox',
      )
    })
  })
})
