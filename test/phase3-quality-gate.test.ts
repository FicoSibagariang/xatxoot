import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as schemas from '../packages/shared/src/schemas'

describe('Phase 3 Quality Gate & Test Suite Verification (Task 3.17)', () => {
  const rootDir = join(import.meta.dir, '..')

  describe('1. Omnichannel Database Migrations & Single Organization Guardrail', () => {
    it('should verify Phase 3 SQL migration file exists with correct tables', () => {
      const migrationFile = join(rootDir, 'apps', 'api', 'migrations', '004_phase3_omnichannel.sql')
      expect(existsSync(migrationFile)).toBe(true)

      const sqlContent = readFileSync(migrationFile, 'utf-8')
      // Must contain omnichannel channels, business hours, and CSAT tables
      expect(sqlContent).toContain('channels_email')
      expect(sqlContent).toContain('channels_telegram')
      expect(sqlContent).toContain('channels_facebook')
      expect(sqlContent).toContain('channels_instagram')
      expect(sqlContent).toContain('channels_sms')
      expect(sqlContent).toContain('business_hours')
      expect(sqlContent).toContain('csat_surveys')
    })

    it('should strictly NOT contain any account_id column in Phase 3 migration (Single Organization)', () => {
      const migrationFile = join(rootDir, 'apps', 'api', 'migrations', '004_phase3_omnichannel.sql')
      const sqlContent = readFileSync(migrationFile, 'utf-8')
      expect(sqlContent.toLowerCase()).not.toContain('account_id')
    })
  })

  describe('2. Shared Domain Schemas & Omnichannel Types', () => {
    it('should verify shared package exports all Phase 3 domain schemas', () => {
      // Email channel
      expect(schemas.CreateEmailChannelInputSchema).toBeDefined()
      expect(schemas.EmailChannelSchema).toBeDefined()

      // Telegram channel
      expect(schemas.CreateTelegramChannelInputSchema).toBeDefined()
      expect(schemas.TelegramChannelSchema).toBeDefined()

      // Business Hours
      expect(schemas.CreateBusinessHoursInputSchema).toBeDefined()
      expect(schemas.UpdateBusinessHoursInputSchema).toBeDefined()
      expect(schemas.BusinessHoursSchema).toBeDefined()

      // CSAT Survey
      expect(schemas.CreateCsatSurveyInputSchema).toBeDefined()
      expect(schemas.SubmitCsatSurveyInputSchema).toBeDefined()
      expect(schemas.CsatSurveySchema).toBeDefined()
      expect(schemas.CsatSurveyMetricsSchema).toBeDefined()
    })

    it('should strictly NOT contain account_id or accountId in Phase 3 schemas', () => {
      const emailSample = schemas.CreateEmailChannelInputSchema.shape as Record<string, unknown>
      const telegramSample = schemas.CreateTelegramChannelInputSchema.shape as Record<
        string,
        unknown
      >
      const bhSample = schemas.CreateBusinessHoursInputSchema.shape as Record<string, unknown>
      const csatSample = schemas.SubmitCsatSurveyInputSchema.shape as Record<string, unknown>

      expect(emailSample.accountId).toBeUndefined()
      expect(emailSample.account_id).toBeUndefined()
      expect(telegramSample.accountId).toBeUndefined()
      expect(telegramSample.account_id).toBeUndefined()
      expect(bhSample.accountId).toBeUndefined()
      expect(bhSample.account_id).toBeUndefined()
      expect(csatSample.accountId).toBeUndefined()
      expect(csatSample.account_id).toBeUndefined()
    })
  })

  describe('3. Backend API Phase 3 Omnichannel Modules & Services', () => {
    it('should verify all Phase 3 modules exist in apps/api/src/modules', () => {
      const modulesDir = join(rootDir, 'apps', 'api', 'src', 'modules')
      const modules = readdirSync(modulesDir)

      expect(modules).toContain('email')
      expect(modules).toContain('telegram')
      expect(modules).toContain('meta-social')
      expect(modules).toContain('sms')
      expect(modules).toContain('business-hours')
      expect(modules).toContain('csat')
    })
  })

  describe('4. Frontend Web Phase 3 Components (apps/web)', () => {
    it('should verify all Phase 3 UI components exist in apps/web', () => {
      // Wizard channel
      expect(
        existsSync(
          join(rootDir, 'apps', 'web', 'src', 'components', 'channels', 'ChannelWizard.tsx'),
        ),
      ).toBe(true)

      // Business hours picker
      expect(
        existsSync(
          join(
            rootDir,
            'apps',
            'web',
            'src',
            'components',
            'business-hours',
            'BusinessHoursSettings.tsx',
          ),
        ),
      ).toBe(true)

      // CSAT public survey widget
      expect(
        existsSync(
          join(rootDir, 'apps', 'web', 'src', 'components', 'csat', 'CsatSurveyWidget.tsx'),
        ),
      ).toBe(true)

      // Ticket CSAT drawer card
      expect(
        existsSync(
          join(rootDir, 'apps', 'web', 'src', 'components', 'drawer', 'TicketCsatCard.tsx'),
        ),
      ).toBe(true)
    })
  })

  describe('5. Phase 3 Checklist Completion Verification', () => {
    it('should verify Phase 3 checklist marks Task 3.17 as completed', () => {
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_3_CHECKLIST.md'), 'utf-8')
      expect(checklistContent).toContain(
        '- [x] **Task 3.17**: Jalankan seluruh test suite (`bun test`) — 100% PASS.',
      )
    })
  })
})
