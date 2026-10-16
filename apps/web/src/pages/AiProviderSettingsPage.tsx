import { useState } from 'react'
import {
  AiProviderConfigPanel,
  type AiProviderFormData,
  DEFAULT_AI_PROVIDER_DATA,
  DEFAULT_SYNC_STATUS,
  type EmbeddingSyncStatus,
  type TestConnectionResult,
} from '../components/ai-provider'

export function AiProviderSettingsPage() {
  const [formData, setFormData] = useState<AiProviderFormData>(DEFAULT_AI_PROVIDER_DATA)
  const [syncStatus, setSyncStatus] = useState<EmbeddingSyncStatus>(DEFAULT_SYNC_STATUS)

  const handleSave = async (data: AiProviderFormData) => {
    setFormData(data)
  }

  const handleTestConnection = async (params: {
    provider: string
    apiKey?: string
    modelName: string
    baseUrl?: string
    prompt: string
  }): Promise<TestConnectionResult> => {
    return {
      success: true,
      message: `Koneksi ke ${params.provider} berhasil diverifikasi.`,
      latencyMs: 110,
      replyText: `Halo! Model [${params.modelName}] dari provider ${params.provider} siap melayani AI Copilot.`,
    }
  }

  const handleSyncEmbeddings = async () => {
    const totalArticles = 14
    const totalChunks = 58
    setSyncStatus({
      totalArticles,
      totalChunks,
      vectorDimension: 1536,
      lastSyncedAt: new Date().toISOString(),
      isSyncing: false,
    })
    return { totalArticles, totalChunks }
  }

  return (
    <div
      data-testid="ai-provider-settings-page"
      className="min-h-screen bg-wa-header-bg flex flex-col"
    >
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Pengaturan</span>
            <span>/</span>
            <span className="font-semibold text-slate-800">Pengaturan AI &amp; Knowledge Base</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <AiProviderConfigPanel
          initialData={formData}
          syncStatus={syncStatus}
          onSave={handleSave}
          onTestConnection={handleTestConnection}
          onSyncEmbeddings={handleSyncEmbeddings}
        />
      </main>
    </div>
  )
}

export default AiProviderSettingsPage
