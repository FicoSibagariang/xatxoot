import { describe, expect, it, mock } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChatBubble, ChatTimeline } from '../chat/ChatTimeline'
import type { TimelineMessage } from '../chat/types'
import { ConversationThread } from './ConversationThread'
import type { ConversationItem } from './types'

describe('Reverse Cursor-Based Pagination & Scroll Anchoring (Issue #306)', () => {
  it('ChatBubble should apply loading="lazy" attribute to media images', () => {
    const msg: TimelineMessage = {
      id: 'msg-lazy-1',
      conversationId: 'conv-1',
      messageType: 'incoming',
      contentType: 'image',
      content: 'Foto pemandangan',
      mediaUrl: 'https://example.com/photo.jpg',
      timestamp: '10:00',
    }

    const html = renderToStaticMarkup(<ChatBubble message={msg} />)
    expect(html).toContain('data-testid="bubble-media-image"')
    expect(html).toContain('loading="lazy"')
  })

  it('ChatTimeline should render loading spinner indicator when isLoadingMore is true', () => {
    const messages: TimelineMessage[] = [
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        messageType: 'incoming',
        contentType: 'text',
        content: 'Halo CS',
        timestamp: '10:00',
      },
    ]

    const html = renderToStaticMarkup(<ChatTimeline messages={messages} isLoadingMore={true} />)
    expect(html).toContain('data-testid="loading-older-messages"')
    expect(html).toContain('Memuat riwayat pesan sebelumnya...')
  })

  it('ConversationThread passes hasMore and isLoadingMore to ChatTimeline', () => {
    const conv: ConversationItem = {
      id: 'conv-1',
      contactName: 'Budi Test',
      channel: 'whatsapp',
      unreadCount: 0,
    }
    const messages: TimelineMessage[] = [
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        messageType: 'incoming',
        contentType: 'text',
        content: 'Pesan awal',
        timestamp: '10:00',
      },
    ]

    const html = renderToStaticMarkup(
      <ConversationThread
        conversation={conv}
        isDrawerOpen={false}
        messages={messages}
        hasMore={true}
        isLoadingMore={true}
        onToggleDrawer={() => {}}
        onSendMessage={() => {}}
        onAssignTicket={() => {}}
        onResolveTicket={() => {}}
      />,
    )

    expect(html).toContain('data-testid="loading-older-messages"')
  })
})
