import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { HelpCenterPage } from './HelpCenterPage'

describe('HelpCenterPage (Task 4.14 - apps/web/src/pages)', () => {
  it('should render standalone Help Center page with editor and article management view', () => {
    const html = renderToStaticMarkup(<HelpCenterPage />)

    expect(html).toContain('data-testid="help-center-page"')
    expect(html).toContain('data-testid="help-center-editor"')
    expect(html).toContain('Editor Artikel Basis Pengetahuan')
    expect(html).toContain('Judul Artikel')
    expect(html).toContain('Slug URL')
    expect(html).toContain('Kategori')
    expect(html).toContain('Simpan Draft')
    expect(html).toContain('Publikasikan')
  })
})
