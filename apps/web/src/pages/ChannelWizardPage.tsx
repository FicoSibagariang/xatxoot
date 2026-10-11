import { useState } from 'react'
import { ChannelWizard, type ChannelWizardPayload } from '../components/channels'

export interface ChannelWizardPageProps {
  onSuccess?: (payload: ChannelWizardPayload) => void
  onBack?: () => void
}

export function ChannelWizardPage({ onSuccess, onBack }: ChannelWizardPageProps) {
  const [error, setError] = useState<string | null>(null)

  const handleSave = async (payload: ChannelWizardPayload) => {
    setError(null)
    try {
      // Create channel & inbox via API
      const response = await fetch('/api/v1/inboxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: payload.inboxName,
          channelType: payload.channelType,
          channelConfig:
            payload.emailConfig ||
            payload.telegramConfig ||
            payload.facebookConfig ||
            payload.instagramConfig ||
            payload.smsConfig,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Gagal menyimpan konfigurasi saluran')
      }

      if (onSuccess) {
        onSuccess(payload)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem'
      setError(msg)
      throw err
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6 flex flex-col items-center justify-center">
      {error && (
        <div className="mb-4 w-full max-w-2xl rounded-xl bg-rose-50 p-4 text-sm text-rose-700 border border-rose-200">
          {error}
        </div>
      )}
      <ChannelWizard onSaveChannel={handleSave} onClose={onBack} />
    </div>
  )
}

export default ChannelWizardPage
