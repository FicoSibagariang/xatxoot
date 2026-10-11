import { describe, expect, it } from 'bun:test'
import type { BotFlowDefinition } from '@xatxoot/shared'
import { renderToStaticMarkup } from 'react-dom/server'
import { VisualFlowBuilder, validateFlowDefinition } from './VisualFlowBuilder'

describe('Visual Flow Builder Component (Task 2.19 - apps/web)', () => {
  const sampleValidFlow: BotFlowDefinition = {
    startNodeId: 'node-msg-1',
    nodes: [
      {
        id: 'node-msg-1',
        type: 'message',
        name: 'Sambutan Selamat Datang',
        data: {
          text: 'Halo! Selamat datang di layanan asisten virtual kami. Ada yang bisa dibantu?',
        },
      },
      {
        id: 'node-q-1',
        type: 'question',
        name: 'Tanya Kategori Kendala',
        data: {
          question: 'Silakan pilih kategori kendala Anda:',
          questionType: 'choice',
          variableName: 'kategori_kendala',
          options: [
            { id: 'opt-1', label: '1. Kendala Pengiriman', value: 'ekspedisi' },
            { id: 'opt-2', label: '2. Pembayaran & Tagihan', value: 'billing' },
          ],
        },
      },
      {
        id: 'node-http-1',
        type: 'http',
        name: 'Cek Status Tagihan',
        data: {
          url: 'https://api.external.com/billing/check',
          method: 'POST',
          responseVariable: 'status_billing',
        },
      },
      {
        id: 'node-branch-1',
        type: 'branch',
        name: 'Evaluasi Kategori',
        data: {
          conditions: [
            {
              id: 'cond-1',
              variable: 'kategori_kendala',
              operator: 'equals',
              value: 'billing',
              targetNodeId: 'node-http-1',
            },
          ],
          fallbackNodeId: 'node-handoff-1',
        },
      },
      {
        id: 'node-handoff-1',
        type: 'handoff',
        name: 'Eskalasi ke Agen CS',
        data: {
          priority: 'high',
          handoffMessage: 'Pelanggan dialihkan ke tim CS manusia.',
        },
      },
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'node-msg-1',
        target: 'node-q-1',
      },
      {
        id: 'edge-2',
        source: 'node-q-1',
        target: 'node-branch-1',
      },
    ],
  }

  describe('validateFlowDefinition Helper', () => {
    it('should validate valid flow definition successfully', () => {
      const result = validateFlowDefinition(sampleValidFlow)
      expect(result.isValid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('should return errors when flow has no nodes', () => {
      const emptyFlow: BotFlowDefinition = {
        startNodeId: 'node-1',
        nodes: [] as unknown as BotFlowDefinition['nodes'],
        edges: [],
      }
      const result = validateFlowDefinition(emptyFlow)
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some((e) => e.includes('Minimal satu node'))).toBe(true)
    })

    it('should return errors when startNodeId does not exist in nodes list', () => {
      const invalidStartFlow: BotFlowDefinition = {
        startNodeId: 'node-tidak-ada',
        nodes: [
          {
            id: 'node-msg-1',
            type: 'message',
            data: { text: 'Halo' },
          },
        ],
        edges: [],
      }
      const result = validateFlowDefinition(invalidStartFlow)
      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.includes('Start node ID'))).toBe(true)
    })
  })

  describe('VisualFlowBuilder Rendering', () => {
    it('should render canvas, node toolbar, and all node cards with type badges', () => {
      const html = renderToStaticMarkup(
        <VisualFlowBuilder
          initialFlow={sampleValidFlow}
          flowName="Bot Layanan Mandiri Pelanggan"
          triggerType="conversation_opened"
          isActive={true}
          onSave={() => {}}
        />,
      )

      // Main canvas & header
      expect(html).toContain('data-testid="flow-builder-canvas"')
      expect(html).toContain('data-testid="flow-toolbar"')
      expect(html).toContain('Bot Layanan Mandiri Pelanggan')

      // Toolbar action buttons
      expect(html).toContain('data-testid="btn-add-message"')
      expect(html).toContain('data-testid="btn-add-question"')
      expect(html).toContain('data-testid="btn-add-http"')
      expect(html).toContain('data-testid="btn-add-branch"')
      expect(html).toContain('data-testid="btn-add-handoff"')

      // Node cards on canvas
      expect(html).toContain('data-testid="flow-node-node-msg-1"')
      expect(html).toContain('data-testid="flow-node-node-q-1"')
      expect(html).toContain('data-testid="flow-node-node-http-1"')
      expect(html).toContain('data-testid="flow-node-node-branch-1"')
      expect(html).toContain('data-testid="flow-node-node-handoff-1"')

      // Node type labels
      expect(html).toContain('Pesan')
      expect(html).toContain('Pertanyaan')
      expect(html).toContain('HTTP Request')
      expect(html).toContain('Percabangan')
      expect(html).toContain('Handoff ke Agent')

      // Start node badge
      expect(html).toContain('data-testid="start-node-badge"')
    })

    it('should render node inspector panel with form fields when a node is selected', () => {
      const html = renderToStaticMarkup(
        <VisualFlowBuilder
          initialFlow={sampleValidFlow}
          selectedNodeId="node-msg-1"
          onSave={() => {}}
        />,
      )

      expect(html).toContain('data-testid="node-inspector"')
      expect(html).toContain('Sambutan Selamat Datang')
      expect(html).toContain('data-testid="inspector-message-text"')
      expect(html).toContain('Halo! Selamat datang di layanan asisten virtual kami.')
    })

    it('should render question node details and options in inspector when question node is selected', () => {
      const html = renderToStaticMarkup(
        <VisualFlowBuilder
          initialFlow={sampleValidFlow}
          selectedNodeId="node-q-1"
          onSave={() => {}}
        />,
      )

      expect(html).toContain('data-testid="node-inspector"')
      expect(html).toContain('data-testid="inspector-question-text"')
      expect(html).toContain('Silakan pilih kategori kendala Anda:')
      expect(html).toContain('kategori_kendala')
      expect(html).toContain('Kendala Pengiriman')
      expect(html).toContain('Pembayaran &amp; Tagihan')
    })

    it('should render edges list and save button with validation indicator', () => {
      const html = renderToStaticMarkup(
        <VisualFlowBuilder initialFlow={sampleValidFlow} onSave={() => {}} />,
      )

      expect(html).toContain('data-testid="btn-save-flow"')
      expect(html).toContain('data-testid="edge-list-panel"')
      expect(html).toContain('data-testid="edge-item-edge-1"')
      expect(html).toContain('data-testid="edge-item-edge-2"')
    })
  })
})
