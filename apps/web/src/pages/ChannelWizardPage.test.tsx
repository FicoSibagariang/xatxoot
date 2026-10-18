import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChannelWizardPage } from './ChannelWizardPage'

describe('ChannelWizardPage Component (Task 3.13 - apps/web)', () => {
  it('should render ChannelWizard inside page wrapper', () => {
    const html = renderToStaticMarkup(<ChannelWizardPage onBack={() => {}} />)
    expect(html).toContain('Tambah Channel Komunikasi')
    expect(html).toContain('Pilih saluran komunikasi')
    expect(html).toContain('data-testid="tab-channel-list"')
    expect(html).toContain('data-testid="tab-channel-wizard"')
  })

  it('should render ChannelManagement when initialView is list', () => {
    const html = renderToStaticMarkup(<ChannelWizardPage initialView="list" onBack={() => {}} />)
    expect(html).toContain('data-testid="channel-management"')
    expect(html).toContain('Kelola Saluran Komunikasi')
  })
})
