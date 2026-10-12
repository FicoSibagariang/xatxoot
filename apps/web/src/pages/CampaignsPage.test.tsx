import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { CampaignsPage } from './CampaignsPage'

describe('CampaignsPage (Task 4.16 - apps/web/src/pages)', () => {
  it('should render standalone Campaigns page with wizard stepper and live preview', () => {
    const html = renderToStaticMarkup(<CampaignsPage />)

    expect(html).toContain('data-testid="campaigns-page"')
    expect(html).toContain('data-testid="campaign-wizard"')
    expect(html).toContain('Wizard Pembuatan Campaign Broadcast')
    expect(html).toContain('Detail &amp; Konten Pesan')
    expect(html).toContain('Live WhatsApp Bubble Preview')
    expect(html).toContain('Simpan Draft')
  })
})
