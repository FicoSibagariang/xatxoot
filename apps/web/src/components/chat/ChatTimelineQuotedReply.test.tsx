import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ConversationThread } from '../layout/ConversationThread'
import type { ConversationItem, LayoutUser } from '../layout/types'
import { ChatBubble, ChatTimeline } from './ChatTimeline'
import type { TimelineMessage } from './types'

describe('ChatTimeline & ConversationThread Quoted Reply (Issue #286 - TDD RED)', () => {
  const currentAgent: LayoutUser = {
    id: 'agent-me-123',
    name: 'Budi Santoso',
    email: 'budi@xatxoot.com',
    role: 'agent',
    status: 'online',
  }

  it('ChatBubble should render quoted message box when replyTo is present', () => {
    const messageWithQuote: TimelineMessage = {
      id: 'msg-reply-01',
      conversationId: 'conv-01',
      messageType: 'outgoing',
      contentType: 'text',
      content: 'Siap kak, pesanan langsung diproses sekarang.',
      senderType: 'user',
      senderName: 'Budi Santoso',
      timestamp: '15:10',
      replyTo: {
        messageId: 'target-msg-01',
        senderName: 'Pelanggan Setia',
        snippet: 'Tolong proses pesanan saya secepatnya ya min.',
      },
    }

    const html = renderToStaticMarkup(<ChatBubble message={messageWithQuote} />)

    expect(html).toContain('data-testid="quoted-message-box"')
    expect(html).toContain('Pelanggan Setia')
    expect(html).toContain('Tolong proses pesanan saya secepatnya ya min.')
  })

  it('ChatTimeline should render reply hover button on message bubbles', () => {
    const messages: TimelineMessage[] = [
      {
        id: 'msg-01',
        conversationId: 'conv-01',
        messageType: 'incoming',
        contentType: 'text',
        content: 'Halo CS, apakah barang ready?',
        senderType: 'contact',
        senderName: 'Pelanggan',
        timestamp: '15:00',
      },
    ]

    const html = renderToStaticMarkup(
      <ChatTimeline messages={messages} onReplyToMessage={() => {}} />,
    )

    expect(html).toContain('data-testid="btn-reply-message"')
    expect(html).toContain('Balas')
  })

  it('ConversationThread should render reply preview bar with cancel button when replyingToMessage is active', () => {
    const conv: ConversationItem = {
      id: 'conv-quote-1',
      contactName: 'Pelanggan Quoted',
      channel: 'whatsapp',
      ticket: {
        id: 'ticket-1',
        ticketNumber: '1001',
        status: 'open',
        assignedTo: currentAgent.id,
      },
    }

    const quotedTarget: TimelineMessage = {
      id: 'target-01',
      conversationId: conv.id,
      messageType: 'incoming',
      contentType: 'text',
      content: 'Bisa minta foto produk aslinya?',
      senderType: 'contact',
      senderName: 'Pelanggan Quoted',
      timestamp: '15:05',
    }

    const html = renderToStaticMarkup(
      <ConversationThread
        conversation={conv}
        currentUser={currentAgent}
        replyingToMessage={quotedTarget}
        onCancelReply={() => {}}
        isDrawerOpen={false}
        onToggleDrawer={() => {}}
        onSendMessage={() => {}}
        onAssignTicket={() => {}}
        onResolveTicket={() => {}}
      />,
    )

    expect(html).toContain('data-testid="reply-preview-bar"')
    expect(html).toContain('Membalas Pelanggan Quoted')
    expect(html).toContain('Bisa minta foto produk aslinya?')
    expect(html).toContain('data-testid="btn-cancel-reply"')
  })
})
