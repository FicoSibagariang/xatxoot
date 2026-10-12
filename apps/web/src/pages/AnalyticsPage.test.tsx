import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { AnalyticsPage } from './AnalyticsPage'

describe('AnalyticsPage (Task 4.13 - apps/web/src/pages)', () => {
  it('should render standalone Analytics Page with full navigation layout and dashboard', () => {
    const html = renderToStaticMarkup(<AnalyticsPage />)

    expect(html).toContain('data-testid="analytics-page"')
    expect(html).toContain('Visual Analytics Dashboard')
    expect(html).toContain('Volume Percakapan per Jam')
    expect(html).toContain('Heatmap Aktivitas Chat Mingguan')
    expect(html).toContain('Performa Agen')
    expect(html).toContain('Kepuasan Pelanggan (CSAT)')
    expect(html).toContain('Unduh CSV')
  })
})
