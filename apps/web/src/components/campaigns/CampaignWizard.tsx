import { type ReactNode, useMemo, useState } from 'react'

// ==========================================
// Types & Domain Interfaces
// (Single Organization: No tenant identifiers)
// ==========================================

export type CampaignAudienceType = 'all_contacts' | 'labels' | 'custom_list'
export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'processing'
  | 'completed'
  | 'cancelled'
  | 'failed'

export interface CampaignInboxOption {
  id: string
  name: string
  channel: string
  phoneNumber?: string
}

export interface CampaignLabelOption {
  id: string
  name: string
  color?: string
  contactsCount?: number
}

export interface CampaignContactOption {
  id: string
  name: string
  phone: string
}

export interface CampaignProgressData {
  total: number
  sent: number
  failed: number
  pending: number
  percentage: number
}

export interface CampaignFormData {
  id?: string
  title: string
  inboxId: string
  messageContent: string
  audienceType: CampaignAudienceType
  selectedLabelIds: string[]
  selectedContactIds: string[]
  antiBanDelayMin: number
  antiBanDelayMax: number
  randomizeJitter: boolean
  isScheduled: boolean
  scheduledAt?: string
  status: CampaignStatus
  progress?: CampaignProgressData
}

export interface CampaignWizardProps {
  initialStep?: 1 | 2 | 3 | 4
  campaignData?: Partial<CampaignFormData>
  inboxes?: CampaignInboxOption[]
  labels?: CampaignLabelOption[]
  contacts?: CampaignContactOption[]
  onSaveDraft?: (data: CampaignFormData) => void
  onDispatch?: (data: CampaignFormData) => void
  onCancel?: () => void
  className?: string
  children?: ReactNode
}

// ==========================================
// Helpers: Duration & Step Validation
// ==========================================

export function calculateEstimatedDuration(
  recipientsCount: number,
  delayMin: number,
  delayMax: number,
): string {
  if (!recipientsCount || recipientsCount <= 0) return '0 menit'
  const avgDelaySec = (delayMin + delayMax) / 2
  const totalSeconds = Math.round(recipientsCount * avgDelaySec)

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.ceil((totalSeconds % 3600) / 60)

  if (hours > 0) {
    return minutes > 0 ? `${hours} jam ${minutes} menit` : `${hours} jam`
  }
  return `${Math.max(1, minutes)} menit`
}

