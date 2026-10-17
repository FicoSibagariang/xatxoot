import { Lock, MessageSquare } from 'lucide-react'

export function EmptyConversationState() {
  return (
    <main
      data-testid="conversation-empty-state"
      className="flex-1 h-full bg-wa-header-bg flex flex-col items-center justify-center p-8 text-center select-none border-b-6 border-wa-teal-primary"
    >
      <div className="w-20 h-20 rounded-full bg-emerald-100 text-wa-teal-primary flex items-center justify-center mb-6 shadow-sm">
        <MessageSquare className="w-10 h-10" />
      </div>
      <h2 className="text-2xl font-semibold text-wa-text-meta mb-2">Xatxoot Customer Support</h2>
      <p className="text-sm text-wa-text-secondary max-w-md leading-relaxed mb-6">
        Pilih percakapan di bilah kiri untuk membaca pesan dan menangani tiket pelanggan secara
        real-time.
      </p>
      <div className="flex items-center gap-2 text-xs text-wa-text-subtle">
        <Lock className="w-3.5 h-3.5" />
        <span>End-to-end encrypted dengan WhatsApp Cloud & Baileys Gateway</span>
      </div>
    </main>
  )
}

export default EmptyConversationState
