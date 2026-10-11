import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BusinessHoursEngine,
  BusinessHoursService,
  isWithinBusinessHours,
} from './business-hours.service'

describe('Business Hours Engine & Out-of-Office Auto Reply (Task 3.11 - apps/api)', () => {
  const dummyInboxId = '123e4567-e89b-12d3-a456-426614174099'
  const dummyConversationId = '123e4567-e89b-12d3-a456-426614174088'

  // Standard Week Schedule: Senin-Jumat 08:00 - 17:00, Sabtu 09:00 - 14:00, Minggu Libur
  const standardWeeklySchedule = [
    { dayOfWeek: 0, openTime: '00:00', closeTime: '00:00', isEnabled: false }, // Minggu
    { dayOfWeek: 1, openTime: '08:00', closeTime: '17:00', isEnabled: true }, // Senin
    { dayOfWeek: 2, openTime: '08:00', closeTime: '17:00', isEnabled: true }, // Selasa
    { dayOfWeek: 3, openTime: '08:00', closeTime: '17:00', isEnabled: true }, // Rabu
    { dayOfWeek: 4, openTime: '08:00', closeTime: '17:00', isEnabled: true }, // Kamis
    { dayOfWeek: 5, openTime: '08:00', closeTime: '17:00', isEnabled: true }, // Jumat
    { dayOfWeek: 6, openTime: '09:00', closeTime: '14:00', isEnabled: true }, // Sabtu
  ]

  const defaultConfig = {
    inboxId: dummyInboxId,
    timezone: 'Asia/Jakarta', // UTC+7
    weeklySchedule: standardWeeklySchedule,
    outOfOfficeMessage: 'Halo! Kami saat ini sedang di luar jam operasional.',
    enabled: true,
  }

  describe('isWithinBusinessHours Evaluator', () => {
    it('should return true if business hours is disabled (24/7 unrestricted)', () => {
      const config = { ...defaultConfig, enabled: false }
      // Minggu tengah malam
      const testDate = new Date('2026-10-11T17:00:00Z') // Minggu 00:00 WIB
      expect(isWithinBusinessHours(config, testDate)).toBe(true)
    })

    it('should return true if weeklySchedule is empty (unrestricted)', () => {
      const config = { ...defaultConfig, weeklySchedule: [] }
      const testDate = new Date('2026-10-11T17:00:00Z')
      expect(isWithinBusinessHours(config, testDate)).toBe(true)
    })

    it('should return true when timestamp falls within open hours on active weekday', () => {
      // Senin, 12 Oktober 2026 10:30 WIB (03:30 UTC)
      const mondayWorkHoursUtc = new Date('2026-10-12T03:30:00Z')
      expect(isWithinBusinessHours(defaultConfig, mondayWorkHoursUtc)).toBe(true)
    })

    it('should return false when timestamp is before opening time', () => {
      // Senin, 12 Oktober 2026 07:15 WIB (00:15 UTC) -> Buka jam 08:00 WIB
      const mondayEarlyUtc = new Date('2026-10-12T00:15:00Z')
      expect(isWithinBusinessHours(defaultConfig, mondayEarlyUtc)).toBe(false)
    })

    it('should return false when timestamp is after closing time', () => {
      // Senin, 12 Oktober 2026 18:00 WIB (11:00 UTC) -> Tutup jam 17:00 WIB
      const mondayLateUtc = new Date('2026-10-12T11:00:00Z')
      expect(isWithinBusinessHours(defaultConfig, mondayLateUtc)).toBe(false)
    })

    it('should return false when timestamp is on a disabled day (e.g. Sunday)', () => {
      // Minggu, 11 Oktober 2026 12:00 WIB (05:00 UTC) -> isEnabled false
      const sundayNoonUtc = new Date('2026-10-11T05:00:00Z')
      expect(isWithinBusinessHours(defaultConfig, sundayNoonUtc)).toBe(false)
    })

    it('should return true when day is configured as openAllDay', () => {
      const allDayConfig = {
        ...defaultConfig,
        weeklySchedule: [
          {
            dayOfWeek: 2,
            openTime: '00:00',
            closeTime: '23:59',
            isEnabled: true,
            openAllDay: true,
          },
        ],
      }
      // Selasa 02:00 WIB (Senin 19:00 UTC)
      const tuesdayNightUtc = new Date('2026-10-12T19:00:00Z')
      expect(isWithinBusinessHours(allDayConfig, tuesdayNightUtc)).toBe(true)
    })

    it('should properly respect configured timezone offset differences', () => {
      // Waktu: 2026-10-12 14:00:00 UTC
      // Di Asia/Jakarta (UTC+7) -> Jam 21:00 (Sudah Tutup)
      // Di America/New_York (UTC-4) -> Jam 10:00 (Sedang Buka jika jam 08:00-17:00)
      const targetUtc = new Date('2026-10-12T14:00:00Z')

      const jakartaConfig = { ...defaultConfig, timezone: 'Asia/Jakarta' }
      const newYorkConfig = { ...defaultConfig, timezone: 'America/New_York' }

      expect(isWithinBusinessHours(jakartaConfig, targetUtc)).toBe(false)
      expect(isWithinBusinessHours(newYorkConfig, targetUtc)).toBe(true)
    })
  })

  describe('Out-of-Office (OOO) Auto-Reply Engine', () => {
    it('should NOT trigger OOO auto-reply if incoming message is within business hours', async () => {
      const engine = new BusinessHoursEngine()
      // Senin, 12 Oktober 2026 10:00 WIB (03:00 UTC) -> Buka
      const workHoursDate = new Date('2026-10-12T03:00:00Z')

      const result = await engine.evaluateOutOfOffice({
        config: defaultConfig,
        conversationId: dummyConversationId,
        incomingMessageDate: workHoursDate,
      })

      expect(result.isWithinBusinessHours).toBe(true)
      expect(result.shouldSendOoo).toBe(false)
      expect(result.oooMessage).toBeUndefined()
    })

    it('should trigger OOO auto-reply when message is outside business hours and no prior OOO was sent', async () => {
      const engine = new BusinessHoursEngine()
      // Minggu 12:00 WIB -> Tutup
      const outsideDate = new Date('2026-10-11T05:00:00Z')

      const result = await engine.evaluateOutOfOffice({
        config: defaultConfig,
        conversationId: dummyConversationId,
        incomingMessageDate: outsideDate,
      })

      expect(result.isWithinBusinessHours).toBe(false)
      expect(result.shouldSendOoo).toBe(true)
      expect(result.oooMessage).toBe(defaultConfig.outOfOfficeMessage)
    })

    it('should NOT trigger OOO auto-reply if already sent to conversation within 24 hours (24h cooldown rule)', async () => {
      const engine = new BusinessHoursEngine()
      const outsideDate1 = new Date('2026-10-11T05:00:00Z') // Minggu 12:00

      // Pesan 1: Memicu OOO
      const result1 = await engine.evaluateOutOfOffice({
        config: defaultConfig,
        conversationId: dummyConversationId,
        incomingMessageDate: outsideDate1,
      })
      expect(result1.shouldSendOoo).toBe(true)

      // Pesan 2: Datang 2 jam kemudian (Minggu 14:00)
      const outsideDate2 = new Date('2026-10-11T07:00:00Z')
      const result2 = await engine.evaluateOutOfOffice({
        config: defaultConfig,
        conversationId: dummyConversationId,
        incomingMessageDate: outsideDate2,
      })

      expect(result2.isWithinBusinessHours).toBe(false)
      expect(result2.shouldSendOoo).toBe(false)
      expect(result2.reason).toBe('ALREADY_SENT_WITHIN_24_HOURS')
    })

    it('should trigger new OOO auto-reply if last OOO was sent more than 24 hours ago', async () => {
      const engine = new BusinessHoursEngine()
      const outsideDate1 = new Date('2026-10-10T05:00:00Z') // Sabtu 12:00

      await engine.evaluateOutOfOffice({
        config: defaultConfig,
        conversationId: dummyConversationId,
        incomingMessageDate: outsideDate1,
      })

      // Pesan baru datang 26 jam kemudian
      const outsideDate2 = new Date('2026-10-11T07:00:00Z')
      const result = await engine.evaluateOutOfOffice({
        config: defaultConfig,
        conversationId: dummyConversationId,
        incomingMessageDate: outsideDate2,
      })

      expect(result.isWithinBusinessHours).toBe(false)
      expect(result.shouldSendOoo).toBe(true)
      expect(result.oooMessage).toBe(defaultConfig.outOfOfficeMessage)
    })
  })

  describe('BusinessHoursService & HTTP Routes (apps/api)', () => {
    it('should manage business hours configuration and evaluate OOO via service', async () => {
      const service = new BusinessHoursService()
      const savedConfig = await service.upsertBusinessHours(defaultConfig)

      expect(savedConfig.inboxId).toBe(dummyInboxId)
      expect(savedConfig.timezone).toBe('Asia/Jakarta')

      const fetchedConfig = await service.getBusinessHours(dummyInboxId)
      expect(fetchedConfig).not.toBeNull()
      expect(fetchedConfig?.weeklySchedule).toHaveLength(7)
    })

    it('should handle POST /api/v1/business-hours/evaluate endpoint', async () => {
      const { default: app } = await import('../../index')
      const response = await app.request('/api/v1/business-hours/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: defaultConfig,
          conversationId: 'conv_eval_http_01',
          incomingMessageDate: '2026-10-12T03:30:00Z', // Senin 10:30 WIB (Open)
        }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.ok).toBe(true)
      expect(data.data.isWithinBusinessHours).toBe(true)
      expect(data.data.shouldSendOoo).toBe(false)
    })

    it('should handle GET & POST /api/v1/inboxes/:inboxId/business-hours endpoints', async () => {
      const { default: app } = await import('../../index')

      // 1. POST (Upsert)
      const postRes = await app.request(`/api/v1/inboxes/${dummyInboxId}/business-hours`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaultConfig),
      })
      expect(postRes.status).toBe(200)

      // 2. GET
      const getRes = await app.request(`/api/v1/inboxes/${dummyInboxId}/business-hours`)
      expect(getRes.status).toBe(200)
      const getData = await getRes.json()
      expect(getData.ok).toBe(true)
      expect(getData.data.inboxId).toBe(dummyInboxId)
    })
  })

  describe('Single Organization Guardrail & Phase 3 Checklist', () => {
    it('should strictly NOT contain or require accountId in business hours engine or service', async () => {
      const service = new BusinessHoursService()
      const result = await service.upsertBusinessHours(defaultConfig)

      expect(result).not.toHaveProperty('accountId')
      expect(result).not.toHaveProperty('account_id')
    })

    it('should verify Phase 3 checklist marks Task 3.11 as completed', () => {
      const rootDir = join(import.meta.dir, '..', '..', '..', '..', '..')
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_3_CHECKLIST.md'), 'utf-8')
      expect(checklistContent).toContain('- [x] **Task 3.11 (TDD - Business Hours Engine)**:')
    })
  })
})
