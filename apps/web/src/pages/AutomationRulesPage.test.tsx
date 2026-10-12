import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { AutomationRulesPage } from './AutomationRulesPage'

describe('AutomationRulesPage (Task 4.15 - apps/web/src/pages)', () => {
  it('should render standalone Automation Rules page with visual builder and flow pipeline', () => {
    const html = renderToStaticMarkup(<AutomationRulesPage />)

    expect(html).toContain('data-testid="automation-rules-page"')
    expect(html).toContain('data-testid="automation-rule-builder"')
    expect(html).toContain('Builder Automation Rules')
    expect(html).toContain('1. TRIGGER (Pemicu Event)')
    expect(html).toContain('2. FILTER (Kondisi Pemeriksaan)')
    expect(html).toContain('3. ACTION (Eksekusi Berantai)')
    expect(html).toContain('Simpan Aturan')
  })
})
