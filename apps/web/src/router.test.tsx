import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { App } from './App'

describe('Client-Side Router Integration (Issue #274)', () => {
  it('1. should render LoginPage at /login when unauthenticated', () => {
    const html = renderToStaticMarkup(<App initialAuthenticated={false} initialPath="/login" />)
    expect(html).toContain('Masuk ke Xatxoot')
    expect(html).toContain('email')
    expect(html).toContain('password')
  })

  it('2. should render SetupPage at /setup', () => {
    const html = renderToStaticMarkup(<App initialAuthenticated={false} initialPath="/setup" />)
    expect(html).toContain('Inisialisasi Instansi Xatxoot')
    expect(html).toContain('organizationName')
  })

  it('3. should render CsatSurveyPage at /csat/:token', () => {
    const html = renderToStaticMarkup(
      <App initialAuthenticated={false} initialPath="/csat/token-abc-123" />,
    )
    expect(html).toContain('Survei Kepuasan Pelanggan (CSAT)')
  })

  it('4. should render WhatsAppLayout with NavRail and ChatListPanel at /inbox when authenticated', () => {
    const html = renderToStaticMarkup(<App initialAuthenticated={true} initialPath="/inbox" />)
    expect(html).toContain('data-testid="nav-rail"')
    expect(html).toContain('data-testid="chat-list-panel"')
  })

  it('5. should render AnalyticsPage at /analytics when authenticated', () => {
    const html = renderToStaticMarkup(<App initialAuthenticated={true} initialPath="/analytics" />)
    expect(html).toContain('data-testid="nav-rail"')
    expect(html).toContain('data-testid="analytics-page"')
  })

  it('6. should render CampaignsPage at /campaigns when authenticated', () => {
    const html = renderToStaticMarkup(<App initialAuthenticated={true} initialPath="/campaigns" />)
    expect(html).toContain('data-testid="nav-rail"')
    expect(html).toContain('data-testid="campaigns-page"')
  })

  it('7. should render AutomationRulesPage at /automation when authenticated', () => {
    const html = renderToStaticMarkup(<App initialAuthenticated={true} initialPath="/automation" />)
    expect(html).toContain('data-testid="nav-rail"')
    expect(html).toContain('data-testid="automation-rules-page"')
  })

  it('8. should render HelpCenterPage at /help-center when authenticated', () => {
    const html = renderToStaticMarkup(
      <App initialAuthenticated={true} initialPath="/help-center" />,
    )
    expect(html).toContain('data-testid="nav-rail"')
    expect(html).toContain('data-testid="help-center-page"')
  })

  it('9. should render AiProviderSettingsPage at /settings/ai when authenticated', () => {
    const html = renderToStaticMarkup(
      <App initialAuthenticated={true} initialPath="/settings/ai" />,
    )
    expect(html).toContain('data-testid="nav-rail"')
    expect(html).toContain('data-testid="ai-provider-settings-page"')
  })

  it('10. should render EnterpriseSecurityPage at /settings/security when authenticated', () => {
    const html = renderToStaticMarkup(
      <App initialAuthenticated={true} initialPath="/settings/security" />,
    )
    expect(html).toContain('data-testid="nav-rail"')
    expect(html).toContain('data-testid="enterprise-security-page"')
  })

  it('11. should redirect unauthenticated users to /login when accessing protected routes', () => {
    const html = renderToStaticMarkup(<App initialAuthenticated={false} initialPath="/analytics" />)
    // Should render LoginPage instead of AnalyticsPage
    expect(html).toContain('Masuk ke Xatxoot')
    expect(html).not.toContain('data-testid="analytics-page"')
  })

  it('12. should strictly NOT contain account_id or accountId in routing components', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const appContent = fs.readFileSync(path.join(__dirname, 'App.tsx'), 'utf-8')
    expect(appContent).not.toMatch(/account_id/i)
    expect(appContent).not.toMatch(/accountId/i)
  })
})
