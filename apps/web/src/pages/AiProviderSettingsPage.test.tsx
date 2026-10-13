import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { AiProviderSettingsPage } from './AiProviderSettingsPage'

describe('AI Provider Settings Page (Task 5.15 - apps/web)', () => {
  it('should render the AI Provider Settings page container with header and panel', () => {
    const html = renderToStaticMarkup(<AiProviderSettingsPage />)

    expect(html).toContain('data-testid="ai-provider-settings-page"')
    expect(html).toContain('data-testid="ai-provider-config-panel"')
    expect(html).toContain('Pengaturan AI &amp; Knowledge Base')
  })
})
