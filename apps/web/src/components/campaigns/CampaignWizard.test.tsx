import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  type CampaignContactOption,
  type CampaignFormData,
  type CampaignInboxOption,
  type CampaignLabelOption,
  CampaignWizard,
  calculateEstimatedDuration,
  validateCampaignWizardStep,
} from './CampaignWizard'

describe('Campaign Creation Wizard & Broadcast Dispatcher (Task 4.16 - apps/web)', () => {
  const mockInboxes: CampaignInboxOption[] = [
    {
      id: 'inbox-wa-main',
      name: 'WhatsApp Bisnis Utama',
      channel: 'whatsapp',
      phoneNumber: '+6281234567890',
    },
    {
      id: 'inbox-wa-cs',
      name: 'WhatsApp CS Care',
      channel: 'whatsapp',
      phoneNumber: '+6289876543210',
    },
  ]

  const mockLabels: CampaignLabelOption[] = [
    { id: 'lbl-vip', name: 'VIP Customer', color: '#10b981', contactsCount: 45 },
    { id: 'lbl-wholesale', name: 'Grosir & Reseller', color: '#3b82f6', contactsCount: 80 },
    { id: 'lbl-leads', name: 'Prospek Baru', color: '#f59e0b', contactsCount: 120 },
  ]

  const mockContacts: CampaignContactOption[] = [
    { id: 'cnt-1', name: 'Budi Santoso', phone: '+6281234567890' },
    { id: 'cnt-2', name: 'Siti Rahma', phone: '+6289876543210' },
    { id: 'cnt-3', name: 'Ahmad Fauzi', phone: '+6287711223344' },
  ]

  const mockCampaign: CampaignFormData = {
    title: 'Flash Sale Akhir Pekan 50%',
    inboxId: 'inbox-wa-main',
    messageContent:
      'Halo {{name}}, nikmati diskon spesial 50% untuk semua kategori produk hari ini!',
    audienceType: 'labels',
    selectedLabelIds: ['lbl-vip', 'lbl-wholesale'],
    selectedContactIds: [],
    antiBanDelayMin: 15,
    antiBanDelayMax: 45,
    randomizeJitter: true,
    isScheduled: false,
    status: 'draft',
    progress: {
      total: 125,
      sent: 75,
      failed: 2,
      pending: 48,
      percentage: 60,
    },
  }

  describe('Duration Estimation & Step Validation Helpers', () => {
    it('should calculate readable estimated dispatch duration based on recipients and throttle delay', () => {
      // 100 pesan x rata-rata 30 detik (15-45) = 3000 detik = 50 menit
      expect(calculateEstimatedDuration(100, 15, 45)).toContain('50 menit')
      // 10 pesan x rata-rata 30 detik = 300 detik = 5 menit
      expect(calculateEstimatedDuration(10, 15, 45)).toContain('5 menit')
      // 0 pesan
      expect(calculateEstimatedDuration(0, 15, 45)).toBe('0 menit')
    })

    it('should validate Step 1 (Message Details)', () => {
      expect(validateCampaignWizardStep(1, { ...mockCampaign, title: '' }).isValid).toBe(false)
      expect(validateCampaignWizardStep(1, { ...mockCampaign, messageContent: '' }).isValid).toBe(
        false,
      )
      expect(validateCampaignWizardStep(1, mockCampaign).isValid).toBe(true)
    })

    it('should validate Step 2 (Audience Selection)', () => {
      expect(
        validateCampaignWizardStep(2, {
          ...mockCampaign,
          audienceType: 'labels',
          selectedLabelIds: [],
        }).isValid,
      ).toBe(false)
      expect(
        validateCampaignWizardStep(2, {
          ...mockCampaign,
          audienceType: 'custom_list',
          selectedContactIds: [],
        }).isValid,
      ).toBe(false)
      expect(
        validateCampaignWizardStep(2, {
          ...mockCampaign,
          audienceType: 'all_contacts',
        }).isValid,
      ).toBe(true)
      expect(validateCampaignWizardStep(2, mockCampaign).isValid).toBe(true)
    })

    it('should validate Step 3 (Anti-Ban Throttle)', () => {
      expect(
        validateCampaignWizardStep(3, {
          ...mockCampaign,
          antiBanDelayMin: 50,
          antiBanDelayMax: 30,
        }).isValid,
      ).toBe(false)
      expect(
        validateCampaignWizardStep(3, {
          ...mockCampaign,
          antiBanDelayMin: 0,
        }).isValid,
      ).toBe(false)
      expect(validateCampaignWizardStep(3, mockCampaign).isValid).toBe(true)
    })
  })

  describe('Step 1: Message Details & WhatsApp Live Bubble Preview', () => {
    it('should render campaign title input, inbox selector, message textarea, and live WhatsApp bubble preview', () => {
      const html = renderToStaticMarkup(
        <CampaignWizard
          initialStep={1}
          campaignData={mockCampaign}
          inboxes={mockInboxes}
          labels={mockLabels}
          contacts={mockContacts}
        />,
      )

      expect(html).toContain('data-testid="campaign-wizard"')
      expect(html).toContain('Wizard Pembuatan Campaign Broadcast')
      expect(html).toContain('data-testid="campaign-title-input"')
      expect(html).toContain('Flash Sale Akhir Pekan 50%')
      expect(html).toContain('data-testid="campaign-inbox-select"')
      expect(html).toContain('WhatsApp Bisnis Utama')
      expect(html).toContain('data-testid="campaign-message-textarea"')
      expect(html).toContain('data-testid="whatsapp-live-preview-bubble"')
      expect(html).toContain('Live WhatsApp Bubble Preview')
      expect(html).toContain('Halo {{name}}, nikmati diskon spesial 50%')
    })
  })

  describe('Step 2: Audience Selector (Target Penerima)', () => {
    it('should render audience type options: all_contacts, labels, and custom_list', () => {
      const html = renderToStaticMarkup(
        <CampaignWizard
          initialStep={2}
          campaignData={mockCampaign}
          inboxes={mockInboxes}
          labels={mockLabels}
          contacts={mockContacts}
        />,
      )

      expect(html).toContain('data-testid="audience-selector-step"')
      expect(html).toContain('data-testid="radio-audience-all"')
      expect(html).toContain('Semua Kontak')
      expect(html).toContain('data-testid="radio-audience-labels"')
      expect(html).toContain('Berdasarkan Label / Tag')
      expect(html).toContain('data-testid="radio-audience-custom"')
      expect(html).toContain('Daftar Kontak Tertentu')
      expect(html).toContain('VIP Customer')
      expect(html).toContain('Grosir &amp; Reseller')
    })
  })

  describe('Step 3: Anti-Ban Throttle Configuration', () => {
    it('should render delay range inputs, jitter toggle, and duration estimate indicator', () => {
      const html = renderToStaticMarkup(
        <CampaignWizard
          initialStep={3}
          campaignData={mockCampaign}
          inboxes={mockInboxes}
          labels={mockLabels}
          contacts={mockContacts}
        />,
      )

      expect(html).toContain('data-testid="anti-ban-throttle-step"')
      expect(html).toContain('Proteksi Anti-Ban Meta')
      expect(html).toContain('data-testid="input-delay-min"')
      expect(html).toContain('data-testid="input-delay-max"')
      expect(html).toContain('data-testid="toggle-randomize-jitter"')
      expect(html).toContain('Acak Jitter Variasi Waktu')
      expect(html).toContain('data-testid="duration-estimate-badge"')
      expect(html).toContain('Estimasi Durasi Pengiriman')
    })
  })

  describe('Step 4: Dispatch Confirmation & Live Delivery Progress Bar', () => {
    it('should render dispatch summary, live progress bar, and delivery metrics counters', () => {
      const html = renderToStaticMarkup(
        <CampaignWizard
          initialStep={4}
          campaignData={mockCampaign}
          inboxes={mockInboxes}
          labels={mockLabels}
          contacts={mockContacts}
        />,
      )

      expect(html).toContain('data-testid="campaign-progress-step"')
      expect(html).toContain('Progress Pengiriman Live')
      expect(html).toContain('data-testid="campaign-progress-bar"')
      expect(html).toContain('60%')
      expect(html).toContain('data-testid="stat-sent-count"')
      expect(html).toContain('75')
      expect(html).toContain('data-testid="stat-pending-count"')
      expect(html).toContain('48')
      expect(html).toContain('data-testid="stat-failed-count"')
      expect(html).toContain('2')
      expect(html).toContain('data-testid="btn-dispatch-campaign"')
      expect(html).toContain('Mulai Kirim Broadcast')
    })
  })

  describe('Single Organization Rule Guardrail & Phase 4 Checklist', () => {
    it('should strictly NOT contain or require accountId in Campaign Wizard code', () => {
      const code = readFileSync(join(__dirname, 'CampaignWizard.tsx'), 'utf-8')
      expect(code).not.toContain('account_id')
      expect(code).not.toContain('accountId')
    })

    it('should mark Task 4.16 as completed in docs/PHASE_4_CHECKLIST.md', () => {
      const checklist = readFileSync(
        join(__dirname, '../../../../../docs/PHASE_4_CHECKLIST.md'),
        'utf-8',
      )
      expect(checklist).toContain('- [x] **Task 4.16**')
    })
  })
})
