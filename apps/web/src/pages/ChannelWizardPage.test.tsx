import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChannelWizardPage } from './ChannelWizardPage'

describe('ChannelWizardPage Component (Task 3.13 - apps/web)', () => {
  it('should render ChannelWizard inside page wrapper', () => {
    const html = renderToStaticMarkup(<ChannelWizardPage onBack={() => {}} />)
    expect(html).toContain('Tambah Channel Komunikasi')
    expect(html).toContain('Pilih saluran komunikasi')
  })
})
