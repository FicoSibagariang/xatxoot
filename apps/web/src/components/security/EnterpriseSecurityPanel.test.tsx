import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  type AuditLogEntry,
  EnterpriseSecurityPanel,
  type EnterpriseSecurityPanelProps,
  type SsoFormData,
} from './EnterpriseSecurityPanel'

describe('Enterprise Security & SSO Panel (Task 5.17 - apps/web)', () => {
  const rootDir = join(import.meta.dir, '..', '..', '..', '..', '..')

  const mockSamlData: SsoFormData = {
    providerType: 'saml',
    name: 'Okta Enterprise SSO',
    issuerUrl: 'https://okta.example.com/app/sso/saml/metadata',
    ssoUrl: 'https://okta.example.com/app/sso/saml/sso',
    certData: '-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWg...\n-----END CERTIFICATE-----',
    active: true,
  }

  const mockOidcData: SsoFormData = {
    providerType: 'oidc',
    name: 'Google Workspace OIDC',
    issuerUrl: 'https://accounts.google.com',
    clientId: 'google-client-id-12345',
    clientSecret: 'google-client-secret-abcde',
    active: true,
  }

  const mockAuditLogs: AuditLogEntry[] = [
    {
      id: 'audit-1',
      actorName: 'Super Admin',
      actorEmail: 'admin@xatxoot.com',
      action: 'UPDATE_SSO',
      auditableType: 'SsoProvider',
      auditableId: 'sso-101',
      ipAddress: '192.168.1.10',
      createdAt: '2026-10-13T10:30:00.000Z',
      changes: { active: true, providerType: 'saml' },
    },
    {
      id: 'audit-2',
      actorName: 'Agent Sarah',
      actorEmail: 'sarah@xatxoot.com',
      action: 'LOGIN',
      auditableType: 'UserSession',
      auditableId: 'sess-202',
      ipAddress: '203.0.113.42',
      createdAt: '2026-10-13T09:15:00.000Z',
      changes: { method: 'google_oauth' },
    },
    {
      id: 'audit-3',
      actorName: 'Security Bot',
      actorEmail: 'system@xatxoot.internal',
      action: 'BREACH_ALERT',
      auditableType: 'TicketSla',
      auditableId: 'ticket-303',
      ipAddress: '127.0.0.1',
      createdAt: '2026-10-13T08:00:00.000Z',
      changes: { severity: 'breached', overdueMinutes: 18 },
    },
  ]

  describe('1. Panel Header & Tab Switching', () => {
    it('should render panel header and tabs for SSO setup and Audit Logs', () => {
      const html = renderToStaticMarkup(
        <EnterpriseSecurityPanel initialSso={mockSamlData} auditLogs={mockAuditLogs} />,
      )

      expect(html).toContain('data-testid="enterprise-security-panel"')
      expect(html).toContain('Pengaturan Keamanan Enterprise')
      expect(html).toContain('data-testid="tab-sso-setup"')
      expect(html).toContain('data-testid="tab-audit-logs"')
    })
  })

  describe('2. SAML 2.0 Configuration Form', () => {
    it('should render SAML configuration form fields when SAML is selected', () => {
      const html = renderToStaticMarkup(
        <EnterpriseSecurityPanel initialSso={mockSamlData} activeTab="sso" />,
      )

      expect(html).toContain('data-testid="radio-protocol-saml"')
      expect(html).toContain('data-testid="radio-protocol-oidc"')
      expect(html).toContain('data-testid="input-sso-name"')
      expect(html).toContain('data-testid="input-saml-issuer"')
      expect(html).toContain('data-testid="input-saml-sso-url"')
      expect(html).toContain('data-testid="textarea-saml-cert"')
      expect(html).toContain('data-testid="text-acs-url"')
      expect(html).toContain('data-testid="btn-download-sp-metadata"')
      expect(html).toContain('data-testid="toggle-sso-active"')
      expect(html).toContain('data-testid="btn-save-sso-config"')
      expect(html).toContain('data-testid="btn-test-sso-connection"')
    })
  })

  describe('3. OIDC Configuration Form', () => {
    it('should render OIDC configuration form fields when OIDC is selected', () => {
      const html = renderToStaticMarkup(
        <EnterpriseSecurityPanel initialSso={mockOidcData} activeTab="sso" />,
      )

      expect(html).toContain('data-testid="input-oidc-issuer"')
      expect(html).toContain('data-testid="input-oidc-client-id"')
      expect(html).toContain('data-testid="input-oidc-client-secret"')
      expect(html).toContain('data-testid="input-oidc-scopes"')
      expect(html).toContain('data-testid="text-redirect-uri"')
      expect(html).toContain('google-client-id-12345')
    })
  })

  describe('4. Audit Log Table & Activity History', () => {
    it('should render audit log table with headers and log rows', () => {
      const html = renderToStaticMarkup(
        <EnterpriseSecurityPanel
          initialSso={mockSamlData}
          auditLogs={mockAuditLogs}
          activeTab="audit"
        />,
      )

      expect(html).toContain('data-testid="section-audit-logs"')
      expect(html).toContain('data-testid="input-audit-search"')
      expect(html).toContain('data-testid="select-audit-type"')
      expect(html).toContain('data-testid="table-audit-logs"')
      expect(html).toContain('Super Admin')
      expect(html).toContain('UPDATE_SSO')
      expect(html).toContain('192.168.1.10')
      expect(html).toContain('Agent Sarah')
      expect(html).toContain('LOGIN')
      expect(html).toContain('BREACH_ALERT')
    })

    it('should render empty state when auditLogs array is empty', () => {
      const html = renderToStaticMarkup(
        <EnterpriseSecurityPanel initialSso={mockSamlData} auditLogs={[]} activeTab="audit" />,
      )

      expect(html).toContain('data-testid="empty-audit-logs"')
      expect(html).toContain('Belum ada log aktivitas tercatat')
    })
  })

  describe('5. Single Organization Guardrail & Phase 5 Checklist', () => {
    it('should strictly NOT contain or require account_id or accountId in EnterpriseSecurityPanel code', () => {
      const componentSource = readFileSync(join(__dirname, 'EnterpriseSecurityPanel.tsx'), 'utf-8')
      expect(componentSource).not.toContain('account_id')
      expect(componentSource).not.toContain('accountId')
    })

    it('should verify docs/PHASE_5_CHECKLIST.md marks Task 5.17 as completed', () => {
      const checklist = readFileSync(join(rootDir, 'docs', 'PHASE_5_CHECKLIST.md'), 'utf-8')
      expect(checklist).toContain('- [x] **Task 5.17**:')
    })
  })
})
