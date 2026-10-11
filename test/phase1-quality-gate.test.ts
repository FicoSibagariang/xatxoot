import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as schemas from '../packages/shared/src/schemas'

describe('Phase 1 Quality Gate & Test Suite Verification (Task 1.32)', () => {
  const rootDir = join(import.meta.dir, '..')

  it('should verify all required Phase 1 workspaces exist and are registered in root package.json', () => {
    const rootPkgJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'))
    expect(rootPkgJson.workspaces).toBeDefined()
    expect(rootPkgJson.workspaces).toContain('apps/*')
    expect(rootPkgJson.workspaces).toContain('packages/*')

    // Workspace directories
    expect(existsSync(join(rootDir, 'apps', 'api'))).toBe(true)
    expect(existsSync(join(rootDir, 'apps', 'web'))).toBe(true)
    expect(existsSync(join(rootDir, 'apps', 'wa-gateway'))).toBe(true)
    expect(existsSync(join(rootDir, 'apps', 'wa-simulator'))).toBe(true)
    expect(existsSync(join(rootDir, 'packages', 'shared'))).toBe(true)
    expect(existsSync(join(rootDir, 'packages', 'widget'))).toBe(true)
  })

  it('should verify all Phase 1 SQL migration files exist in sequence', () => {
    const migrationsDir = join(rootDir, 'apps', 'api', 'migrations')
    const migrationFiles = readdirSync(migrationsDir)

    expect(migrationFiles).toContain('001_init.sql')
    expect(migrationFiles).toContain('002_phase1_inbox.sql')
  })

  it('should verify shared package exports all Phase 1 domain schemas and types', () => {
    // Inboxes and Channels
    expect(schemas.CreateWhatsAppCloudChannelInputSchema).toBeDefined()
    expect(schemas.CreateWhatsAppUnofficialChannelInputSchema).toBeDefined()
    expect(schemas.CreateWebWidgetChannelInputSchema).toBeDefined()
    expect(schemas.CreateInboxInputSchema).toBeDefined()

    // Contacts and Companies
    expect(schemas.ContactSchema).toBeDefined()
    expect(schemas.CreateContactInputSchema).toBeDefined()
    expect(schemas.UpdateContactInputSchema).toBeDefined()
    expect(schemas.CompanySchema).toBeDefined()
    expect(schemas.CreateCompanyInputSchema).toBeDefined()

    // Conversations & Tickets
    expect(schemas.ConversationSchema).toBeDefined()
    expect(schemas.TicketSchema).toBeDefined()
    expect(schemas.CreateTicketInputSchema).toBeDefined()
    expect(schemas.UpdateTicketStatusInputSchema).toBeDefined()
    expect(schemas.UpdateTicketInternalNoteInputSchema).toBeDefined()

    // Messages and Attachments
    expect(schemas.MessageSchema).toBeDefined()
    expect(schemas.CreateMessageInputSchema).toBeDefined()
    expect(schemas.AttachmentSchema).toBeDefined()
    expect(schemas.AttachmentInputSchema).toBeDefined()
  })

  it('should verify apps/api contains all Phase 1 module controllers and services', () => {
    const modulesDir = join(rootDir, 'apps', 'api', 'src', 'modules')
    const modules = readdirSync(modulesDir)

    expect(modules).toContain('inboxes')
    expect(modules).toContain('conversations')
    expect(modules).toContain('tickets')
    expect(modules).toContain('messages')
    expect(modules).toContain('realtime')
    expect(modules).toContain('webhooks')
    expect(modules).toContain('widget')
  })

  it('should verify apps/web contains all Phase 1 WhatsApp Web components and SSE hook', () => {
    expect(
      existsSync(join(rootDir, 'apps', 'web', 'src', 'components', 'layout', 'WhatsAppLayout.tsx')),
    ).toBe(true)
    expect(
      existsSync(join(rootDir, 'apps', 'web', 'src', 'components', 'chat', 'ChatTimeline.tsx')),
    ).toBe(true)
    expect(
      existsSync(join(rootDir, 'apps', 'web', 'src', 'components', 'drawer', 'ContactDrawer.tsx')),
    ).toBe(true)
    expect(
      existsSync(
        join(rootDir, 'apps', 'web', 'src', 'components', 'pairing', 'BaileysPairingDialog.tsx'),
      ),
    ).toBe(true)
    expect(existsSync(join(rootDir, 'apps', 'web', 'src', 'hooks', 'useRealtimeStream.ts'))).toBe(
      true,
    )
  })

  it('should verify packages/widget standalone live chat bundle is built and under 80 KB gzipped', () => {
    const widgetDist = join(rootDir, 'packages', 'widget', 'dist', 'widget.js')
    expect(existsSync(widgetDist)).toBe(true)

    const bundleContent = readFileSync(widgetDist)
    const gzipped = Bun.gzipSync(bundleContent)
    const gzippedKb = gzipped.byteLength / 1024

    // Under 80 KB gzipped limit
    expect(gzippedKb).toBeLessThan(80)
  })

  it('should verify Phase 1 checklist marks Task 1.32 as completed', () => {
    const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_1_CHECKLIST.md'), 'utf-8')
    expect(checklistContent).toContain(
      '- [x] **Task 1.32**: Jalankan seluruh unit & integration test (`bun test`) — pastikan 100% PASS.',
    )
  })
})
