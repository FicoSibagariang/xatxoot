import { describe, expect, it } from 'bun:test'
import type { WhatsAppTemplate } from '@xatxoot/shared'
import { renderToStaticMarkup } from 'react-dom/server'
import { ConversationThread } from '../layout/WhatsAppLayout'
import {
  type TemplateVariableValues,
  WhatsAppTemplateDialog,
  buildSendTemplatePayload,
  extractTemplateVariables,
  replaceTemplateVariables,
} from './WhatsAppTemplateDialog'

describe('WhatsApp Message Template Selector Dialog with Dynamic Variables (Task 2.21 - apps/web)', () => {
  const mockTemplates: WhatsAppTemplate[] = [
    {
      id: 'a0000000-0000-0000-0000-000000000001',
      wabaTemplateId: 'waba-order-confirmation',
      name: 'order_confirmation',
      language: 'id',
      category: 'UTILITY',
      status: 'APPROVED',
      components: [
        {
          type: 'HEADER',
          format: 'TEXT',
          text: 'Konfirmasi Pesanan #{{1}}',
        },
        {
          type: 'BODY',
          text: 'Halo {{1}}, terima kasih telah berbelanja di {{2}}. Pesanan Anda senilai {{3}} sedang diproses.',
        },
        {
          type: 'FOOTER',
          text: 'Balas STOP untuk berhenti berlangganan.',
        },
        {
          type: 'BUTTONS',
          buttons: [
            {
              type: 'QUICK_REPLY',
              text: 'Lacak Pesanan',
            },
          ],
        },
      ],
      createdAt: '2026-10-10T10:00:00Z',
      updatedAt: '2026-10-10T10:00:00Z',
    },
    {
      id: 'a0000000-0000-0000-0000-000000000002',
      wabaTemplateId: 'waba-shipping-update',
      name: 'shipping_receipt_media',
      language: 'id',
      category: 'UTILITY',
      status: 'APPROVED',
      components: [
        {
          type: 'HEADER',
          format: 'IMAGE',
        },
        {
          type: 'BODY',
          text: 'Paket nomor resi {{1}} telah dikirim menggunakan kurir {{2}}.',
        },
      ],
      createdAt: '2026-10-10T11:00:00Z',
      updatedAt: '2026-10-10T11:00:00Z',
    },
    {
      id: 'a0000000-0000-0000-0000-000000000003',
      wabaTemplateId: 'waba-flash-sale',
      name: 'promo_flash_sale',
      language: 'id',
      category: 'MARKETING',
      status: 'APPROVED',
      components: [
        {
          type: 'BODY',
          text: 'Promo spesial diskon {{1}}% berlaku hingga {{2}}!',
        },
      ],
      createdAt: '2026-10-10T12:00:00Z',
      updatedAt: '2026-10-10T12:00:00Z',
    },
  ]

  const mockConversationId = 'c0000000-0000-0000-0000-000000000001'

  describe('Variable Extraction & Substitution Helper Functions', () => {
    it('should extract sorted variable indices from template component text', () => {
      const vars = extractTemplateVariables({
        type: 'BODY',
        text: 'Halo {{1}}, pesanan {{2}} sedang diproses ke alamat {{3}}.',
      })
      expect(vars).toEqual([1, 2, 3])
    })

    it('should return empty array if component text has no variables', () => {
      const vars = extractTemplateVariables({
        type: 'FOOTER',
        text: 'Terima kasih atas kepercayaan Anda.',
      })
      expect(vars).toEqual([])
    })

    it('should substitute placeholder variables with provided user values in live preview', () => {
      const templateText = 'Halo {{1}}, pesanan {{2}} senilai {{3}} siap dikirim.'
      const substituted = replaceTemplateVariables(templateText, {
        1: 'Budi Santoso',
        2: 'ORD-9981',
        3: 'Rp 250.000',
      })

      expect(substituted).toBe(
        'Halo Budi Santoso, pesanan ORD-9981 senilai Rp 250.000 siap dikirim.',
      )
    })

    it('should retain fallback placeholder syntax if variable is not yet filled', () => {
      const templateText = 'Halo {{1}}, invoice {{2}}.'
      const substituted = replaceTemplateVariables(templateText, {
        1: 'Dewi',
      })

      expect(substituted).toBe('Halo Dewi, invoice {{2}}.')
    })

    it('should correctly build SendWhatsAppTemplateMessageInput payload for outbound submission', () => {
      const values: TemplateVariableValues = {
        headerVars: { 1: 'INV-1002' },
        bodyVars: {
          1: 'Sarah',
          2: 'Toko Xatxoot',
          3: 'Rp 500.000',
        },
      }

      const payload = buildSendTemplatePayload(mockTemplates[0], mockConversationId, values)

      expect(payload.conversationId).toBe(mockConversationId)
      expect(payload.templateName).toBe('order_confirmation')
      expect(payload.languageCode).toBe('id')
      expect(payload.components.length).toBe(2)

      // Header component
      const headerComp = payload.components.find((c) => c.type === 'header')
      expect(headerComp).toBeDefined()
      expect(headerComp?.parameters[0]).toEqual({
        type: 'text',
        text: 'INV-1002',
      })

      // Body component
      const bodyComp = payload.components.find((c) => c.type === 'body')
      expect(bodyComp).toBeDefined()
      expect(bodyComp?.parameters.length).toBe(3)
      expect(bodyComp?.parameters[0]).toEqual({ type: 'text', text: 'Sarah' })
      expect(bodyComp?.parameters[1]).toEqual({ type: 'text', text: 'Toko Xatxoot' })
      expect(bodyComp?.parameters[2]).toEqual({ type: 'text', text: 'Rp 500.000' })
    })

    it('should build header media parameter payload if header is an image URL', () => {
      const values: TemplateVariableValues = {
        headerMediaUrl: 'https://cdn.example.com/receipt.jpg',
        bodyVars: {
          1: 'RESI-8899',
          2: 'JNE Express',
        },
      }

      const payload = buildSendTemplatePayload(mockTemplates[1], mockConversationId, values)

      expect(payload.templateName).toBe('shipping_receipt_media')
      const headerComp = payload.components.find((c) => c.type === 'header')
      expect(headerComp).toBeDefined()
      expect(headerComp?.parameters[0]).toEqual({
        type: 'image',
        image: {
          link: 'https://cdn.example.com/receipt.jpg',
        },
      })
    })
  })

  describe('Modal Dialog Visibility & Template Listing', () => {
    it('should NOT render modal when isOpen is false', () => {
      const html = renderToStaticMarkup(
        <WhatsAppTemplateDialog
          isOpen={false}
          conversationId={mockConversationId}
          templates={mockTemplates}
          onClose={() => {}}
          onSendTemplate={() => {}}
        />,
      )

      expect(html).not.toContain('data-testid="whatsapp-template-dialog"')
    })

    it('should render modal dialog with template cards and search bar when isOpen is true', () => {
      const html = renderToStaticMarkup(
        <WhatsAppTemplateDialog
          isOpen={true}
          conversationId={mockConversationId}
          templates={mockTemplates}
          onClose={() => {}}
          onSendTemplate={() => {}}
        />,
      )

      expect(html).toContain('data-testid="whatsapp-template-dialog"')
      expect(html).toContain('data-testid="btn-close-template-dialog"')
      expect(html).toContain('data-testid="input-template-search"')
      expect(html).toContain('data-testid="filter-template-category"')
      expect(html).toContain('order_confirmation')
      expect(html).toContain('shipping_receipt_media')
      expect(html).toContain('promo_flash_sale')
      expect(html).toContain('UTILITY')
      expect(html).toContain('MARKETING')
    })
  })

  describe('Dynamic Variable Form Inputs & Live Preview', () => {
    it('should render input fields for all detected variables and media formats for selected template', () => {
      const html = renderToStaticMarkup(
        <WhatsAppTemplateDialog
          isOpen={true}
          conversationId={mockConversationId}
          templates={mockTemplates}
          selectedTemplateId={mockTemplates[0].id}
          onClose={() => {}}
          onSendTemplate={() => {}}
        />,
      )

      // Variables form section
      expect(html).toContain('data-testid="template-variables-form"')
      // Header variable 1
      expect(html).toContain('data-testid="input-var-header-1"')
      // Body variables 1, 2, 3
      expect(html).toContain('data-testid="input-var-body-1"')
      expect(html).toContain('data-testid="input-var-body-2"')
      expect(html).toContain('data-testid="input-var-body-3"')

      // Live Preview WhatsApp bubble
      expect(html).toContain('data-testid="template-live-preview"')
      expect(html).toContain('data-testid="preview-header"')
      expect(html).toContain('data-testid="preview-body"')
      expect(html).toContain('data-testid="preview-footer"')
      expect(html).toContain('data-testid="preview-buttons"')
      expect(html).toContain('Lacak Pesanan')

      // Send button
      expect(html).toContain('data-testid="btn-send-template"')
    })

    it('should render media URL input when template has IMAGE header', () => {
      const html = renderToStaticMarkup(
        <WhatsAppTemplateDialog
          isOpen={true}
          conversationId={mockConversationId}
          templates={mockTemplates}
          selectedTemplateId={mockTemplates[1].id}
          onClose={() => {}}
          onSendTemplate={() => {}}
        />,
      )

      expect(html).toContain('data-testid="input-var-header-media"')
      expect(html).toContain('data-testid="input-var-body-1"')
      expect(html).toContain('data-testid="input-var-body-2"')
      expect(html).not.toContain('data-testid="input-var-header-1"')
    })

    it('should reflect filled variable values inside live preview bubble', () => {
      const initialValues: TemplateVariableValues = {
        headerVars: { 1: 'INV-90210' },
        bodyVars: {
          1: 'Fico',
          2: 'Xatxoot Official Store',
          3: 'Rp 1.250.000',
        },
      }

      const html = renderToStaticMarkup(
        <WhatsAppTemplateDialog
          isOpen={true}
          conversationId={mockConversationId}
          templates={mockTemplates}
          selectedTemplateId={mockTemplates[0].id}
          initialValues={initialValues}
          onClose={() => {}}
          onSendTemplate={() => {}}
        />,
      )

      expect(html).toContain('Konfirmasi Pesanan #INV-90210')
      expect(html).toContain('Halo Fico, terima kasih telah berbelanja di Xatxoot Official Store.')
      expect(html).toContain('Pesanan Anda senilai Rp 1.250.000 sedang diproses.')
    })
  })

  describe('Integration with ConversationThread composer bar', () => {
    it('should render template dialog trigger button in ConversationThread input bar', () => {
      const html = renderToStaticMarkup(
        <ConversationThread
          conversation={{
            id: mockConversationId,
            contactName: 'Budi Test',
            channel: 'whatsapp',
          }}
          isDrawerOpen={false}
          onToggleDrawer={() => {}}
          onSendMessage={() => {}}
          onAssignTicket={() => {}}
          onResolveTicket={() => {}}
          onOpenTemplateDialog={() => {}}
        />,
      )

      expect(html).toContain('data-testid="btn-open-template-dialog"')
    })
  })
})
