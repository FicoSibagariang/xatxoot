import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ConversationItem } from '../layout/types'
import { ChatBubble } from './ChatTimeline'
import { ForwardMessageModal } from './ForwardMessageModal'
import type { TimelineMessage } from './types'

describe('WhatsApp Forward Message UI (Issue #300 - TDD RED)', () => {
  const sampleMessage: TimelineMessage = {
    id: 'msg-01',
    conversationId: 'conv-01',
    messageType: 'incoming',
    contentType: 'text',
    content: 'Foto bukti serah terima barang di gudang.',
    timestamp: '14:20',
  }

  const forwardedMessage: TimelineMessage = {
    id: 'msg-02',
    conversationId: 'conv-02',
    messageType: 'outgoing',
    contentType: 'text',
    content: 'Meneruskan instruksi dari direktur.',
    timestamp: '14:25',
    isForwarded: true,
  }

  it('ChatBubble should render forward button (data-testid="btn-forward-message")', () => {
    const html = renderToStaticMarkup(
      <ChatBubble message={sampleMessage} onReply={() => {}} onForward={() => {}} />,
    )
    expect(html).toContain('data-testid="btn-forward-message"')
    expect(html).toContain('Teruskan')
  })

  it('ChatBubble should render forwarded badge (data-testid="forwarded-indicator") when message is forwarded', () => {
    const html = renderToStaticMarkup(<ChatBubble message={forwardedMessage} />)
    expect(html).toContain('data-testid="forwarded-indicator"')
    expect(html).toContain('Diteruskan')
  })

  it('ForwardMessageModal should render preview, search input, target list, and submit button', () => {
    const mockTargets: ConversationItem[] = [
      {
        id: 'conv-target-1',
        contactName: 'Grup Teknisi Lapangan',
        isGroup: true,
        channel: 'whatsapp',
      },
      {
        id: 'conv-target-2',
        contactName: 'Budi Santoso Finance',
        contactPhone: '+62812345678',
        channel: 'whatsapp',
      },
    ]

    const html = renderToStaticMarkup(
      <ForwardMessageModal
        isOpen={true}
        sourceMessage={sampleMessage}
        conversations={mockTargets}
        onClose={() => {}}
        onConfirmForward={() => {}}
      />,
    )

    expect(html).toContain('data-testid="forward-message-modal"')
    expect(html).toContain('data-testid="forward-message-preview"')
    expect(html).toContain('Foto bukti serah terima barang di gudang.')
    expect(html).toContain('data-testid="forward-search-input"')
    expect(html).toContain('Grup Teknisi Lapangan')
    expect(html).toContain('Budi Santoso Finance')
    expect(html).toContain('data-testid="btn-submit-forward"')
    expect(html).toContain('data-testid="btn-cancel-forward"')
  })

  it('ForwardMessageModal should return null when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <ForwardMessageModal
        isOpen={false}
        sourceMessage={sampleMessage}
        onClose={() => {}}
        onConfirmForward={() => {}}
      />,
    )
    expect(html).toBe('')
  })
})
