import { useState } from 'react'
import { ChannelManagement, ChannelWizard, type ChannelWizardPayload } from '../components/channels'
import { SettingsNav } from '../components/settings'
import { api } from '../services/apiClient'

export interface ChannelWizardPageProps {
  onSuccess?: (payload: ChannelWizardPayload) => void
  onBack?: () => void
  initialView?: 'list' | 'wizard'
}

export function ChannelWizardPage({
  onSuccess,
  onBack,
  initialView = 'wizard',
}: ChannelWizardPageProps) {
  const [view, setView] = useState<'list' | 'wizard'>(initialView)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async (payload: ChannelWizardPayload) => {
    setError(null)
    try {
      const actualChannelType =
        payload.channelType === 'whatsapp_baileys' ? 'whatsapp_unofficial' : payload.channelType

      // Create channel & inbox via API
      await api.post('/api/v1/inboxes', {
        name: payload.inboxName,
        channelType: actualChannelType,
        channelConfig:
          payload.emailConfig ||
          payload.telegramConfig ||
          payload.facebookConfig ||
          payload.instagramConfig ||
          payload.smsConfig,
      })

      if (onSuccess) {
        onSuccess(payload)
      }
      setView('list')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
      setError(msg)
      throw err
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <SettingsNav activeSection="channels" />

      {/* Top Switcher Tabs */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="tab-channel-list"
            onClick={() => setView('list')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              view === 'list'
                ? 'bg-wa-teal-primary text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            📋 Daftar Saluran & Ganti Nama
          </button>
          <button
            type="button"
            data-testid="tab-channel-wizard"
            onClick={() => setView('wizard')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              view === 'wizard'
                ? 'bg-wa-teal-primary text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            + Tambah Saluran Baru
          </button>
        </div>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
          >
            &larr; Kembali ke Pengaturan
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col">
        {error && (
          <div className="m-6 mb-0 max-w-4xl mx-auto w-full rounded-xl bg-rose-50 p-4 text-sm text-rose-700 border border-rose-200">
            {error}
          </div>
        )}

        {view === 'list' ? (
          <ChannelManagement onAddNewChannel={() => setView('wizard')} />
        ) : (
          <div className="p-6 flex flex-col items-center justify-center flex-1">
            <ChannelWizard onSaveChannel={handleSave} onClose={() => setView('list')} />
          </div>
        )}
      </div>
    </div>
  )
}

export default ChannelWizardPage
