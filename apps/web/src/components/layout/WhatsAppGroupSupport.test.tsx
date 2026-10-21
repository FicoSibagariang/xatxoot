import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChatBubble } from '../chat'
import type { TimelineMessage } from '../chat/types'
import { ChatListPanel } from './ChatListPanel'
import { ConversationThread } from './ConversationThread'
import type { ConversationItem, LayoutUser } from './types'

describe('WhatsApp Group UI Support (Issue #288 - TDD RED)', () => {
  const currentAgent: LayoutUser = {
    id: 'agent-01',
    name: 'Budi Agent',
    email: 'budi@xatxoot.com',
    role: 'agent',
    status: 'online',
  }

  const groupConv: ConversationItem = {
    id: 'conv-group-1',
    contactName: 'Grup Koordinasi Proyek VIP',
    channel: 'whatsapp',
    isGroup: true,
    groupJid: '120363209784423627@g.us',
    lastMessage: 'Ahmad Client: Tolong cek lampiran PO.',
    unreadCount: 2,
    availableChannels: [
      { id: 'chan-support', name: 'WhatsApp CS Support', phoneNumber: '+62 811-1111-1111' },
      { id: 'chan-sales', name: 'WhatsApp Sales Executive', phoneNumber: '+62 822-2222-2222' },
    ],
  }

  it('ChatListPanel should render group badge or icon for group conversations', () => {
    const html = renderToStaticMarkup(
      <ChatListPanel
        conversations={[groupConv]}
        selectedConversationId={null}
        activeFilter="all"
        searchQuery=""
        onSelectConversation={() => {}}
        onFilterChange={() => {}}
        onSearchChange={() => {}}
      />,
    )

    expect(html).toContain('data-testid="group-badge"')
    expect(html).toContain('Grup')
  })

  it('ChatBubble should render participant name and phone on group incoming bubble', () => {
    const groupIncomingMsg: TimelineMessage = {
      id: 'msg-group-01',
      conversationId: groupConv.id,
      senderType: 'contact',
      senderName: 'Ahmad Client',
      messageType: 'incoming',
      contentType: 'text',
      content: 'Halo tim, apakah PO sudah masuk?',
      timestamp: '11:20',
      isGroup: true,
      participant: '6281234567890',
      participantName: 'Ahmad Client',
    }

    const html = renderToStaticMarkup(<ChatBubble message={groupIncomingMsg} />)

    expect(html).toContain('data-testid="group-participant-name"')
    expect(html).toContain('Ahmad Client')
    expect(html).toContain('6281234567890')
  })

  it('ConversationThread should render outbound channel selector for group conversations with multiple channels', () => {
    const html = renderToStaticMarkup(
      <ConversationThread
        conversation={groupConv}
        currentUser={currentAgent}
        isDrawerOpen={false}
        onToggleDrawer={() => {}}
        onSendMessage={() => {}}
        onAssignTicket={() => {}}
        onResolveTicket={() => {}}
      />,
    )

    expect(html).toContain('data-testid="select-outbound-channel"')
    expect(html).toContain('WhatsApp CS Support')
    expect(html).toContain('WhatsApp Sales Executive')
  })
})
