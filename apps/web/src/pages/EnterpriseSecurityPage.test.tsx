import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { EnterpriseSecurityPage } from './EnterpriseSecurityPage'

describe('Enterprise Security Settings Page (Task 5.17 - apps/web)', () => {
  it('should render the Enterprise Security page container with header and panel', () => {
    const html = renderToStaticMarkup(<EnterpriseSecurityPage />)

    expect(html).toContain('data-testid="enterprise-security-page"')
    expect(html).toContain('data-testid="enterprise-security-panel"')
    expect(html).toContain('Pengaturan Keamanan Enterprise')
  })
})
