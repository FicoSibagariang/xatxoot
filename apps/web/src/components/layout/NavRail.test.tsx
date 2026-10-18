import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { NavRail } from './NavRail'
import type { LayoutUser, PresenceStatus, WhatsAppChannelSummary } from './types'

describe('NavRail WhatsApp Multi-Channel Picker Popover', () => {
  const mockUser: LayoutUser = {
    id: 'user-001',
    name: 'Sarah Connor',
    email: 'sarah@xatxoot.local',
    role: 'agent',
    status: 'online' as PresenceStatus,
    avatarUrl: 'https://example.com/avatar.png',
  }

  const mockChannels: WhatsAppChannelSummary[] = [
    {
      id: 'ch-nia',
      name: 'Nia',
      phoneNumber: '+6281263959766',
      connectionStatus: 'connected',
    },
    {
      id: 'ch-helpdesk',
      name: 'Helpdesk',
      phoneNumber: '+6281214541762',
      connectionStatus: 'disconnected',
    },
  ]

  it('should render aggregated status indicator on QR button (rose if any disconnected)', () => {
    const html = renderToStaticMarkup(
      <NavRail
        currentUser={mockUser}
        activeTab="inbox"
        activeChannelFilter="all"
        onTabChange={() => {}}
        onChannelFilterChange={() => {}}
        onPresenceChange={() => {}}
        onOpenWhatsAppPairing={() => {}}
        whatsappChannels={mockChannels}
      />,
    )

    expect(html).toContain('data-testid="channel-whatsapp-qr-button"')
    // Since Helpdesk is disconnected, aggregate status should be red (bg-rose-500)
    expect(html).toContain('bg-rose-500')
  })

  it('should render aggregate green status when all WhatsApp channels are connected', () => {
    const allConnected: WhatsAppChannelSummary[] = [
      {
        id: 'ch-1',
        name: 'Nia',
        phoneNumber: '+6281263959766',
        connectionStatus: 'connected',
      },
      {
        id: 'ch-2',
        name: 'Helpdesk',
        phoneNumber: '+6281214541762',
        connectionStatus: 'connected',
      },
    ]

    const html = renderToStaticMarkup(
      <NavRail
        currentUser={mockUser}
        activeTab="inbox"
        activeChannelFilter="all"
        onTabChange={() => {}}
        onChannelFilterChange={() => {}}
        onPresenceChange={() => {}}
        onOpenWhatsAppPairing={() => {}}
        whatsappChannels={allConnected}
      />,
    )

    expect(html).toContain('bg-emerald-500')
  })

  it('should render aggregate yellow pulse status when any channel is qr_ready', () => {
    const qrPending: WhatsAppChannelSummary[] = [
      {
        id: 'ch-1',
        name: 'Nia',
        phoneNumber: '+6281263959766',
        connectionStatus: 'connected',
      },
      {
        id: 'ch-2',
        name: 'Helpdesk',
        phoneNumber: '+6281214541762',
        connectionStatus: 'qr_ready',
      },
    ]

    const html = renderToStaticMarkup(
      <NavRail
        currentUser={mockUser}
        activeTab="inbox"
        activeChannelFilter="all"
        onTabChange={() => {}}
        onChannelFilterChange={() => {}}
        onPresenceChange={() => {}}
        onOpenWhatsAppPairing={() => {}}
        whatsappChannels={qrPending}
      />,
    )

    expect(html).toContain('bg-amber-400')
    expect(html).toContain('animate-pulse')
  })

  it('should support initialChannelPickerOpen prop to render WhatsApp channel picker popover with channel cards', () => {
    const html = renderToStaticMarkup(
      <NavRail
        currentUser={mockUser}
        activeTab="inbox"
        activeChannelFilter="all"
        onTabChange={() => {}}
        onChannelFilterChange={() => {}}
        onPresenceChange={() => {}}
        onOpenWhatsAppPairing={() => {}}
        onOpenSettings={() => {}}
        whatsappChannels={mockChannels}
        initialChannelPickerOpen={true}
      />,
    )

    expect(html).toContain('data-testid="whatsapp-channel-picker-popover"')
    expect(html).toContain('Saluran WhatsApp')
    expect(html).toContain('Nia')
    expect(html).toContain('+6281263959766')
    expect(html).toContain('Helpdesk')
    expect(html).toContain('+6281214541762')
    expect(html).toContain('data-testid="pair-channel-ch-nia"')
    expect(html).toContain('data-testid="pair-channel-ch-helpdesk"')
    expect(html).toContain('data-testid="manage-channels-link"')
  })
})
