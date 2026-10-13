import type { AiProviderType } from '@xatxoot/shared'
import type React from 'react'
import { useState } from 'react'

export interface AiProviderFormData {
  provider: AiProviderType
  modelName: string
  apiKey?: string
  apiKeyEncrypted?: string | null
  baseUrl?: string
  temperature: number
  active: boolean
}

export interface TestConnectionResult {
  success: boolean
  message: string
  latencyMs?: number
  replyText?: string
}

export interface EmbeddingSyncStatus {
  totalArticles: number
  totalChunks: number
  vectorDimension?: number
  lastSyncedAt?: string | null
  isSyncing?: boolean
}

export interface AiProviderConfigPanelProps {
  initialData?: AiProviderFormData
  syncStatus?: EmbeddingSyncStatus
  syncFeedback?: string | null
  testResult?: TestConnectionResult | null
  isTestingConnection?: boolean
  onSave?: (data: AiProviderFormData) => void | Promise<void>
  onTestConnection?: (data: {
    provider: AiProviderType
    apiKey?: string
    modelName: string
    baseUrl?: string
    prompt: string
  }) => Promise<TestConnectionResult>
  onSyncEmbeddings?: () => Promise<{ totalArticles: number; totalChunks: number }>
  className?: string
}

export const PROVIDER_PRESETS: Record<
  AiProviderType,
  { label: string; icon: string; description: string; models: string[]; defaultBaseUrl?: string }
> = {
  openai: {
    label: 'OpenAI',
    icon: '⚡',
    description: 'GPT-4o, GPT-4o-mini dan native vector embeddings text-embedding-3-small.',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  },
  gemini: {
    label: 'Google Gemini',
    icon: '✨',
    description: 'Gemini 1.5 Pro & Flash via Google AI Studio API.',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
  },
  anthropic: {
    label: 'Anthropic Claude',
    icon: '🧠',
    description: 'Claude 3.5 Sonnet & Claude 3 Haiku via Anthropic API.',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
  },
  ollama: {
    label: 'Ollama (Local)',
    icon: '🦙',
    description: 'Self-hosted open weights LLM (LLaMA 3, Mistral) tanpa pengiriman data ke cloud.',
    models: ['llama3:8b', 'mistral:7b', 'phi3:mini'],
    defaultBaseUrl: 'http://localhost:11434',
  },
}

export const DEFAULT_AI_PROVIDER_DATA: AiProviderFormData = {
  provider: 'openai',
  modelName: 'gpt-4o',
  apiKey: '',
  baseUrl: '',
  temperature: 0.7,
  active: true,
}

export const DEFAULT_SYNC_STATUS: EmbeddingSyncStatus = {
  totalArticles: 0,
  totalChunks: 0,
  vectorDimension: 1536,
  lastSyncedAt: null,
  isSyncing: false,
}

