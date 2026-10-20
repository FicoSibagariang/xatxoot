import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChatBubble } from './ChatTimeline'
import type { TimelineMessage } from './types'

describe('ChatTimeline Outbound Sender Identification (Issue #284 - TDD RED)', () => {
  it('should render agent sender tag and tooltip for dashboard agent outbound message', () => {
    const agentMsg: TimelineMessage = {
      id: 'msg-agent-01',
      conversationId: 'conv-01',
      messageType: 'outgoing',
      contentType: 'text',
      content: 'Halo kak, perkenalkan saya Budi dari tim CS.',
      senderType: 'user',
      senderId: 'agent-123',
      senderName: 'Budi Santoso',
      timestamp: '14:20',
      status: 'delivered',
    }

    const html = renderToStaticMarkup(<ChatBubble message={agentMsg} />)

    expect(html).toContain('data-testid="chat-bubble-outgoing"')
    expect(html).toContain('data-testid="sender-badge-agent"')
    expect(html).toContain('Budi Santoso')
    expect(html).toContain('Dikirim oleh Budi Santoso via Dashboard')
  })

  it('should render physical phone echo badge and accent for WhatsApp HP outbound message', () => {
    const echoMsg: TimelineMessage = {
      id: 'msg-echo-01',
      conversationId: 'conv-01',
      messageType: 'outgoing',
      contentType: 'text',
      content: 'Halo, ini balasan langsung dari smartphone WhatsApp admin ya.',
      senderType: 'user',
      isEcho: true,
      senderName: 'WhatsApp HP',
      timestamp: '14:25',
      status: 'sent',
    }

    const html = renderToStaticMarkup(<ChatBubble message={echoMsg} />)

    expect(html).toContain('data-testid="chat-bubble-outgoing"')
    expect(html).toContain('data-testid="sender-badge-echo"')
    expect(html).toContain('WhatsApp HP (Perangkat Fisik)')
    expect(html).toContain('Disinkronkan dari Aplikasi WhatsApp HP')
  })

  it('should render bot sender tag for automation bot outbound message', () => {
    const botMsg: TimelineMessage = {
      id: 'msg-bot-01',
      conversationId: 'conv-01',
      messageType: 'outgoing',
      contentType: 'text',
      content: 'Pilih nomor 1 untuk Bantuan Akun, 2 untuk Kendala Transaksi.',
      senderType: 'bot',
      senderName: 'Bot Otomasi',
      timestamp: '14:26',
      status: 'delivered',
    }

    const html = renderToStaticMarkup(<ChatBubble message={botMsg} />)

    expect(html).toContain('data-testid="chat-bubble-outgoing"')
    expect(html).toContain('data-testid="sender-badge-bot"')
    expect(html).toContain('Bot Otomasi')
    expect(html).toContain('Dikirim oleh Bot Otomasi')
  })

  it('incoming message should NOT render outbound sender badges', () => {
    const incomingMsg: TimelineMessage = {
      id: 'msg-incoming-01',
      conversationId: 'conv-01',
      messageType: 'incoming',
      contentType: 'text',
      content: 'Halo admin, saya butuh konfirmasi pesanan.',
      senderType: 'contact',
      senderName: 'Pelanggan Setia',
      timestamp: '14:19',
      status: 'read',
    }

    const html = renderToStaticMarkup(<ChatBubble message={incomingMsg} />)

    expect(html).toContain('data-testid="chat-bubble-incoming"')
    expect(html).not.toContain('data-testid="sender-badge-agent"')
    expect(html).not.toContain('data-testid="sender-badge-echo"')
    expect(html).not.toContain('data-testid="sender-badge-bot"')
  })
})
