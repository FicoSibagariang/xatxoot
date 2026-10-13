import { beforeEach, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Hono } from 'hono'
import { resetAuthStore } from '../auth/auth.service'
import { ssoRoutes } from './sso.routes'
import { SsoService, resetSsoStore, ssoService } from './sso.service'

describe('SAML & OIDC Enterprise SSO Handler (Task 5.12 - apps/api)', () => {
  const rootDir = join(import.meta.dir, '..', '..', '..', '..', '..')
  let app: Hono

  beforeEach(() => {
    resetSsoStore()
    resetAuthStore()
    app = new Hono()
    app.route('/api/v1/sso', ssoRoutes)
  })

  describe('1. SSO Provider Configuration Management', () => {
    it('should create and retrieve a SAML provider', async () => {
      const provider = await ssoService.createProvider({
        name: 'Okta Enterprise SAML',
        providerType: 'saml',
        issuerUrl: 'https://okta.example.com/app/sso/saml/metadata',
        ssoUrl: 'https://okta.example.com/app/sso/saml/sso',
        certData: '-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWg...\n-----END CERTIFICATE-----',
        active: true,
      })

      expect(provider.id).toBeDefined()
      expect(provider.name).toBe('Okta Enterprise SAML')
      expect(provider.providerType).toBe('saml')
      expect(provider.active).toBe(true)

      const fetched = await ssoService.getProviderById(provider.id)
      expect(fetched).not.toBeNull()
      expect(fetched?.ssoUrl).toBe('https://okta.example.com/app/sso/saml/sso')
    })

    it('should create and retrieve an OIDC provider', async () => {
      const provider = await ssoService.createProvider({
        name: 'Azure AD OIDC',
        providerType: 'oidc',
        issuerUrl: 'https://login.microsoftonline.com/tenant-123/v2.0',
        clientId: 'azure-client-id-abc',
        clientSecret: 'azure-client-secret-xyz',
        active: true,
      })

      expect(provider.id).toBeDefined()
      expect(provider.providerType).toBe('oidc')
      expect(provider.clientId).toBe('azure-client-id-abc')

      const list = await ssoService.listProviders()
      expect(list.some((p) => p.id === provider.id)).toBe(true)
    })

    it('should update and delete SSO providers', async () => {
      const provider = await ssoService.createProvider({
        name: 'Temporary Provider',
        providerType: 'oidc',
        issuerUrl: 'https://auth.company.com',
        clientId: 'temp-id',
      })

      const updated = await ssoService.updateProvider(provider.id, {
        name: 'Updated Provider',
        active: false,
      })
      expect(updated.name).toBe('Updated Provider')
      expect(updated.active).toBe(false)

      const deleted = await ssoService.deleteProvider(provider.id)
      expect(deleted).toBe(true)

      const fetched = await ssoService.getProviderById(provider.id)
      expect(fetched).toBeNull()
    })
  })

  describe('2. OIDC Flow & Redirection', () => {
    it('should generate a valid OIDC authorization redirect URL', async () => {
      const provider = await ssoService.createProvider({
        name: 'Google Workspace OIDC',
        providerType: 'oidc',
        issuerUrl: 'https://accounts.google.com',
        clientId: 'google-client-id.apps.googleusercontent.com',
      })

      const state = 'state_csrf_token_123'
      const authUrl = await ssoService.getOidcAuthUrl(provider.id, state)

      expect(authUrl).toContain('https://accounts.google.com')
      expect(authUrl).toContain('client_id=google-client-id.apps.googleusercontent.com')
      expect(authUrl).toContain('response_type=code')
      expect(authUrl).toContain('state=state_csrf_token_123')
      expect(decodeURIComponent(authUrl.replace(/\+/g, ' '))).toContain(
        'scope=openid profile email',
      )
    })

    it('should process OIDC callback and auto-provision new agent user', async () => {
      const provider = await ssoService.createProvider({
        name: 'Okta OIDC',
        providerType: 'oidc',
        issuerUrl: 'https://okta.example.com',
        clientId: 'okta-client-123',
      })

      const authResult = await ssoService.handleOidcCallback(provider.id, {
        code: 'auth_code_valid_123',
        state: 'random_state',
      })

      expect(authResult.user).toBeDefined()
      expect(authResult.user.email).toBeDefined()
      expect(authResult.user.role).toBe('agent')
      expect(authResult.tokens.accessToken).toBeDefined()
      expect(authResult.tokens.refreshToken).toBeDefined()
    })
  })

  describe('3. SAML 2.0 Flow & Assertion Consumer Service (ACS)', () => {
    it('should generate SAML login redirect URL', async () => {
      const provider = await ssoService.createProvider({
        name: 'OneLogin SAML',
        providerType: 'saml',
        issuerUrl: 'https://onelogin.example.com/saml/metadata',
        ssoUrl: 'https://onelogin.example.com/trust/saml2/http-post/sso',
        certData: 'CERT_DATA',
      })

      const loginUrl = await ssoService.getSamlLoginUrl(provider.id, '/inbox')
      expect(loginUrl).toContain('https://onelogin.example.com/trust/saml2/http-post/sso')
      expect(loginUrl).toContain('RelayState=%2Finbox')
    })

    it('should parse base64 SAMLResponse assertion and authenticate user', async () => {
      const provider = await ssoService.createProvider({
        name: 'Enterprise SAML',
        providerType: 'saml',
        issuerUrl: 'https://idp.enterprise.com',
        ssoUrl: 'https://idp.enterprise.com/sso',
        certData: 'CERT_DATA',
      })

      // Sample mock SAML assertion with NameID
      const samlXml = `
        <samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" Version="2.0">
          <saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
            <saml:Subject>
              <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">agent.support@enterprise.com</saml:NameID>
            </saml:Subject>
            <saml:AttributeStatement>
              <saml:Attribute Name="displayName">
                <saml:AttributeValue>Agent Support Enterprise</saml:AttributeValue>
              </saml:Attribute>
            </saml:AttributeStatement>
          </saml:Assertion>
        </samlp:Response>
      `
      const base64Saml = Buffer.from(samlXml).toString('base64')

      const authResult = await ssoService.handleSamlAcs(provider.id, {
        SAMLResponse: base64Saml,
        RelayState: '/tickets/123',
      })

      expect(authResult.user.email).toBe('agent.support@enterprise.com')
      expect(authResult.user.displayName).toBe('Agent Support Enterprise')
      expect(authResult.tokens.accessToken).toBeDefined()
      expect(authResult.relayState).toBe('/tickets/123')
    })

    it('should reject invalid base64 or empty SAML assertion', async () => {
      const provider = await ssoService.createProvider({
        name: 'Enterprise SAML',
        providerType: 'saml',
        issuerUrl: 'https://idp.enterprise.com',
        ssoUrl: 'https://idp.enterprise.com/sso',
        certData: 'CERT_DATA',
      })

      expect(
        ssoService.handleSamlAcs(provider.id, {
          SAMLResponse: 'not-valid-xml-content',
        }),
      ).rejects.toThrow()
    })

    it('should export valid SP SAML metadata XML', async () => {
      const metadataXml = ssoService.getSpMetadataXml('https://app.xatxoot.com')
      expect(metadataXml).toContain('EntityDescriptor')
      expect(metadataXml).toContain('SPSSODescriptor')
      expect(metadataXml).toContain('AssertionConsumerService')
      expect(metadataXml).toContain('https://app.xatxoot.com/api/v1/sso/saml/acs')
    })
  })

  describe('4. REST API Endpoints (/api/v1/sso)', () => {
    it('POST & GET /api/v1/sso/providers should manage providers', async () => {
      const createRes = await app.request('/api/v1/sso/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'REST SAML Provider',
          providerType: 'saml',
          issuerUrl: 'https://idp.rest.com',
          ssoUrl: 'https://idp.rest.com/sso',
          certData: 'CERT',
        }),
      })

      expect(createRes.status).toBe(201)
      const created = await createRes.json()
      expect(created.id).toBeDefined()

      const listRes = await app.request('/api/v1/sso/providers')
      expect(listRes.status).toBe(200)
      const list = await listRes.json()
      expect(list.some((p: Record<string, unknown>) => p.id === created.id)).toBe(true)
    })

    it('GET /api/v1/sso/oidc/login/:providerId should return or redirect to authorization URL', async () => {
      const provider = await ssoService.createProvider({
        name: 'OIDC Provider',
        providerType: 'oidc',
        issuerUrl: 'https://auth.provider.com',
        clientId: 'test-client',
      })

      const res = await app.request(`/api/v1/sso/oidc/login/${provider.id}`, {
        headers: { Accept: 'application/json' },
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.authUrl).toContain('https://auth.provider.com')

      // Without Accept: application/json, it returns 302 redirect
      const redirectRes = await app.request(`/api/v1/sso/oidc/login/${provider.id}`)
      expect(redirectRes.status).toBe(302)
      expect(redirectRes.headers.get('Location')).toContain('https://auth.provider.com')
    })

    it('POST /api/v1/sso/saml/acs/:providerId should process SAML response and return auth session', async () => {
      const provider = await ssoService.createProvider({
        name: 'SAML Provider',
        providerType: 'saml',
        issuerUrl: 'https://saml.provider.com',
        ssoUrl: 'https://saml.provider.com/sso',
        certData: 'CERT',
      })

      const samlXml = `
        <samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol">
          <saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
            <saml:Subject>
              <saml:NameID>user@sso-rest.com</saml:NameID>
            </saml:Subject>
          </saml:Assertion>
        </samlp:Response>
      `
      const base64Saml = Buffer.from(samlXml).toString('base64')

      const res = await app.request(`/api/v1/sso/saml/acs/${provider.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          SAMLResponse: base64Saml,
          RelayState: '/chat',
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.user.email).toBe('user@sso-rest.com')
      expect(data.tokens.accessToken).toBeDefined()
      expect(data.relayState).toBe('/chat')
    })

    it('GET /api/v1/sso/saml/metadata should return XML SP metadata', async () => {
      const res = await app.request('/api/v1/sso/saml/metadata')
      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).toContain('EntityDescriptor')
    })

    it('GET /api/v1/sso/audit-logs should return list of activity audit logs', async () => {
      const res = await app.request('/api/v1/sso/audit-logs')
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data).toBeArray()
    })
  })

  describe('5. Single Organization Guardrail & Phase 5 Checklist', () => {
    it('should strictly NOT contain account_id or accountId in SSO models', async () => {
      const provider = await ssoService.createProvider({
        name: 'Security Guardrail Provider',
        providerType: 'saml',
        issuerUrl: 'https://idp.guardrail.com',
        certData: 'CERT',
      })

      const keys = Object.keys(provider)
      expect(keys).not.toContain('account_id')
      expect(keys).not.toContain('accountId')
    })

    it('should verify docs/PHASE_5_CHECKLIST.md marks Task 5.12 as completed', () => {
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_5_CHECKLIST.md'), 'utf-8')
      expect(checklistContent).toContain('- [x] **Task 5.12 (TDD - SAML & OIDC Handler)**:')
    })
  })
})
