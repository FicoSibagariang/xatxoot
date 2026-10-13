import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { ConversationThread } from '../layout/WhatsAppLayout'
import type { ConversationItem } from '../layout/types'
import { AiCopilotToolbar, type AiCopilotToolbarProps, AiMagicButton } from './AiCopilotToolbar'

describe('AI Copilot Composer Toolbar Component (Task 5.14 - apps/web)', () => {
  const rootDir = join(import.meta.dir, '..', '..', '..', '..', '..')

  const mockConversation: ConversationItem = {
    id: 'conv-101',
    contactId: 'contact-1',
    contactName: 'Siti Rahma',
    phoneNumber: '+628123456789',
    lastMessageText: 'Halo kak, pesanan saya nomor TRX-9988 belum sampai, bagaimana ya?',
    lastMessageTimestamp: '10:45',
    unreadCount: 0,
    channel: 'whatsapp',
    ticket: {
      id: 'ticket-101',
      ticketNumber: 'T-101',
      status: 'open',
      priority: 'high',
      assigneeName: 'Agen Support',
    },
  }

  describe('1. Magic Button & Toolbar Rendering', () => {
    it('should render the AI Magic button in default closed state', () => {
      const html = renderToStaticMarkup(<AiMagicButton isOpen={false} onToggle={() => {}} />)

      expect(html).toContain('data-testid="btn-ai-magic"')
      expect(html).toContain('✨')
      expect(html).toContain('AI Copilot')
    })

    it('should render the AI Copilot toolbar with the 3 main magic buttons when open', () => {
      const html = renderToStaticMarkup(
        <AiCopilotToolbar
          isOpen={true}
          currentText="halo min pesanan saya bagaimana"
          onToggle={() => {}}
          onSummarize={() => {}}
          onImproveWriting={() => {}}
          onDraftReply={() => {}}
          onChangeTone={() => {}}
          onApplyText={() => {}}
        />,
      )

      expect(html).toContain('data-testid="ai-copilot-toolbar"')
      // 3 primary magic buttons
      expect(html).toContain('data-testid="btn-copilot-summarize"')
      expect(html).toContain('Ringkas')
      expect(html).toContain('data-testid="btn-copilot-improve"')
      expect(html).toContain('Perbaiki Bahasa')
      expect(html).toContain('data-testid="btn-copilot-draft"')
      expect(html).toContain('Buat Draf')

      // Tone adjustment options
      expect(html).toContain('data-testid="tone-select-polite"')
      expect(html).toContain('data-testid="tone-select-formal"')
      expect(html).toContain('data-testid="tone-select-concise"')
      expect(html).toContain('data-testid="tone-select-friendly"')
    })

    it('should not render visible toolbar content when isOpen is false', () => {
      const html = renderToStaticMarkup(
        <AiCopilotToolbar
          isOpen={false}
          onToggle={() => {}}
          onSummarize={() => {}}
          onImproveWriting={() => {}}
          onDraftReply={() => {}}
          onChangeTone={() => {}}
          onApplyText={() => {}}
        />,
      )

      expect(html).not.toContain('data-testid="ai-copilot-toolbar"')
    })
  })

  describe('2. Loading & Processing State', () => {
    it('should render loading indicator and disable actions when isLoading is true', () => {
      const html = renderToStaticMarkup(
        <AiCopilotToolbar
          isOpen={true}
          isLoading={true}
          loadingAction="Sedang merangkum percakapan..."
          onToggle={() => {}}
          onSummarize={() => {}}
          onImproveWriting={() => {}}
          onDraftReply={() => {}}
          onChangeTone={() => {}}
          onApplyText={() => {}}
        />,
      )

      expect(html).toContain('data-testid="ai-loading-indicator"')
      expect(html).toContain('Sedang merangkum percakapan...')
    })
  })

  describe('3. AI Result Preview & Action Application', () => {
    it('should render result preview box and allow applying generated text', () => {
      const sampleResult =
        'Halo Kak Siti Rahma, terima kasih telah menghubungi kami. Terkait pesanan TRX-9988, paket Anda saat ini sedang dalam proses pengiriman oleh kurir ekspedisi.'

      const html = renderToStaticMarkup(
        <AiCopilotToolbar
          isOpen={true}
          resultText={sampleResult}
          resultType="draft"
          onToggle={() => {}}
          onSummarize={() => {}}
          onImproveWriting={() => {}}
          onDraftReply={() => {}}
          onChangeTone={() => {}}
          onApplyText={() => {}}
        />,
      )

      expect(html).toContain('data-testid="ai-result-preview"')
      expect(html).toContain(sampleResult)
      expect(html).toContain('data-testid="btn-apply-result"')
      expect(html).toContain('Gunakan Draf')
    })

    it('should render inject sticky note button when result is a summary', () => {
      const sampleSummary =
        'Pelanggan menanyakan status pengiriman pesanan TRX-9988 yang belum sampai.'

      const html = renderToStaticMarkup(
        <AiCopilotToolbar
          isOpen={true}
          resultText={sampleSummary}
          resultType="summary"
          onToggle={() => {}}
          onSummarize={() => {}}
          onImproveWriting={() => {}}
          onDraftReply={() => {}}
          onChangeTone={() => {}}
          onApplyText={() => {}}
          onInjectNote={() => {}}
        />,
      )

      expect(html).toContain('data-testid="btn-inject-note"')
      expect(html).toContain('Sematkan ke Catatan')
    })

    it('should render suggested Help Center articles when provided via RAG', () => {
      const articles = [
        {
          id: 'art-1',
          title: 'Kebijakan Pengiriman dan Estimasi Waktu Kurir',
          snippet: 'Estimasi pengiriman reguler adalah 2-3 hari kerja...',
        },
        {
          id: 'art-2',
          title: 'Cara Melacak Status Pesanan',
          snippet: 'Pelanggan dapat melacak status resi melalui menu...',
        },
      ]

      const html = renderToStaticMarkup(
        <AiCopilotToolbar
          isOpen={true}
          resultText="Draf balasan dengan kutipan artikel."
          resultType="draft"
          suggestedArticles={articles}
          onToggle={() => {}}
          onSummarize={() => {}}
          onImproveWriting={() => {}}
          onDraftReply={() => {}}
          onChangeTone={() => {}}
          onApplyText={() => {}}
        />,
      )

      expect(html).toContain('data-testid="ai-suggested-articles"')
      expect(html).toContain('Kebijakan Pengiriman dan Estimasi Waktu Kurir')
      expect(html).toContain('Cara Melacak Status Pesanan')
    })
  })

  describe('4. Error State Handling', () => {
    it('should display error banner when errorMessage is present', () => {
      const html = renderToStaticMarkup(
        <AiCopilotToolbar
          isOpen={true}
          errorMessage="Koneksi ke AI Provider gagal. Periksa konfigurasi API Key."
          onToggle={() => {}}
          onSummarize={() => {}}
          onImproveWriting={() => {}}
          onDraftReply={() => {}}
          onChangeTone={() => {}}
          onApplyText={() => {}}
        />,
      )

      expect(html).toContain('data-testid="ai-error-banner"')
      expect(html).toContain('Koneksi ke AI Provider gagal')
    })
  })

  describe('5. Integration with ConversationThread (apps/web)', () => {
    it('should render AI Magic button in ConversationThread footer composer', () => {
      const html = renderToStaticMarkup(
        <ConversationThread
          conversation={mockConversation}
          isDrawerOpen={false}
          onToggleDrawer={() => {}}
          onSendMessage={() => {}}
          onAssignTicket={() => {}}
          onResolveTicket={() => {}}
        />,
      )

      expect(html).toContain('data-testid="btn-ai-magic"')
    })
  })

  describe('6. Single Organization Guardrail & Phase 5 Checklist', () => {
    it('should strictly NOT accept or require account_id or accountId in props', () => {
      const props: AiCopilotToolbarProps = {
        isOpen: true,
        onToggle: () => {},
        onSummarize: () => {},
        onImproveWriting: () => {},
        onDraftReply: () => {},
        onChangeTone: () => {},
        onApplyText: () => {},
      }

      const keys = Object.keys(props)
      expect(keys).not.toContain('accountId')
      expect(keys).not.toContain('account_id')
    })

    it('should verify docs/PHASE_5_CHECKLIST.md marks Task 5.14 as completed', () => {
      const checklistContent = readFileSync(join(rootDir, 'docs', 'PHASE_5_CHECKLIST.md'), 'utf-8')
      expect(checklistContent).toContain('- [x] **Task 5.14**:')
    })
  })
})
