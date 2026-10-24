import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChatBubble, formatWhatsAppText } from './ChatTimeline'
import type { TimelineMessage } from './types'

describe('WhatsApp Mention Recognition & Visual Formatting (Issue #301 - TDD RED)', () => {
  it('formatWhatsAppText should replace raw LID mention with contact name badge and tooltip', () => {
    const rawText = 'Halo @137185600737333 tolong bantu follow up ya'
    const mentions = [
      {
        jid: '137185600737333@lid',
        phone: '+6289621475546',
        name: 'Fini Ardiani D',
      },
    ]

    const html = formatWhatsAppText(rawText, { mentions })

    expect(html).toContain('data-testid="mention-badge"')
    expect(html).toContain('@Fini Ardiani D')
    expect(html).toContain('title="+6289621475546"')
    expect(html).not.toContain('@137185600737333')
  })

  it('formatWhatsAppText should render @Anda badge when isMentioningMe is true', () => {
    const rawText = 'Halo @6281200001111 mohon info tiket'
    const mentions = [
      {
        jid: '6281200001111@s.whatsapp.net',
        phone: '+6281200001111',
        name: 'CS Admin',
        isMe: true,
      },
    ]

    const html = formatWhatsAppText(rawText, { mentions, isMentioningMe: true })

    expect(html).toContain('data-testid="mention-me-badge"')
    expect(html).toContain('@Anda')
  })

  it('ChatBubble should render mention badges and highlight when isMentioningMe is true', () => {
    const sampleMessage: TimelineMessage = {
      id: 'msg-mention-1',
      conversationId: 'conv-01',
      messageType: 'incoming',
      contentType: 'text',
      content: 'Pagi tim, @137185600737333 dan @6281200001111 tolong cek server.',
      timestamp: '09:15',
      mentions: [
        {
          jid: '137185600737333@lid',
          phone: '+6289621475546',
          name: 'Fini Ardiani D',
        },
        {
          jid: '6281200001111@s.whatsapp.net',
          phone: '+6281200001111',
          name: 'Akun Tim',
          isMe: true,
        },
      ],
      isMentioningMe: true,
    }

    const html = renderToStaticMarkup(<ChatBubble message={sampleMessage} />)

    expect(html).toContain('data-testid="mention-badge"')
    expect(html).toContain('@Fini Ardiani D')
    expect(html).toContain('data-testid="mention-me-badge"')
    expect(html).toContain('@Anda')
    expect(html).toContain('data-testid="chat-bubble-mention-highlight"')
  })
})
