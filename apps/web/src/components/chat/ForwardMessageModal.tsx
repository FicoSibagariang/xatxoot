import { useMemo, useState } from 'react'
import type { ConversationItem } from '../layout/types'
import type { TimelineMessage } from './types'

export interface ForwardMessageModalProps {
  isOpen: boolean
  sourceMessage: TimelineMessage | null
  conversations?: ConversationItem[]
  isSubmitting?: boolean
  onClose: () => void
  onConfirmForward: (target: {
    targetConversationId?: string
    targetJid?: string
    targetPhone?: string
  }) => void | Promise<void>
}

export function ForwardMessageModal({
  isOpen,
  sourceMessage,
  conversations = [],
  isSubmitting = false,
  onClose,
  onConfirmForward,
}: ForwardMessageModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [manualPhone, setManualPhone] = useState('')

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations
    const q = searchQuery.toLowerCase()
    return conversations.filter(
      (c) =>
        c.contactName?.toLowerCase().includes(q) ||
        c.contactPhone?.toLowerCase().includes(q) ||
        c.groupJid?.toLowerCase().includes(q),
    )
  }, [conversations, searchQuery])

  if (!isOpen || !sourceMessage) return null

  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id)
    setManualPhone('')
  }

  const handleManualPhoneChange = (val: string) => {
    setManualPhone(val)
    if (val.trim()) {
      setSelectedConversationId(null)
    }
  }

  const handleSubmit = () => {
    if (selectedConversationId) {
      onConfirmForward({ targetConversationId: selectedConversationId })
    } else if (manualPhone.trim()) {
      const clean = manualPhone.trim()
      const isGroup = clean.endsWith('@g.us')
      onConfirmForward(isGroup ? { targetJid: clean } : { targetPhone: clean })
    }
  }

  const canSubmit = Boolean(selectedConversationId || manualPhone.trim())

  return (
    <div
      data-testid="forward-message-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-wa-header-bg shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg select-none">↪️</span>
            <h3 className="font-bold text-sm text-wa-text-primary">Teruskan Pesan</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
            title="Tutup"
          >
            ✕
          </button>
        </div>

        {/* Message Preview Box */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 shrink-0">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Pesan yang Diteruskan:
          </div>
          <div
            data-testid="forward-message-preview"
            className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 max-h-24 overflow-y-auto leading-relaxed border-l-4 border-wa-teal-primary"
          >
            {sourceMessage.mediaUrl && (
              <div className="text-[11px] text-wa-teal-dark font-medium mb-1">
                📎 Lampiran Media:{' '}
                {sourceMessage.fileName || sourceMessage.contentType || 'Gambar/File'}
              </div>
            )}
            <div className="line-clamp-3">
              {sourceMessage.content || '(Lampiran file tanpa teks)'}
            </div>
          </div>
        </div>

        {/* Search & Selection */}
        <div className="p-4 flex-1 flex flex-col min-h-0">
          <div className="mb-3">
            <input
              type="text"
              data-testid="forward-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kontak, grup, atau nomor..."
              className="w-full text-xs bg-white text-slate-800 placeholder-slate-400 rounded-lg px-3 py-2 border border-slate-200 focus:outline-none focus:border-wa-teal-primary focus:ring-1 focus:ring-wa-teal-primary"
            />
          </div>

          {/* List of Target Conversations */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg mb-3">
            {filteredConversations.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                Tidak ada percakapan yang cocok.
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = selectedConversationId === conv.id
                return (
                  <button
                    type="button"
                    key={conv.id}
                    data-testid="forward-target-item"
                    onClick={() => handleSelectConversation(conv.id)}
                    className={`w-full px-3 py-2.5 text-left flex items-center justify-between text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-wa-bubble-light text-wa-teal-dark font-semibold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span>{conv.isGroup ? '👥' : '👤'}</span>
                      <span className="truncate">{conv.contactName}</span>
                      {conv.contactPhone && (
                        <span className="text-[10px] text-slate-400 truncate">
                          ({conv.contactPhone})
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <span className="text-wa-teal-primary text-sm font-bold">✓</span>
                    )}
                  </button>
                )
              })
            )}
          </div>

          {/* Manual Input Destination */}
          <div>
            <label
              htmlFor="forward-manual-phone-input"
              className="block text-[11px] font-medium text-slate-500 mb-1"
            >
              Atau kirim ke nomor WhatsApp baru:
            </label>
            <input
              id="forward-manual-phone-input"
              type="text"
              data-testid="forward-manual-phone"
              value={manualPhone}
              onChange={(e) => handleManualPhoneChange(e.target.value)}
              placeholder="+628123456789 atau ID grup..."
              className="w-full text-xs bg-white text-slate-800 placeholder-slate-400 rounded-lg px-3 py-2 border border-slate-200 focus:outline-none focus:border-wa-teal-primary focus:ring-1 focus:ring-wa-teal-primary"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            data-testid="btn-cancel-forward"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-200/60 cursor-pointer transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            data-testid="btn-submit-forward"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-wa-teal-primary hover:bg-wa-teal-dark rounded-lg shadow-xs cursor-pointer disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {isSubmitting ? 'Meneruskan...' : 'Teruskan Pesan'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ForwardMessageModal
