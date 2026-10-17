import { describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'

describe('Modular Shared Schemas Architecture (Issue #273)', () => {
  const schemasDir = path.resolve(__dirname, 'schemas')

  it('1. should have modular domain files in packages/shared/src/schemas/', () => {
    expect(fs.existsSync(schemasDir)).toBe(true)

    const expectedModules = [
      'auth.ts',
      'channels.ts',
      'business-hours.ts',
      'conversations.ts',
      'tickets.ts',
      'bots.ts',
      'macros.ts',
      'ai-copilot.ts',
      'analytics-csat.ts',
      'automation.ts',
      'help-center.ts',
      'sla.ts',
      'index.ts',
    ]

    for (const mod of expectedModules) {
      const filePath = path.join(schemasDir, mod)
      expect(fs.existsSync(filePath)).toBe(true)
    }
  })

  it('2. should enforce file length < 300 lines for every modular domain schema file', () => {
    const domainFiles = [
      'auth.ts',
      'channels.ts',
      'business-hours.ts',
      'conversations.ts',
      'tickets.ts',
      'bots.ts',
      'macros.ts',
      'ai-copilot.ts',
      'analytics-csat.ts',
      'automation.ts',
      'help-center.ts',
      'sla.ts',
    ]

    for (const file of domainFiles) {
      const filePath = path.join(schemasDir, file)
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8')
        const lines = content.split('\n').length
        expect(lines).toBeLessThan(300)
      } else {
        expect(fs.existsSync(filePath)).toBe(true)
      }
    }
  })

  it('3. should verify exports from all modular schema domains', async () => {
    // Dynamic import to test schema exports
    const auth = await import('./schemas/auth')
    expect(auth.OrganizationSetupInputSchema).toBeDefined()
    expect(auth.LoginInputSchema).toBeDefined()
    expect(auth.UserSchema).toBeDefined()
    expect(auth.SsoProviderTypeSchema).toBeDefined()

    const channels = await import('./schemas/channels')
    expect(channels.ChannelTypeSchema).toBeDefined()
    expect(channels.CreateInboxInputSchema).toBeDefined()
    expect(channels.WhatsAppCloudChannelSchema).toBeDefined()

    const businessHours = await import('./schemas/business-hours')
    expect(businessHours.BusinessHoursSchema).toBeDefined()
    expect(businessHours.DayOfWeekNameSchema).toBeDefined()

    const conversations = await import('./schemas/conversations')
    expect(conversations.ContactSchema).toBeDefined()
    expect(conversations.MessageSchema).toBeDefined()
    expect(conversations.ConversationSchema).toBeDefined()

    const tickets = await import('./schemas/tickets')
    expect(tickets.TicketSchema).toBeDefined()
    expect(tickets.TicketStatusSchema).toBeDefined()
    expect(tickets.TeamSchema).toBeDefined()
    expect(tickets.CreateCapacityPolicyInputSchema).toBeDefined()

    const bots = await import('./schemas/bots')
    expect(bots.BotNodeTypeSchema).toBeDefined()
    expect(bots.BotFlowDefinitionSchema).toBeDefined()

    const macros = await import('./schemas/macros')
    expect(macros.MacroSchema).toBeDefined()
    expect(macros.WhatsAppTemplateSchema).toBeDefined()

    const aiCopilot = await import('./schemas/ai-copilot')
    expect(aiCopilot.AiProviderTypeSchema).toBeDefined()
    expect(aiCopilot.AiSettingSchema).toBeDefined()

    const analyticsCsat = await import('./schemas/analytics-csat')
    expect(analyticsCsat.CsatRatingSchema).toBeDefined()
    expect(analyticsCsat.ReportFilterQuerySchema).toBeDefined()

    const automation = await import('./schemas/automation')
    expect(automation.AutomationRuleSchema).toBeDefined()
    expect(automation.CampaignSchema).toBeDefined()

    const helpCenter = await import('./schemas/help-center')
    expect(helpCenter.PortalArticleSchema).toBeDefined()
    expect(helpCenter.PortalCategorySchema).toBeDefined()

    const sla = await import('./schemas/sla')
    expect(sla.SlaPolicySchema).toBeDefined()
    expect(sla.SlaPriorityRuleSchema).toBeDefined()
  })

  it('4. should maintain 100% backward compatibility via packages/shared/src/schemas.ts and packages/shared/src/index.ts', async () => {
    const schemas = await import('./schemas')
    const shared = await import('./index')

    expect(schemas.OrganizationSetupInputSchema).toBeDefined()
    expect(shared.OrganizationSetupInputSchema).toBeDefined()
    expect(schemas.TicketSchema).toBeDefined()
    expect(shared.TicketSchema).toBeDefined()
    expect(schemas.MessageSchema).toBeDefined()
    expect(shared.MessageSchema).toBeDefined()
    expect(schemas.CreateBotFlowInputSchema).toBeDefined()
    expect(shared.CreateBotFlowInputSchema).toBeDefined()
  })

  it('5. should strictly enforce Single Organization guardrail (no account_id column schemas)', () => {
    const domainFiles = fs.readdirSync(schemasDir).filter((f) => f.endsWith('.ts'))
    for (const file of domainFiles) {
      const content = fs.readFileSync(path.join(schemasDir, file), 'utf-8')
      expect(content).not.toMatch(/account_id:\s*z\.string/)
      expect(content).not.toMatch(/accountId:\s*z\.string/)
    }
  })
})