export function validateCampaignWizardStep(
  step: number,
  data: CampaignFormData,
): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (step === 1) {
    if (!data.title || !data.title.trim()) {
      errors.push('Judul kampanye wajib diisi')
    }
    if (!data.inboxId) {
      errors.push('Saluran WhatsApp wajib dipilih')
    }
    if (!data.messageContent || !data.messageContent.trim()) {
      errors.push('Teks pesan broadcast wajib diisi')
    }
  } else if (step === 2) {
    if (
      data.audienceType === 'labels' &&
      (!data.selectedLabelIds || data.selectedLabelIds.length === 0)
    ) {
      errors.push('Pilih setidaknya satu label audiens')
    }
    if (
      data.audienceType === 'custom_list' &&
      (!data.selectedContactIds || data.selectedContactIds.length === 0)
    ) {
      errors.push('Pilih setidaknya satu kontak penerima')
    }
  } else if (step === 3) {
    if (data.antiBanDelayMin <= 0) {
      errors.push('Delay minimum harus lebih besar dari 0 detik')
    }
    if (data.antiBanDelayMax < data.antiBanDelayMin) {
      errors.push('Delay maksimum tidak boleh lebih kecil dari delay minimum')
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

// ==========================================
// Default Mock Data
// ==========================================

export const DEFAULT_INBOXES: CampaignInboxOption[] = [
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

export const DEFAULT_LABELS: CampaignLabelOption[] = [
  { id: 'lbl-vip', name: 'VIP Customer', color: '#10b981', contactsCount: 45 },
  { id: 'lbl-wholesale', name: 'Grosir & Reseller', color: '#3b82f6', contactsCount: 80 },
  { id: 'lbl-leads', name: 'Prospek Baru', color: '#f59e0b', contactsCount: 120 },
]

export const DEFAULT_CONTACTS: CampaignContactOption[] = [
  { id: 'cnt-1', name: 'Budi Santoso', phone: '+6281234567890' },
  { id: 'cnt-2', name: 'Siti Rahma', phone: '+6289876543210' },
  { id: 'cnt-3', name: 'Ahmad Fauzi', phone: '+6287711223344' },
]

export const DEFAULT_CAMPAIGN_DATA: CampaignFormData = {
  title: 'Pengumuman Promo Spesial 2026',
  inboxId: 'inbox-wa-main',
  messageContent:
    'Halo {{name}}, dapatkan diskon istimewa hingga 40% khusus pelanggan setia hari ini!',
  audienceType: 'all_contacts',
  selectedLabelIds: [],
  selectedContactIds: [],
  antiBanDelayMin: 15,
  antiBanDelayMax: 45,
  randomizeJitter: true,
  isScheduled: false,
  status: 'draft',
  progress: {
    total: 100,
    sent: 0,
    failed: 0,
    pending: 100,
    percentage: 0,
  },
}

// ==========================================
// Main CampaignWizard Component
// ==========================================

export function CampaignWizard({
  initialStep = 1,
  campaignData = DEFAULT_CAMPAIGN_DATA,
  inboxes = DEFAULT_INBOXES,
  labels = DEFAULT_LABELS,
  contacts = DEFAULT_CONTACTS,
  onSaveDraft = () => {},
  onDispatch = () => {},
  onCancel = () => {},
  className = '',
  children,
}: CampaignWizardProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(initialStep)
  const [title, setTitle] = useState(campaignData.title || '')
  const [inboxId, setInboxId] = useState(campaignData.inboxId || inboxes[0]?.id || '')
  const [messageContent, setMessageContent] = useState(campaignData.messageContent || '')
  const [audienceType, setAudienceType] = useState<CampaignAudienceType>(
    campaignData.audienceType || 'all_contacts',
  )
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>(
    campaignData.selectedLabelIds || [],
  )
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(
    campaignData.selectedContactIds || [],
  )
  const [antiBanDelayMin, setAntiBanDelayMin] = useState(campaignData.antiBanDelayMin ?? 15)
  const [antiBanDelayMax, setAntiBanDelayMax] = useState(campaignData.antiBanDelayMax ?? 45)
  const [randomizeJitter, setRandomizeJitter] = useState(campaignData.randomizeJitter ?? true)
  const [isScheduled, setIsScheduled] = useState(campaignData.isScheduled ?? false)
  const [scheduledAt, setScheduledAt] = useState(campaignData.scheduledAt || '')
  const [status, setStatus] = useState<CampaignStatus>(campaignData.status || 'draft')
  const [stepError, setStepError] = useState<string | null>(null)

  // Recipient Count Calculation
  const estimatedRecipientsCount = useMemo(() => {
    if (audienceType === 'all_contacts') {
      return 250 // Estimasi total kontak
    }
    if (audienceType === 'labels') {
      return selectedLabelIds.reduce((sum, id) => {
        const found = labels.find((l) => l.id === id)
        return sum + (found?.contactsCount || 0)
      }, 0)
    }
    return selectedContactIds.length
  }, [audienceType, selectedLabelIds, selectedContactIds, labels])

  // Estimated Duration String
  const estimatedDuration = useMemo(
    () => calculateEstimatedDuration(estimatedRecipientsCount, antiBanDelayMin, antiBanDelayMax),
    [estimatedRecipientsCount, antiBanDelayMin, antiBanDelayMax],
  )

  const progress = campaignData.progress || {
    total: estimatedRecipientsCount,
    sent: 0,
    failed: 0,
    pending: estimatedRecipientsCount,
    percentage: 0,
  }

  const getFullFormData = (): CampaignFormData => ({
    id: campaignData.id,
    title,
    inboxId,
    messageContent,
    audienceType,
    selectedLabelIds,
    selectedContactIds,
    antiBanDelayMin,
    antiBanDelayMax,
    randomizeJitter,
    isScheduled,
    scheduledAt: isScheduled ? scheduledAt : undefined,
    status,
    progress,
  })

  const handleNextStep = () => {
    const data = getFullFormData()
    const validation = validateCampaignWizardStep(currentStep, data)
    if (!validation.isValid) {
      setStepError(validation.errors[0])
      return
    }
    setStepError(null)
    if (currentStep < 4) {
      setCurrentStep((prev) => (prev + 1) as 1 | 2 | 3 | 4)
    }
  }

  const handlePrevStep = () => {
    setStepError(null)
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4)
    }
  }

  const handleDispatchCampaign = () => {
    const data = getFullFormData()
    setStatus('processing')
    onDispatch({ ...data, status: 'processing' })
  }

  const toggleLabel = (id: string) => {
    setSelectedLabelIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  const toggleContact = (id: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  return (
    <div
      data-testid="campaign-wizard"
      className={`min-h-full w-full bg-wa-header-bg p-4 sm:p-6 lg:p-8 flex flex-col space-y-6 ${className}`}
    >
      {/* Top Header Card */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">📢</span>
            <h1 className="text-xl sm:text-2xl font-bold text-wa-text-primary tracking-tight">
              Wizard Pembuatan Campaign Broadcast
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Panduan 4-langkah merancang, menargetkan, dan mengirim pesan massal dengan proteksi
            anti-ban
          </p>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 px-3.5 py-2 rounded-lg border border-gray-200 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => onSaveDraft(getFullFormData())}
            className="text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 px-3.5 py-2 rounded-lg border border-gray-300 shadow-sm transition-colors cursor-pointer"
          >
            Simpan Draft
          </button>
        </div>
      </div>

      {/* Stepper Navigation Tabs */}
      <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { step: 1, label: '1. Pesan & Saluran', icon: '📝' },
          { step: 2, label: '2. Target Audiens', icon: '👥' },
          { step: 3, label: '3. Throttle Anti-Ban', icon: '🛡️' },
          { step: 4, label: '4. Dispatch & Progress', icon: '🚀' },
        ].map((s) => (
          <button
            key={s.step}
            type="button"
            onClick={() => {
              const validation = validateCampaignWizardStep(currentStep, getFullFormData())
              if (s.step < currentStep || validation.isValid) {
                setStepError(null)
                setCurrentStep(s.step as 1 | 2 | 3 | 4)
              }
            }}
            className={`flex items-center gap-2 p-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-left ${
              currentStep === s.step
                ? 'bg-wa-teal-primary text-white shadow-xs'
                : currentStep > s.step
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
          >
            <span className="text-sm">{s.icon}</span>
            <span className="truncate">{s.label}</span>
          </button>
        ))}
      </div>

      {stepError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <span>⚠️</span>
          <span>{stepError}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 1: Message Content & Live WhatsApp Bubble Preview */}
      {/* ======================================================== */}
      {currentStep === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form: Title, Inbox, Message Text */}
          <div className="lg:col-span-7 bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-base font-bold text-wa-text-primary flex items-center gap-2">
              <span>✍️</span> Detail & Konten Pesan
            </h2>

            <div>
              <label
                htmlFor="campaign-title-input"
                className="block text-xs font-semibold text-gray-700 mb-1"
              >
                Judul Kampanye
              </label>
              <input
                id="campaign-title-input"
                type="text"
                data-testid="campaign-title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Flash Sale Akhir Pekan 50%"
                className="w-full text-xs font-medium border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-wa-teal-primary focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="campaign-inbox-select"
                className="block text-xs font-semibold text-gray-700 mb-1"
              >
                Pilih Saluran WhatsApp Pengirim
              </label>
              <select
                id="campaign-inbox-select"
                data-testid="campaign-inbox-select"
                value={inboxId}
                onChange={(e) => setInboxId(e.target.value)}
                className="w-full text-xs font-medium border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-wa-teal-primary focus:border-transparent cursor-pointer"
              >
                {inboxes.map((ib) => (
                  <option key={ib.id} value={ib.id}>
                    {ib.name} ({ib.phoneNumber || 'Nomor WhatsApp'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="campaign-message-textarea"
                  className="block text-xs font-semibold text-gray-700"
                >
                  Teks Pesan Broadcast
                </label>
                <span className="text-[11px] text-gray-400">{messageContent.length} karakter</span>
              </div>
              <textarea
                id="campaign-message-textarea"
                data-testid="campaign-message-textarea"
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                rows={6}
                placeholder="Tulis pesan promosi atau pengumuman Anda di sini..."
                className="w-full text-xs font-medium border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-wa-teal-primary focus:border-transparent leading-relaxed"
              />
              <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-gray-500">
                <span>Variabel dinamis:</span>
                <button
                  type="button"
                  onClick={() => setMessageContent((prev) => `${prev} {{name}}`)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded cursor-pointer font-mono"
                >
                  {'{{name}}'}
                </button>
                <button
                  type="button"
                  onClick={() => setMessageContent((prev) => `${prev} {{phone}}`)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded cursor-pointer font-mono"
                >
                  {'{{phone}}'}
                </button>
              </div>
            </div>
          </div>

          {/* Right Preview: Live WhatsApp Chat Bubble Preview */}
          <div className="lg:col-span-5 bg-wa-chat-bg rounded-xl p-5 shadow-sm border border-gray-200 flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-gray-300/50 mb-4">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <span>📱</span> Live WhatsApp Bubble Preview
              </span>
              <span className="text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded font-semibold">
                WhatsApp Web
              </span>
            </div>

            {/* Simulated Chat Thread */}
            <div className="flex-1 flex flex-col justify-end py-4">
              <div
                data-testid="whatsapp-live-preview-bubble"
                className="self-end max-w-[90%] bg-wa-bubble-out text-wa-text-primary p-3 rounded-lg rounded-tr-none shadow-xs text-xs leading-relaxed relative"
              >
                <p className="whitespace-pre-wrap break-words">
                  {messageContent || 'Ketik pesan di sebelah kiri untuk melihat simulasi visual...'}
                </p>
                <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-gray-500 select-none">
                  <span>10:45</span>
                  <span className="text-wa-tick-blue">✓✓</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-300/50 text-[11px] text-gray-500 text-center">
              Penerima akan melihat pesan ini langsung di akun WhatsApp pribadi mereka.
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 2: Audience Selector (Target Penerima) */}
      {/* ======================================================== */}
      {currentStep === 2 && (
        <div
          data-testid="audience-selector-step"
          className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-5"
        >
          <div>
            <h2 className="text-base font-bold text-wa-text-primary flex items-center gap-2">
              <span>🎯</span> Pilih Target Audiens Penerima
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Tentukan segmen kontak WhatsApp yang akan menerima broadcast ini
            </p>
          </div>

          {/* 3 Radio Cards: all_contacts, labels, custom_list */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label
              data-testid="radio-audience-all"
              className={`p-4 rounded-xl border-2 flex flex-col justify-between cursor-pointer transition-all ${
                audienceType === 'all_contacts'
                  ? 'border-wa-teal-primary bg-emerald-50/40'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div>
                <input
                  type="radio"
                  name="audienceType"
                  checked={audienceType === 'all_contacts'}
                  onChange={() => setAudienceType('all_contacts')}
                  className="sr-only"
                />
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl">🌐</span>
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      audienceType === 'all_contacts' ? 'border-wa-teal-primary' : 'border-gray-300'
                    }`}
                  >
                    {audienceType === 'all_contacts' && (
                      <div className="w-2 h-2 rounded-full bg-wa-teal-primary" />
                    )}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-gray-900">Semua Kontak</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Kirim broadcast ke seluruh database kontak terdaftar
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 text-xs font-semibold text-emerald-700">
                ~250 Kontak
              </div>
            </label>

            <label
              data-testid="radio-audience-labels"
              className={`p-4 rounded-xl border-2 flex flex-col justify-between cursor-pointer transition-all ${
                audienceType === 'labels'
                  ? 'border-wa-teal-primary bg-emerald-50/40'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div>
                <input
                  type="radio"
                  name="audienceType"
                  checked={audienceType === 'labels'}
                  onChange={() => setAudienceType('labels')}
                  className="sr-only"
                />
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl">🏷️</span>
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      audienceType === 'labels' ? 'border-wa-teal-primary' : 'border-gray-300'
                    }`}
                  >
                    {audienceType === 'labels' && (
                      <div className="w-2 h-2 rounded-full bg-wa-teal-primary" />
                    )}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-gray-900">Berdasarkan Label / Tag</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Pilih kontak berdasarkan label segmentasi pelanggan
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 text-xs font-semibold text-emerald-700">
                Segmentasi Bertarget
              </div>
            </label>

            <label
              data-testid="radio-audience-custom"
              className={`p-4 rounded-xl border-2 flex flex-col justify-between cursor-pointer transition-all ${
                audienceType === 'custom_list'
                  ? 'border-wa-teal-primary bg-emerald-50/40'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div>
                <input
                  type="radio"
                  name="audienceType"
                  checked={audienceType === 'custom_list'}
                  onChange={() => setAudienceType('custom_list')}
                  className="sr-only"
                />
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl">📋</span>
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      audienceType === 'custom_list' ? 'border-wa-teal-primary' : 'border-gray-300'
                    }`}
                  >
                    {audienceType === 'custom_list' && (
                      <div className="w-2 h-2 rounded-full bg-wa-teal-primary" />
                    )}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-gray-900">Daftar Kontak Tertentu</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Pilih secara manual kontak tertentu dari buku kontak
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 text-xs font-semibold text-emerald-700">
                Pilihan Manual
              </div>
            </label>
          </div>

          {/* Conditional Sub-selector: Labels */}
          {audienceType === 'labels' && (
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
              <span className="text-xs font-semibold text-gray-700 block">
                Pilih Label Pelanggan:
              </span>
              <div className="flex flex-wrap gap-2.5">
                {labels.map((lbl) => {
                  const isChecked = selectedLabelIds.includes(lbl.id)
                  return (
                    <button
                      key={lbl.id}
                      type="button"
                      onClick={() => toggleLabel(lbl.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <span>🏷️</span>
                      <span>{lbl.name}</span>
                      <span className="opacity-80 text-[10px]">({lbl.contactsCount || 0})</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Conditional Sub-selector: Custom Contacts */}
          {audienceType === 'custom_list' && (
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
              <span className="text-xs font-semibold text-gray-700 block">
                Pilih Kontak Individual:
              </span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {contacts.map((cnt) => {
                  const isChecked = selectedContactIds.includes(cnt.id)
                  return (
                    <label
                      key={cnt.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-200 hover:border-gray-300 cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleContact(cnt.id)}
                          className="rounded text-wa-teal-primary focus:ring-wa-teal-primary"
                        />
                        <span className="font-semibold text-gray-800">{cnt.name}</span>
                      </div>
                      <span className="font-mono text-gray-500 text-[11px]">{cnt.phone}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* Summary Box */}
          <div className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-100 rounded-lg text-xs flex items-center justify-between">
            <span>Estimasi Jumlah Kontak Sasaran:</span>
            <span className="font-bold text-sm">{estimatedRecipientsCount} kontak</span>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 3: Anti-Ban Throttle Configuration */}
      {/* ======================================================== */}
      {currentStep === 3 && (
        <div
          data-testid="anti-ban-throttle-step"
          className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-5"
        >
          <div>
            <h2 className="text-base font-bold text-wa-text-primary flex items-center gap-2">
              <span>🛡️</span> Proteksi Anti-Ban Meta & Throttle Kecepatan
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Konfigurasi jeda acak antar pesan WhatsApp Baileys demi mencegah pemblokiran algoritma
              Meta
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="input-delay-min"
                className="block text-xs font-semibold text-gray-700 mb-1"
              >
                Delay Minimum Antar Pesan (Detik)
              </label>
              <input
                id="input-delay-min"
                type="number"
                data-testid="input-delay-min"
                value={antiBanDelayMin}
                min={5}
                max={120}
                onChange={(e) => setAntiBanDelayMin(Number(e.target.value))}
                className="w-full text-xs font-medium border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-wa-teal-primary focus:border-transparent"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">
                Rekomendasi aman: 15 detik
              </span>
            </div>

            <div>
              <label
                htmlFor="input-delay-max"
                className="block text-xs font-semibold text-gray-700 mb-1"
              >
                Delay Maksimum Antar Pesan (Detik)
              </label>
              <input
                id="input-delay-max"
                type="number"
                data-testid="input-delay-max"
                value={antiBanDelayMax}
                min={10}
                max={300}
                onChange={(e) => setAntiBanDelayMax(Number(e.target.value))}
                className="w-full text-xs font-medium border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-wa-teal-primary focus:border-transparent"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">
                Rekomendasi aman: 45 detik
              </span>
            </div>
          </div>

          {/* Jitter Randomization Toggle */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-gray-800 block">
                Acak Jitter Variasi Waktu
              </span>
              <span className="text-[11px] text-gray-500 block mt-0.5">
                Menyuntikkan variasi detik acak dan spasi zero-width agar pesan tidak terdeteksi bot
                Meta
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                data-testid="toggle-randomize-jitter"
                checked={randomizeJitter}
                onChange={(e) => setRandomizeJitter(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-wa-teal-primary relative" />
            </label>
          </div>

          {/* Dispatch Timing Choice: Immediate vs Scheduled */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
            <span className="text-xs font-bold text-gray-800 block">Waktu Pengiriman</span>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="scheduleChoice"
                  checked={!isScheduled}
                  onChange={() => setIsScheduled(false)}
                  className="text-wa-teal-primary focus:ring-wa-teal-primary"
                />
                <span>Kirim Langsung Sekarang</span>
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="scheduleChoice"
                  checked={isScheduled}
                  onChange={() => setIsScheduled(true)}
                  className="text-wa-teal-primary focus:ring-wa-teal-primary"
                />
                <span>Jadwalkan Waktu Tertentu</span>
              </label>
            </div>
            {isScheduled && (
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg p-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-wa-teal-primary"
              />
            )}
          </div>

          {/* Duration Estimate Indicator Badge */}
          <div
            data-testid="duration-estimate-badge"
            className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center justify-between"
          >
            <span>Estimasi Durasi Pengiriman ({estimatedRecipientsCount} pesan):</span>
            <span className="font-bold">{estimatedDuration}</span>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* STEP 4: Dispatch Confirmation & Live Delivery Progress Bar */}
      {/* ======================================================== */}
      {currentStep === 4 && (
        <div
          data-testid="campaign-progress-step"
          className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-6"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-wa-text-primary flex items-center gap-2">
                <span>🚀</span> Progress Pengiriman Live
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Pantau antrean pengiriman broadcast dan status pengantaran per kontak
              </p>
            </div>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                status === 'completed'
                  ? 'bg-emerald-100 text-emerald-800'
                  : status === 'processing'
                    ? 'bg-sky-100 text-sky-800 animate-pulse'
                    : 'bg-amber-100 text-amber-800'
              }`}
            >
              Status: {status}
            </span>
          </div>

          {/* Progress Bar Container */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
              <span>Kemajuan Pengiriman</span>
              <span>{progress.percentage}% Selesai</span>
            </div>
            <div className="w-full h-3.5 bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-200">
              <div
                data-testid="campaign-progress-bar"
                style={{ width: `${progress.percentage}%` }}
                className="h-full bg-gradient-to-r from-wa-teal-primary to-emerald-400 rounded-full transition-all duration-500"
              />
            </div>
          </div>

          {/* Live Delivery Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-center">
              <span className="text-xs text-gray-500 block mb-0.5">Total Audiens</span>
              <span className="text-lg font-bold text-gray-900">{progress.total}</span>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
              <span className="text-xs text-emerald-700 block mb-0.5">Terkirim</span>
              <span data-testid="stat-sent-count" className="text-lg font-bold text-emerald-800">
                {progress.sent}
              </span>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-center">
              <span className="text-xs text-amber-700 block mb-0.5">Menunggu / Delay</span>
              <span data-testid="stat-pending-count" className="text-lg font-bold text-amber-800">
                {progress.pending}
              </span>
            </div>
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 text-center">
              <span className="text-xs text-rose-700 block mb-0.5">Gagal</span>
              <span data-testid="stat-failed-count" className="text-lg font-bold text-rose-800">
                {progress.failed}
              </span>
            </div>
          </div>

          {/* Dispatch Button if not yet processing/completed */}
          {status !== 'processing' && status !== 'completed' && (
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                data-testid="btn-dispatch-campaign"
                onClick={handleDispatchCampaign}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-wa-teal-primary hover:bg-wa-teal-hover px-5 py-2.5 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <span>🚀</span>
                <span>Mulai Kirim Broadcast</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stepper Navigation Footer (Prev / Next Buttons) */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={handlePrevStep}
          disabled={currentStep === 1}
          className={`text-xs font-semibold px-4 py-2 rounded-lg border transition-colors ${
            currentStep === 1
              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 cursor-pointer'
          }`}
        >
          ← Langkah Sebelumnya
        </button>

        {currentStep < 4 ? (
          <button
            type="button"
            onClick={handleNextStep}
            className="text-xs font-semibold text-white bg-wa-teal-primary hover:bg-wa-teal-hover px-5 py-2 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1"
          >
            <span>Langkah Berikutnya</span>
            <span>→</span>
          </button>
        ) : null}
      </div>

      {children}
    </div>
  )
}

export default CampaignWizard
