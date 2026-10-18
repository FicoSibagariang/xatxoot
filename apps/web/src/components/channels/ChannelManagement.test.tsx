import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { type ChannelItem, ChannelManagement } from './ChannelManagement'

describe('ChannelManagement Component (Pengelolaan & Ganti Nama Saluran)', () => {
  const mockChannels: ChannelItem[] = [
    {
      id: 'inbox-01',
      name: 'Nia',
      channelType: 'whatsapp_unofficial',
      phoneNumber: '+6281263959766',
      connectionStatus: 'connected',
      conversationCount: 55,
    },
    {
      id: 'inbox-02',
      name: 'Sales Inbox',
      channelType: 'whatsapp_unofficial',
      phoneNumber: '+6281214541762',
      connectionStatus: 'connected',
      conversationCount: 1,
    },
  ]

  it('should render header with title and add new channel button', () => {
    const html = renderToStaticMarkup(
      <ChannelManagement inboxes={mockChannels} onAddNewChannel={() => {}} />,
    )

    expect(html).toContain('data-testid="channel-management"')
    expect(html).toContain('Kelola Saluran Komunikasi')
    expect(html).toContain('data-testid="add-new-channel-btn"')
    expect(html).toContain('+ Tambah Saluran Baru')
  })

  it('should display list of channels with names, types, phone numbers, and status badges', () => {
    const html = renderToStaticMarkup(
      <ChannelManagement inboxes={mockChannels} onAddNewChannel={() => {}} />,
    )

    expect(html).toContain('Nia')
    expect(html).toContain('+6281263959766')
    expect(html).toContain('Sales Inbox')
    expect(html).toContain('+6281214541762')
    expect(html).toContain('data-testid="channel-item-inbox-01"')
    expect(html).toContain('data-testid="channel-item-inbox-02"')
  })

  it('should render edit button for each channel to allow renaming', () => {
    const html = renderToStaticMarkup(
      <ChannelManagement inboxes={mockChannels} onAddNewChannel={() => {}} />,
    )

    expect(html).toContain('data-testid="edit-channel-btn-inbox-01"')
    expect(html).toContain('data-testid="edit-channel-btn-inbox-02"')
    expect(html).toContain('Ubah Nama')
  })

  it('should render empty state when no channels are available', () => {
    const html = renderToStaticMarkup(<ChannelManagement inboxes={[]} onAddNewChannel={() => {}} />)

    expect(html).toContain('Belum ada saluran terpasang')
  })
})
