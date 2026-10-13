import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as schemas from '../packages/shared/src/schemas'

describe('Phase 5 Quality Gate & Monorepo Test Suite Verification (Task 5.18)', () => {
  const rootDir = join(import.meta.dir, '..')

  describe('1. AI Copilot, pgvector & Enterprise Database Migrations (Single Organization)', () => {
    it('should verify Phase 5 SQL migration file exists with correct tables and extensions', () => {
      const migrationFile = join(rootDir, 'apps', 'api', 'migrations', '006_phase5_advanced.sql')
      expect(existsSync(migrationFile)).toBe(true)

      const sqlContent = readFileSync(migrationFile, 'utf-8')

      // pgvector extension
      expect(sqlContent).toContain('CREATE EXTENSION IF NOT EXISTS vector')

      // Knowledge Base vector embeddings
      expect(sqlContent).toContain('article_embeddings')

      // AI Provider settings
      expect(sqlContent).toContain('ai_settings')

      // SLA Policies and Statuses
      expect(sqlContent).toContain('sla_policies')
      expect(sqlContent).toContain('ticket_sla_statuses')

      // Enterprise SSO Providers
      expect(sqlContent).toContain('sso_providers')
    })

    it('should strictly NOT contain any account_id column in Phase 5 migration (Single Organization)', () => {
      const migrationFile = join(rootDir, 'apps', 'api', 'migrations', '006_phase5_advanced.sql')
      const sqlContent = readFileSync(migrationFile, 'utf-8')
      expect(sqlContent.toLowerCase()).not.toContain('account_id')
    })
  })

  describe('2. Shared Domain Schemas & Advanced Types (packages/shared)', () => {
    it('should verify shared package exports all Phase 5 domain schemas', () => {
      // AI Settings Schemas
      expect(schemas.AiProviderTypeSchema).toBeDefined()
      expect(schemas.CreateAiSettingInputSchema).toBeDefined()
      expect(schemas.UpdateAiSettingInputSchema).toBeDefined()
      expect(schemas.AiSettingSchema).toBeDefined()

      // AI Copilot Action Schemas
      expect(schemas.AiCopilotActionTypeSchema).toBeDefined()
      expect(schemas.AiCopilotActionRequestSchema).toBeDefined()
      expect(schemas.AiCopilotActionResponseSchema).toBeDefined()

      // SLA Policies Schemas
      expect(schemas.CreateSlaPolicyInputSchema).toBeDefined()
      expect(schemas.UpdateSlaPolicyInputSchema).toBeDefined()
      expect(schemas.SlaPolicySchema).toBeDefined()

      // Enterprise SSO Schemas
      expect(schemas.SsoProviderTypeSchema).toBeDefined()
      expect(schemas.CreateSsoProviderInputSchema).toBeDefined()
      expect(schemas.UpdateSsoProviderInputSchema).toBeDefined()
      expect(schemas.SsoProviderSchema).toBeDefined()

      // Agent Capacity Schemas
      expect(schemas.CreateCapacityPolicyInputSchema).toBeDefined()
      expect(schemas.UpdateCapacityPolicyInputSchema).toBeDefined()
      expect(schemas.CapacityPolicySchema).toBeDefined()
      expect(schemas.SetAgentCapacityOverrideInputSchema).toBeDefined()
      expect(schemas.AgentCapacityOverrideSchema).toBeDefined()
    })

    it('should strictly NOT contain account_id or accountId in Phase 5 schemas', () => {
      const aiSettingSample = schemas.AiSettingSchema.shape as Record<string, unknown>
      const copilotSample = schemas.AiCopilotActionRequestSchema.shape as Record<string, unknown>
      const slaSample = schemas.SlaPolicySchema.shape as Record<string, unknown>
      const ssoSample = schemas.SsoProviderSchema.shape as Record<string, unknown>
      const capacitySample = schemas.CapacityPolicySchema.shape as Record<string, unknown>

      expect(aiSettingSample.accountId).toBeUndefined()
      expect(aiSettingSample.account_id).toBeUndefined()
      expect(copilotSample.accountId).toBeUndefined()
      expect(copilotSample.account_id).toBeUndefined()
      expect(slaSample.accountId).toBeUndefined()
      expect(slaSample.account_id).toBeUndefined()
      expect(ssoSample.accountId).toBeUndefined()
      expect(ssoSample.account_id).toBeUndefined()
      expect(capacitySample.accountId).toBeUndefined()
      expect(capacitySample.account_id).toBeUndefined()

      // Verify that payloads attempting to provide accountId are rejected
      const ssoAttempt = schemas.CreateSsoProviderInputSchema.safeParse({
        providerType: 'saml',
        issuerUrl: 'https://idp.example.com',
        certData: 'cert',
        accountId: 'forbidden-account-id',
      })
      expect(ssoAttempt.success).toBe(false)
    })
  })

  describe('3. Backend API Phase 5 Modules & Services (apps/api)', () => {
    it('should verify all Phase 5 modules exist in apps/api/src/modules', () => {
      const modulesDir = join(rootDir, 'apps', 'api', 'src', 'modules')
      const modules = readdirSync(modulesDir)

      expect(modules).toContain('rag')
      expect(modules).toContain('copilot')
      expect(modules).toContain('sla')
      expect(modules).toContain('sso')
      expect(modules).toContain('capacity')
    })

    it('should verify module services and test suites exist for all Phase 5 modules', () => {
      // RAG & Vector Embeddings
      expect(
        existsSync(join(rootDir, 'apps', 'api', 'src', 'modules', 'rag', 'embedding.service.ts')),
      ).toBe(true)
      expect(
        existsSync(join(rootDir, 'apps', 'api', 'src', 'modules', 'rag', 'rag.service.ts')),
      ).toBe(true)
      expect(existsSync(join(rootDir, 'apps', 'api', 'src', 'modules', 'rag', 'rag.test.ts'))).toBe(
        true,
      )

      // AI Copilot
      expect(
        existsSync(join(rootDir, 'apps', 'api', 'src', 'modules', 'copilot', 'copilot.service.ts')),
      ).toBe(true)
      expect(
        existsSync(join(rootDir, 'apps', 'api', 'src', 'modules', 'copilot', 'copilot.test.ts')),
      ).toBe(true)

      // SLA Monitoring
      expect(
        existsSync(join(rootDir, 'apps', 'api', 'src', 'modules', 'sla', 'sla.service.ts')),
      ).toBe(true)
      expect(existsSync(join(rootDir, 'apps', 'api', 'src', 'modules', 'sla', 'sla.test.ts'))).toBe(
        true,
      )

      // SSO Enterprise
      expect(
        existsSync(join(rootDir, 'apps', 'api', 'src', 'modules', 'sso', 'sso.service.ts')),
      ).toBe(true)
      expect(existsSync(join(rootDir, 'apps', 'api', 'src', 'modules', 'sso', 'sso.test.ts'))).toBe(
        true,
      )

      // Agent Capacity
      expect(
        existsSync(
          join(rootDir, 'apps', 'api', 'src', 'modules', 'capacity', 'capacity.service.ts'),
        ),
      ).toBe(true)
      expect(
        existsSync(join(rootDir, 'apps', 'api', 'src', 'modules', 'capacity', 'capacity.test.ts')),
      ).toBe(true)
    })
  })

  describe('4. Frontend Web Phase 5 Components & Pages (apps/web)', () => {
    it('should verify all Phase 5 UI components exist in apps/web', () => {
      // AI Copilot Toolbar
      expect(
        existsSync(
          join(rootDir, 'apps', 'web', 'src', 'components', 'chat', 'AiCopilotToolbar.tsx'),
        ),
      ).toBe(true)

      // AI Provider Config Panel
      expect(
        existsSync(
          join(
            rootDir,
            'apps',
            'web',
            'src',
            'components',
            'ai-provider',
            'AiProviderConfigPanel.tsx',
          ),
        ),
      ).toBe(true)

      // SLA Visual Badge
      expect(
        existsSync(join(rootDir, 'apps', 'web', 'src', 'components', 'sla', 'TicketSlaBadge.tsx')),
      ).toBe(true)

      // Enterprise Security Panel
      expect(
        existsSync(
          join(
            rootDir,
            'apps',
            'web',
            'src',
            'components',
            'security',
            'EnterpriseSecurityPanel.tsx',
          ),
        ),
      ).toBe(true)
    })

    it('should verify all Phase 5 Pages exist in apps/web/src/pages', () => {
      expect(
        existsSync(join(rootDir, 'apps', 'web', 'src', 'pages', 'AiProviderSettingsPage.tsx')),
      ).toBe(true)
      expect(
        existsSync(join(rootDir, 'apps', 'web', 'src', 'pages', 'EnterpriseSecurityPage.tsx')),
      ).toBe(true)
    })
  })

  describe('5. Phase 5 Checklist Verification', () => {
    it('should verify all tasks in Phase 5 are completed and marked [x]', () => {
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_5_CHECKLIST.md'), 'utf-8')

      // Bagian 1: Skema Database & Migrasi
      expect(checklistContent).toContain('- [x] **Task 5.1**:')
      expect(checklistContent).toContain('- [x] **Task 5.2**:')
      expect(checklistContent).toContain('- [x] **Task 5.3**:')
      expect(checklistContent).toContain('- [x] **Task 5.4**:')
      expect(checklistContent).toContain('- [x] **Task 5.5**:')

      // Bagian 2: Shared Types & Zod Schemas
      expect(checklistContent).toContain('- [x] **Task 5.6**:')
      expect(checklistContent).toContain('- [x] **Task 5.7**:')
      expect(checklistContent).toContain('- [x] **Task 5.8**:')

      // Bagian 3: Backend Services (TDD)
      expect(checklistContent).toContain('- [x] **Task 5.9')
      expect(checklistContent).toContain('- [x] **Task 5.10')
      expect(checklistContent).toContain('- [x] **Task 5.11')
      expect(checklistContent).toContain('- [x] **Task 5.12')
      expect(checklistContent).toContain('- [x] **Task 5.13')

      // Bagian 4: Antarmuka Web Dashboard
      expect(checklistContent).toContain('- [x] **Task 5.14**:')
      expect(checklistContent).toContain('- [x] **Task 5.15**:')
      expect(checklistContent).toContain('- [x] **Task 5.16**:')
      expect(checklistContent).toContain('- [x] **Task 5.17**:')

      // Bagian 5: Verifikasi & Quality Gate
      expect(checklistContent).toContain('- [x] **Task 5.18**:')
    })
  })

  describe('6. Phase 5 Biome Linter & Formatter Quality Gate (Task 5.19)', () => {
    it('should verify docs/PHASE_5_CHECKLIST.md marks Task 5.19 as completed', () => {
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_5_CHECKLIST.md'), 'utf-8')
      expect(checklistContent).toContain('- [x] **Task 5.19**:')
    })

    it('should verify biome.json configuration adheres strictly to AGENTS.md conventions', () => {
      const biomeConfigPath = join(rootDir, 'biome.json')
      expect(existsSync(biomeConfigPath)).toBe(true)

      const raw = readFileSync(biomeConfigPath, 'utf-8')
      const config = JSON.parse(raw)

      expect(config.formatter).toBeDefined()
      expect(config.formatter.indentStyle).toBe('space')
      expect(config.formatter.indentWidth).toBe(2)
      expect(config.formatter.lineWidth).toBe(100)
      expect(config.formatter.lineEnding).toBe('lf')

      expect(config.javascript).toBeDefined()
      expect(config.javascript.formatter).toBeDefined()
      expect(config.javascript.formatter.quoteStyle).toBe('single')
      expect(config.javascript.formatter.jsxQuoteStyle).toBe('double')
      expect(config.javascript.formatter.semicolons).toBe('asNeeded')

      expect(config.organizeImports).toBeDefined()
      expect(config.organizeImports.enabled).toBe(true)
    })

    it('should pass biome check across entire monorepo with 0 errors and 0 warnings', () => {
      const proc = Bun.spawnSync(['bunx', '@biomejs/biome', 'check', '.'], {
        cwd: rootDir,
      })
      expect(proc.exitCode).toBe(0)
    })
  })
})
