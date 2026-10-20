import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { Avatar, ChannelBadge } from '../astryx'
import { ChatListPanel } from './ChatListPanel'
import { ConversationThread } from './ConversationThread'
import type { ConversationItem } from './types'

describe('Channel & Inbox Identification UI (Issue #282)', () => {
  it('Avatar should render platform-specific colors on mini channel badge', () => {
    const waHtml = renderToStaticMarkup(
      <Avatar name="WhatsApp User" channel="whatsapp" size="md" />,
    )
    expect(waHtml).toContain('data-testid="channel-avatar-badge"')
    expect(waHtml).toContain('bg-wa-badge-unread')

    const widgetHtml = renderToStaticMarkup(
      <Avatar name="Web Widget User" channel="website_widget" size="md" />,
    )
    expect(widgetHtml).toContain('bg-blue-600')

    const apiHtml = renderToStaticMarkup(<Avatar name="API User" channel="api" size="md" />)
    expect(apiHtml).toContain('bg-purple-600')
  })

  it('ChannelBadge component should render distinct badge with platform styling', () => {
    const waBadge = renderToStaticMarkup(<ChannelBadge channel="whatsapp" showLabel={true} />)
    expect(waBadge).toContain('data-testid="channel-badge"')
    expect(waBadge).toContain('bg-wa-badge-unread')
    expect(waBadge).toContain('WhatsApp')

    const widgetBadge = renderToStaticMarkup(
      <ChannelBadge channel="website_widget" showLabel={true} />,
    )
    expect(widgetBadge).toContain('bg-blue-600')
    expect(widgetBadge).toContain('Web Widget')

    const apiBadge = renderToStaticMarkup(<ChannelBadge channel="api" showLabel={true} />)
    expect(apiBadge).toContain('bg-purple-600')
    expect(apiBadge).toContain('API')
  })

  it('ChatListPanel should render inboxName micro-pill next to conversation item', () => {
    const mockConv: ConversationItem = {
      id: 'conv-inbox-1',
      contactName: 'Pelanggan Layanan',
      contactPhone: '+62811223344',
      channel: 'whatsapp',
      inboxId: 'inbox-123',
      inboxName: 'WA Support Hotline',
      lastMessage: 'Halo butuh bantuan teknis',
      unreadCount: 0,
    }

    const html = renderToStaticMarkup(
      <ChatListPanel
        conversations={[mockConv]}
        selectedConversationId={null}
        activeFilter="all"
        searchQuery=""
        onSelectConversation={() => {}}
        onFilterChange={() => {}}
        onSearchChange={() => {}}
        onNewChat={() => {}}
      />,
    )

    expect(html).toContain('data-testid="inbox-name-pill"')
    expect(html).toContain('WA Support Hotline')
  })

  it('ConversationThread header should display channel badge and inboxName', () => {
    const activeConv: ConversationItem = {
      id: 'conv-inbox-active',
      contactName: 'Pelanggan Aktif',
      contactPhone: '+62899887766',
      channel: 'whatsapp',
      inboxId: 'inbox-sales-456',
      inboxName: 'WhatsApp Sales Team',
      presence: 'online',
    }

    const html = renderToStaticMarkup(
      <ConversationThread
        conversation={activeConv}
        isDrawerOpen={false}
        onToggleDrawer={() => {}}
        onSendMessage={() => {}}
        onAssignTicket={() => {}}
        onResolveTicket={() => {}}
      />,
    )

    expect(html).toContain('data-testid="channel-badge"')
    expect(html).toContain('bg-wa-badge-unread')
    expect(html).toContain('data-testid="thread-inbox-name"')
    expect(html).toContain('WhatsApp Sales Team')
  })
})
