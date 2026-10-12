import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as schemas from '../packages/shared/src/schemas'

describe('Phase 4 Quality Gate & Monorepo Test Suite Verification (Task 4.17)', () => {
  const rootDir = join(import.meta.dir, '..')

  describe('1. Productivity & Analytics Database Migrations (Single Organization)', () => {
    it('should verify Phase 4 SQL migration file exists with correct tables', () => {
      const migrationFile = join(rootDir, 'apps', 'api', 'migrations', '005_phase4_insights.sql')
      expect(existsSync(migrationFile)).toBe(true)

      const sqlContent = readFileSync(migrationFile, 'utf-8')
      // Help Center
      expect(sqlContent).toContain('portals')
      expect(sqlContent).toContain('portal_categories')
      expect(sqlContent).toContain('portal_articles')

      // Automation Rules
      expect(sqlContent).toContain('automation_rules')

      // Campaigns & Deliveries
      expect(sqlContent).toContain('campaigns')
      expect(sqlContent).toContain('campaign_deliveries')

      // Reporting Events
      expect(sqlContent).toContain('reporting_events')
    })

    it('should strictly NOT contain any account_id column in Phase 4 migration (Single Organization)', () => {
      const migrationFile = join(rootDir, 'apps', 'api', 'migrations', '005_phase4_insights.sql')
      const sqlContent = readFileSync(migrationFile, 'utf-8')
      expect(sqlContent.toLowerCase()).not.toContain('account_id')
    })
  })

  describe('2. Shared Domain Schemas & DSL Types (packages/shared)', () => {
    it('should verify shared package exports all Phase 4 domain schemas', () => {
      // Help Center Schemas
      expect(schemas.PortalSchema).toBeDefined()
      expect(schemas.CreatePortalInputSchema).toBeDefined()
      expect(schemas.PortalCategorySchema).toBeDefined()
      expect(schemas.CreatePortalCategoryInputSchema).toBeDefined()
      expect(schemas.PortalArticleSchema).toBeDefined()
      expect(schemas.CreatePortalArticleInputSchema).toBeDefined()

      // Automation Rules Schemas
      expect(schemas.AutomationRuleSchema).toBeDefined()
      expect(schemas.CreateAutomationRuleInputSchema).toBeDefined()
      expect(schemas.AutomationRuleConditionSchema).toBeDefined()
      expect(schemas.AutomationRuleActionSchema).toBeDefined()

      // Campaign & Broadcast Schemas
      expect(schemas.CampaignSchema).toBeDefined()
      expect(schemas.CreateCampaignInputSchema).toBeDefined()
      expect(schemas.CampaignAudienceSelectorSchema).toBeDefined()
      expect(schemas.CampaignAntiBanConfigSchema).toBeDefined()
      expect(schemas.CampaignDeliverySchema).toBeDefined()

      // Reports Filter Schemas
      expect(schemas.ReportFilterQuerySchema).toBeDefined()
    })

    it('should strictly NOT contain account_id or accountId in Phase 4 schemas', () => {
      const portalSample = schemas.CreatePortalInputSchema.shape as Record<string, unknown>
      const articleSample = schemas.CreatePortalArticleInputSchema.shape as Record<string, unknown>
      const ruleSample = schemas.CreateAutomationRuleInputSchema.shape as Record<string, unknown>
      const campaignSample = schemas.CreateCampaignInputSchema.shape as Record<string, unknown>

      expect(portalSample.accountId).toBeUndefined()
      expect(portalSample.account_id).toBeUndefined()
      expect(articleSample.accountId).toBeUndefined()
      expect(articleSample.account_id).toBeUndefined()
      expect(ruleSample.accountId).toBeUndefined()
      expect(ruleSample.account_id).toBeUndefined()
      expect(campaignSample.accountId).toBeUndefined()
      expect(campaignSample.account_id).toBeUndefined()
    })
  })

  describe('3. Backend API Phase 4 Modules & Services (apps/api)', () => {
    it('should verify all Phase 4 modules exist in apps/api/src/modules', () => {
      const modulesDir = join(rootDir, 'apps', 'api', 'src', 'modules')
      const modules = readdirSync(modulesDir)

      expect(modules).toContain('help-center')
      expect(modules).toContain('automation')
      expect(modules).toContain('campaigns')
      expect(modules).toContain('analytics')
    })

    it('should verify module services and test suites exist for all Phase 4 modules', () => {
      // Help Center
      expect(
        existsSync(
          join(rootDir, 'apps', 'api', 'src', 'modules', 'help-center', 'help-center.service.ts'),
        ),
      ).toBe(true)
      expect(
        existsSync(
          join(rootDir, 'apps', 'api', 'src', 'modules', 'help-center', 'help-center.test.ts'),
        ),
      ).toBe(true)

      // Automation Rules
      expect(
        existsSync(
          join(
            rootDir,
            'apps',
            'api',
            'src',
            'modules',
            'automation',
            'automation-rules.service.ts',
          ),
        ),
      ).toBe(true)
      expect(
        existsSync(
          join(rootDir, 'apps', 'api', 'src', 'modules', 'automation', 'automation-rules.test.ts'),
        ),
      ).toBe(true)

      // Campaigns
      expect(
        existsSync(
          join(rootDir, 'apps', 'api', 'src', 'modules', 'campaigns', 'campaigns.service.ts'),
        ),
      ).toBe(true)
      expect(
        existsSync(
          join(rootDir, 'apps', 'api', 'src', 'modules', 'campaigns', 'broadcast-engine.test.ts'),
        ),
      ).toBe(true)

      // Analytics
      expect(
        existsSync(
          join(rootDir, 'apps', 'api', 'src', 'modules', 'analytics', 'analytics.service.ts'),
        ),
      ).toBe(true)
      expect(
        existsSync(
          join(rootDir, 'apps', 'api', 'src', 'modules', 'analytics', 'analytics-engine.test.ts'),
        ),
      ).toBe(true)
    })
  })

  describe('4. Frontend Web Phase 4 Components & Pages (apps/web)', () => {
    it('should verify all Phase 4 UI components exist in apps/web/src/components', () => {
      // Visual Analytics Dashboard
      expect(
        existsSync(
          join(rootDir, 'apps', 'web', 'src', 'components', 'analytics', 'AnalyticsDashboard.tsx'),
        ),
      ).toBe(true)

      // Help Center Editor
      expect(
        existsSync(
          join(rootDir, 'apps', 'web', 'src', 'components', 'help-center', 'HelpCenterEditor.tsx'),
        ),
      ).toBe(true)

      // Automation Rules Builder
      expect(
        existsSync(
          join(
            rootDir,
            'apps',
            'web',
            'src',
            'components',
            'automation',
            'AutomationRuleBuilder.tsx',
          ),
        ),
      ).toBe(true)

      // Campaign Creation Wizard
      expect(
        existsSync(
          join(rootDir, 'apps', 'web', 'src', 'components', 'campaigns', 'CampaignWizard.tsx'),
        ),
      ).toBe(true)
    })

    it('should verify all Phase 4 Pages exist in apps/web/src/pages', () => {
      expect(existsSync(join(rootDir, 'apps', 'web', 'src', 'pages', 'AnalyticsPage.tsx'))).toBe(
        true,
      )
      expect(existsSync(join(rootDir, 'apps', 'web', 'src', 'pages', 'HelpCenterPage.tsx'))).toBe(
        true,
      )
      expect(
        existsSync(join(rootDir, 'apps', 'web', 'src', 'pages', 'AutomationRulesPage.tsx')),
      ).toBe(true)
      expect(existsSync(join(rootDir, 'apps', 'web', 'src', 'pages', 'CampaignsPage.tsx'))).toBe(
        true,
      )
    })
  })

  describe('5. Phase 4 Checklist Verification', () => {
    it('should verify all tasks in Phase 4 are completed and marked [x]', () => {
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_4_CHECKLIST.md'), 'utf-8')

      // Part 1: Schema & Migrasi
      expect(checklistContent).toContain('- [x] **Task 4.1**:')
      expect(checklistContent).toContain('- [x] **Task 4.2**:')
      expect(checklistContent).toContain('- [x] **Task 4.3**:')
      expect(checklistContent).toContain('- [x] **Task 4.4**:')

      // Part 2: Shared DSL
      expect(checklistContent).toContain('- [x] **Task 4.5**:')
      expect(checklistContent).toContain('- [x] **Task 4.6**:')
      expect(checklistContent).toContain('- [x] **Task 4.7**:')
      expect(checklistContent).toContain('- [x] **Task 4.8**:')

      // Part 3: Backend API
      expect(checklistContent).toContain('- [x] **Task 4.9')
      expect(checklistContent).toContain('- [x] **Task 4.10')
      expect(checklistContent).toContain('- [x] **Task 4.11')
      expect(checklistContent).toContain('- [x] **Task 4.12')

      // Part 4: Frontend Web
      expect(checklistContent).toContain('- [x] **Task 4.13**:')
      expect(checklistContent).toContain('- [x] **Task 4.14**:')
      expect(checklistContent).toContain('- [x] **Task 4.15**:')
      expect(checklistContent).toContain('- [x] **Task 4.16**:')

      // Part 5: Quality Gate Task 4.17
      expect(checklistContent).toContain('- [x] **Task 4.17**:')
    })
  })
})