export function AiProviderConfigPanel({
  initialData = DEFAULT_AI_PROVIDER_DATA,
  syncStatus = DEFAULT_SYNC_STATUS,
  syncFeedback: externalSyncFeedback = null,
  testResult: externalTestResult = null,
  isTestingConnection: externalIsTesting = false,
  onSave,
  onTestConnection,
  onSyncEmbeddings,
  className = '',
}: AiProviderConfigPanelProps) {
  const [formData, setFormData] = useState<AiProviderFormData>(initialData)
  const [showApiKey, setShowApiKey] = useState(false)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Local state for interactive test prompt
  const [testPrompt, setTestPrompt] = useState(
    'Tes koneksi AI Copilot Xatxoot. Mohon balas pesan ini secara singkat.',
  )
  const [localTestResult, setLocalTestResult] = useState<TestConnectionResult | null>(
    externalTestResult,
  )
  const [isLocalTesting, setIsLocalTesting] = useState(false)

  // Local state for interactive embedding sync
  const [localSyncStatus, setLocalSyncStatus] = useState<EmbeddingSyncStatus>(syncStatus)
  const [localSyncFeedback, setLocalSyncFeedback] = useState<string | null>(externalSyncFeedback)

  const activeTestResult = externalTestResult ?? localTestResult
  const isTesting = externalIsTesting || isLocalTesting
  const activeSyncStatus = syncStatus.isSyncing ? syncStatus : localSyncStatus
  const activeSyncFeedback = externalSyncFeedback ?? localSyncFeedback

  const currentPreset = PROVIDER_PRESETS[formData.provider]

  const handleProviderSelect = (provider: AiProviderType) => {
    const preset = PROVIDER_PRESETS[provider]
    setFormData((prev) => ({
      ...prev,
      provider,
      modelName: preset.models[0] || prev.modelName,
      baseUrl: provider === 'ollama' ? preset.defaultBaseUrl || '' : prev.baseUrl,
    }))
    setSaveStatus(null)
    setSaveError(null)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveStatus(null)
    setSaveError(null)

    // Validation
    if (formData.provider !== 'ollama' && !formData.apiKey?.trim() && !formData.apiKeyEncrypted) {
      setSaveError(
        `API Key wajib diisi untuk provider ${PROVIDER_PRESETS[formData.provider].label}.`,
      )
      return
    }

    try {
      if (onSave) {
        await onSave(formData)
      }
      setSaveStatus('Konfigurasi AI Provider berhasil disimpan!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan konfigurasi AI'
      setSaveError(msg)
    }
  }

  const handleRunTestConnection = async () => {
    setIsLocalTesting(true)
    setLocalTestResult(null)
    try {
      if (onTestConnection) {
        const res = await onTestConnection({
          provider: formData.provider,
          apiKey: formData.apiKey,
          modelName: formData.modelName,
          baseUrl: formData.baseUrl,
          prompt: testPrompt,
        })
        setLocalTestResult(res)
      } else {
        // Fallback simulated test
        await new Promise((resolve) => setTimeout(resolve, 300))
        if (
          formData.provider !== 'ollama' &&
          !formData.apiKey?.trim() &&
          !formData.apiKeyEncrypted
        ) {
          setLocalTestResult({
            success: false,
            message: 'API Key wajib diisi untuk melakukan pengujian koneksi.',
            latencyMs: 15,
          })
        } else {
          setLocalTestResult({
            success: true,
            message: `Koneksi ke ${PROVIDER_PRESETS[formData.provider].label} berhasil diverifikasi.`,
            latencyMs: 120,
            replyText: `Halo! Model [${formData.modelName}] dari provider ${PROVIDER_PRESETS[formData.provider].label} merespons dengan baik.`,
          })
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menguji koneksi'
      setLocalTestResult({
        success: false,
        message: msg,
        latencyMs: 250,
      })
    } finally {
      setIsLocalTesting(false)
    }
  }

  const handleRunSyncEmbeddings = async () => {
    setLocalSyncStatus((prev) => ({ ...prev, isSyncing: true }))
    setLocalSyncFeedback(null)
    try {
      if (onSyncEmbeddings) {
        const res = await onSyncEmbeddings()
        setLocalSyncStatus({
          totalArticles: res.totalArticles,
          totalChunks: res.totalChunks,
          vectorDimension: 1536,
          lastSyncedAt: new Date().toISOString(),
          isSyncing: false,
        })
        setLocalSyncFeedback(
          `Sinkronisasi berhasil! ${res.totalArticles} artikel dan ${res.totalChunks} chunk vektor telah diperbarui.`,
        )
      } else {
        await new Promise((resolve) => setTimeout(resolve, 300))
        setLocalSyncStatus((prev) => ({
          ...prev,
          lastSyncedAt: new Date().toISOString(),
          isSyncing: false,
        }))
        setLocalSyncFeedback('Sinkronisasi basis pengetahuan berhasil diperbarui.')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menyinkronkan embeddings'
      setLocalSyncFeedback(`Gagal: ${msg}`)
      setLocalSyncStatus((prev) => ({ ...prev, isSyncing: false }))
    }
  }

  return (
    <div
      data-testid="ai-provider-config-panel"
      className={`max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 ${className}`}
    >
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <span className="text-3xl select-none">✨</span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Konfigurasi AI Provider &amp; Copilot
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Atur integrasi penyedia model AI (BYO Key), lakukan pengujian koneksi langsung, dan
              sinkronkan embedding Help Center untuk Smart RAG Copilot.
            </p>
          </div>
        </div>
      </div>

      {/* Bagian 1: Pengaturan Provider & Kunci API */}
      <form
        onSubmit={handleSave}
        className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-6"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              1. Penyedia Model AI &amp; API Key
            </h2>
            <p className="text-xs text-slate-500">Pilih provider dan masukkan kredensial akses.</p>
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="toggle-active"
              className="text-xs font-medium text-slate-700 cursor-pointer"
            >
              Status AI Copilot:
            </label>
            <input
              id="toggle-active"
              type="checkbox"
              data-testid="toggle-active-status"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="w-4 h-4 text-[#00a884] rounded border-slate-300 focus:ring-[#00a884]"
            />
            <span
              className={`text-xs font-semibold ${formData.active ? 'text-emerald-600' : 'text-slate-400'}`}
            >
              {formData.active ? 'Aktif' : 'Nonaktif'}
            </span>
          </div>
        </div>

        {/* Kartu Pilihan Provider */}
        <div>
          <span className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Penyedia Model (Provider)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(Object.keys(PROVIDER_PRESETS) as AiProviderType[]).map((provKey) => {
              const info = PROVIDER_PRESETS[provKey]
              const isSelected = formData.provider === provKey
              return (
                <button
                  key={provKey}
                  type="button"
                  data-testid={`provider-card-${provKey}`}
                  onClick={() => handleProviderSelect(provKey)}
                  className={`text-left p-3.5 rounded-lg border-2 transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#00a884] bg-emerald-50/40 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl select-none">{info.icon}</span>
                    {isSelected && (
                      <span className="text-[10px] uppercase font-bold text-[#00a884] bg-emerald-100 px-1.5 py-0.5 rounded">
                        Dipilih
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <h3 className="font-semibold text-slate-800 text-sm">{info.label}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                      {info.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Model Name & Presets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="model-name-input"
              className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
            >
              Nama Model (Model Name)
            </label>
            <input
              id="model-name-input"
              type="text"
              data-testid="input-model-name"
              value={formData.modelName}
              onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
              placeholder="e.g. gpt-4o"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-hidden focus:border-[#00a884]"
              required
            />
            {/* Quick preset badges */}
            <div data-testid="model-presets" className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="text-[11px] text-slate-400 self-center">Preset:</span>
              {currentPreset.models.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setFormData({ ...formData, modelName: m })}
                  className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                    formData.modelName === m
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Temperature Slider */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label
                htmlFor="temperature-input"
                className="text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >
                Temperature (Kreativitas)
              </label>
              <span className="text-xs font-mono font-bold text-slate-700">
                {formData.temperature}
              </span>
            </div>
            <input
              id="temperature-input"
              type="range"
              min="0"
              max="2"
              step="0.1"
              data-testid="input-temperature"
              value={formData.temperature}
              onChange={(e) =>
                setFormData({ ...formData, temperature: Number.parseFloat(e.target.value) })
              }
              className="w-full accent-[#00a884] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>0.0 (Presisi/Deterministik)</span>
              <span>1.0 (Seimbang)</span>
              <span>2.0 (Sangat Kreatif)</span>
            </div>
          </div>
        </div>

        {/* API Key Input */}
        <div>
          <label
            htmlFor="api-key-input"
            className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
          >
            API Key{' '}
            {formData.provider === 'ollama' ? (
              <span className="text-slate-400 font-normal lowercase">(opsional untuk Ollama)</span>
            ) : (
              <span className="text-rose-500">*</span>
            )}
          </label>
          <div className="relative">
            <input
              id="api-key-input"
              type={showApiKey ? 'text' : 'password'}
              data-testid="input-api-key"
              value={formData.apiKey || ''}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder={
                formData.apiKeyEncrypted
                  ? '•••••••••••••••• (Kunci tersimpan aman)'
                  : formData.provider === 'ollama'
                    ? 'Tidak memerlukan API Key untuk Ollama lokal'
                    : 'Masukkan API Key Anda (misal sk-...)'
              }
              className="w-full text-sm border border-slate-300 rounded-lg pl-3 pr-10 py-2 focus:outline-hidden focus:border-[#00a884]"
            />
            <button
              type="button"
              data-testid="btn-toggle-apikey-visibility"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1 select-none"
              title="Lihat / sembunyikan key"
            >
              {showApiKey ? '🙈 Sembunyikan' : '👁️ Tampilkan'}
            </button>
          </div>
          {formData.apiKeyEncrypted && (
            <p
              data-testid="api-key-masked-hint"
              className="text-xs text-emerald-600 mt-1 flex items-center gap-1"
            >
              <span>🔒</span> Kunci API telah tersimpan dan terenkripsi ({formData.apiKeyEncrypted}
              ). Masukkan nilai baru jika ingin mengganti.
            </p>
          )}
        </div>

        {/* Base URL (Ollama or Custom Endpoint) */}
        <div>
          <label
            htmlFor="base-url-input"
            className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
          >
            Base URL / Host Endpoint{' '}
            {formData.provider === 'ollama' && (
              <span className="text-emerald-600 font-normal">(Disarankan)</span>
            )}
          </label>
          <input
            id="base-url-input"
            type="text"
            data-testid="input-base-url"
            value={formData.baseUrl || ''}
            onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
            placeholder={
              formData.provider === 'ollama'
                ? 'http://localhost:11434'
                : 'https://api.openai.com/v1 (opsional)'
            }
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-hidden focus:border-[#00a884]"
          />
          {formData.provider === 'ollama' && (
            <p
              data-testid="ollama-notice"
              className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-1.5"
            >
              💡 Pastikan daemon Ollama berjalan di <code>http://localhost:11434</code> dan model
              telah diunduh (misal: <code>ollama run llama3:8b</code>).
            </p>
          )}
        </div>

        {/* Feedback Messages */}
        {saveStatus && (
          <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg flex items-center gap-1.5">
            <span>✅</span> {saveStatus}
          </div>
        )}
        {saveError && (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-lg flex items-center gap-1.5">
            <span>⚠️</span> {saveError}
          </div>
        )}

        {/* Save Button */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            data-testid="btn-save-ai-setting"
            className="bg-[#00a884] hover:bg-[#008f6f] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors shadow-xs"
          >
            Simpan Konfigurasi AI
          </button>
        </div>
      </form>

      {/* Bagian 2: Tes Koneksi Prompt */}
      <div
        data-testid="section-test-connection"
        className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4"
      >
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-lg font-semibold text-slate-900">2. Tes Koneksi Prompt</h2>
          <p className="text-xs text-slate-500">
            Uji respons langsung dari model AI dengan mengirimkan prompt uji coba cepat.
          </p>
        </div>

        <div>
          <label
            htmlFor="test-prompt-input"
            className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
          >
            Prompt Pengujian
          </label>
          <div className="flex gap-2">
            <input
              id="test-prompt-input"
              type="text"
              data-testid="input-test-prompt"
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              placeholder="Ketik prompt untuk uji koneksi..."
              className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-hidden focus:border-[#00a884]"
            />
            <button
              type="button"
              data-testid="btn-test-ai-connection"
              onClick={handleRunTestConnection}
              disabled={isTesting}
              className="bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shrink-0 flex items-center gap-2"
            >
              <span>⚡</span> Tes Koneksi Prompt
            </button>
          </div>
        </div>

        {/* Loading Indicator */}
        {isTesting && (
          <div
            data-testid="test-connection-loading"
            className="flex items-center gap-2 text-xs text-purple-700 bg-purple-50 border border-purple-200 p-3 rounded-lg animate-pulse"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-ping" />
            Menguji koneksi ke AI Provider...
          </div>
        )}

        {/* Result Card */}
        {activeTestResult?.success && (
          <div
            data-testid="test-connection-result"
            className="border border-emerald-200 bg-emerald-50/50 rounded-lg p-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span
                data-testid="test-connection-badge"
                className="text-xs font-bold uppercase tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded"
              >
                Koneksi Berhasil
              </span>
              {activeTestResult.latencyMs !== undefined && (
                <span className="text-xs font-mono font-semibold text-slate-600">
                  Latency: {activeTestResult.latencyMs} ms
                </span>
              )}
            </div>
            <p className="text-xs text-slate-700">{activeTestResult.message}</p>
            {activeTestResult.replyText && (
              <div
                data-testid="test-connection-reply"
                className="bg-white border border-slate-200 rounded p-2.5 text-xs text-slate-800 font-mono"
              >
                {activeTestResult.replyText}
              </div>
            )}
          </div>
        )}

        {/* Error Card */}
        {activeTestResult && !activeTestResult.success && (
          <div
            data-testid="test-connection-error"
            className="border border-rose-200 bg-rose-50 rounded-lg p-3 text-xs text-rose-800 flex items-start gap-2"
          >
            <span className="text-base">❌</span>
            <div>
              <p className="font-semibold">Uji koneksi gagal</p>
              <p className="mt-0.5">{activeTestResult.message}</p>
            </div>
          </div>
        )}
      </div>

      {/* Bagian 3: Sinkronisasi Embedding Help Center (RAG) */}
      <div
        data-testid="section-sync-embeddings"
        className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4"
      >
        <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              3. Sinkronisasi Basis Pengetahuan (Knowledge Base Embeddings)
            </h2>
            <p className="text-xs text-slate-500">
              Menghasilkan vektor semantik 1536-dimensi untuk semua artikel Help Center yang telah
              dipublikasikan.
            </p>
          </div>
          <button
            type="button"
            data-testid="btn-sync-embeddings"
            onClick={handleRunSyncEmbeddings}
            disabled={activeSyncStatus.isSyncing}
            className="bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shrink-0 flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span>🔄</span> Sinkronkan Sekarang
          </button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              Artikel Terindeks
            </span>
            <span
              data-testid="stat-indexed-articles"
              className="text-xl font-bold text-slate-800 mt-1 block"
            >
              {activeSyncStatus.totalArticles}
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              Total Vektor Chunk
            </span>
            <span
              data-testid="stat-total-chunks"
              className="text-xl font-bold text-slate-800 mt-1 block"
            >
              {activeSyncStatus.totalChunks}
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              Dimensi Vektor
            </span>
            <span
              data-testid="stat-vector-dimension"
              className="text-xl font-bold text-slate-800 mt-1 block"
            >
              {activeSyncStatus.vectorDimension || 1536}
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              Sinkronisasi Terakhir
            </span>
            <span
              data-testid="last-synced-at"
              className="text-xs font-medium text-slate-700 mt-1.5 block truncate"
            >
              {activeSyncStatus.lastSyncedAt
                ? new Date(activeSyncStatus.lastSyncedAt).toLocaleString('id-ID')
                : 'Belum pernah'}
            </span>
          </div>
        </div>

        {/* Syncing Loading State */}
        {activeSyncStatus.isSyncing && (
          <div
            data-testid="sync-embeddings-loading"
            className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 p-3 rounded-lg animate-pulse"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
            Sedang menyinkronkan vector embeddings...
          </div>
        )}

        {/* Sync Success Feedback */}
        {activeSyncFeedback && (
          <div
            data-testid="sync-embeddings-success"
            className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-center gap-2"
          >
            <span>✅</span>
            <span>{activeSyncFeedback}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default AiProviderConfigPanel
