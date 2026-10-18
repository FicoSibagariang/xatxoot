import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { SettingsNav } from './SettingsNav'

describe('SettingsNav Component (Pengaturan Instance Sub-Navigation)', () => {
  it('should render all settings navigation links (channels, ai, security)', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/settings/channels']}>
        <SettingsNav activeSection="channels" />
      </MemoryRouter>,
    )

    expect(html).toContain('data-testid="settings-nav"')
    expect(html).toContain('data-testid="settings-nav-channels"')
    expect(html).toContain('Saluran Komunikasi')
    expect(html).toContain('data-testid="settings-nav-ai"')
    expect(html).toContain('AI &amp; Knowledge Base')
    expect(html).toContain('data-testid="settings-nav-security"')
    expect(html).toContain('Keamanan &amp; SSO')
  })

  it('should mark active tab with active styling', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/settings/ai']}>
        <SettingsNav activeSection="ai" />
      </MemoryRouter>,
    )

    expect(html).toContain('bg-wa-teal-primary')
  })
})
