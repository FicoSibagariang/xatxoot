import { FileText, Lock, MessageSquare, Paperclip, Smile } from 'lucide-react'
import { Button } from '../astryx'
import { DeadlineTimerBadge, TicketSlaBadge, type TimelineMessage } from '../chat'
import type { TicketSummary } from './types'

export function ReplyPreviewBar({
  replyingTo,
  onCancel,
}: {
  replyingTo: TimelineMessage
  onCancel?: () => void
}) {
  return (
    <div
      data-testid="reply-preview-bar"
      className="bg-wa-header-bg/95 backdrop-blur-xs px-4 py-2 border-t border-wa-border flex items-center justify-between text-xs text-slate-700 shadow-2xs"
    >
      <div className="flex items-center gap-2 overflow-hidden border-l-4 border-wa-teal-primary pl-2.5 py-0.5">
        <span className="text-sm select-none">↩️</span>
        <div className="truncate">
          <span className="font-semibold text-wa-teal-dark">
            Membalas {replyingTo.senderName || 'Pesan'}:
          </span>{' '}
          <span className="italic text-slate-600 truncate">&ldquo;{replyingTo.content}&rdquo;</span>
        </div>
      </div>
      {onCancel && (
        <button
          type="button"
          data-testid="btn-cancel-reply"
          onClick={onCancel}
          className="p-1 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200/60 cursor-pointer shrink-0"
          title="Batalkan balasan"
        >
          ✕
        </button>
      )}
    </div>
  )
}

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

export function EmptyThreadNotice({ ticketNumber }: { ticketNumber?: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center">
      <div className="bg-white/90 backdrop-blur-xs px-4 py-2 rounded-lg shadow-xs text-xs text-wa-text-muted border border-wa-border max-w-sm">
        {ticketNumber ? (
          <>
            <span className="font-semibold text-emerald-800">Tiket Aktif: </span>#{ticketNumber}{' '}
            &bull; Mulai percakapan di bawah ini.
          </>
        ) : (
          <span>Mulai percakapan di bawah ini.</span>
        )}
      </div>
    </div>
  )
}

export interface TicketAssignmentLockBannerProps {
  isUnassigned: boolean
  assignedAgentName?: string | null
  onAssignTicket: () => void
}

export function TicketAssignmentLockBanner({
  isUnassigned,
  assignedAgentName,
  onAssignTicket,
}: TicketAssignmentLockBannerProps) {
  if (isUnassigned) {
    return (
      <div
        data-testid="unassigned-ticket-banner"
        className="flex-1 flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-4 py-2.5 shadow-2xs select-none"
      >
        <div className="flex items-center gap-2 text-xs font-medium">
          <span className="text-base select-none">🔒</span>
          <span>Percakapan ini belum ditugaskan. Ambil tiket untuk mulai membalas.</span>
        </div>
        <button
          type="button"
          data-testid="btn-claim-ticket"
          onClick={onAssignTicket}
          className="shrink-0 inline-flex items-center justify-center font-medium text-xs px-3 py-1.5 rounded-md bg-wa-teal-primary hover:bg-wa-teal-dark text-white shadow-xs cursor-pointer transition-colors"
        >
          Ambil Tiket Ini
        </button>
      </div>
    )
  }

  return (
    <div
      data-testid="assigned-other-ticket-banner"
      className="flex-1 flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-4 py-2.5 shadow-2xs select-none"
    >
      <div className="flex items-center gap-2 text-xs font-medium">
        <span className="text-base select-none">⚠️</span>
        <span>
          Tiket ini sedang ditangani oleh {assignedAgentName || 'agen lain'}. Anda hanya dapat
          membaca atau menulis Catatan Internal.
        </span>
      </div>
      <button
        type="button"
        data-testid="btn-reassign-ticket"
        onClick={onAssignTicket}
        className="shrink-0 inline-flex items-center justify-center font-medium text-xs px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs cursor-pointer transition-colors"
      >
        Ambil Alih
      </button>
    </div>
  )
}

export interface ThreadTicketHeaderActionsProps {
  ticket: TicketSummary
  now?: Date
  isTicketAssignedToMe: boolean
  isTicketAssignedToOther: boolean
  isTicketResolved: boolean
  onAssignTicket: () => void
  onResolveTicket: () => void
}

export function ThreadTicketHeaderActions({
  ticket,
  now,
  isTicketAssignedToMe,
  isTicketAssignedToOther,
  isTicketResolved,
  onAssignTicket,
  onResolveTicket,
}: ThreadTicketHeaderActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold px-2 py-1 rounded bg-wa-bubble-light text-wa-teal-dark border border-wa-bubble-active">
        #{ticket.ticketNumber}
      </span>
      {ticket.slaStatus ? (
        <TicketSlaBadge
          firstResponseDeadline={ticket.slaStatus.firstResponseDeadline}
          resolutionDeadline={ticket.slaStatus.resolutionDeadline}
          isBreached={ticket.slaStatus.isBreached}
          breachedAt={ticket.slaStatus.breachedAt}
          policyName={ticket.slaStatus.policyName}
          ticketStatus={ticket.status}
          now={now}
          size="md"
          showTooltip={true}
        />
      ) : (
        <DeadlineTimerBadge
          deadlineAt={ticket.deadlineAt}
          status={ticket.status}
          now={now}
          size="md"
        />
      )}

      <Button
        data-testid="btn-assign-ticket"
        variant="secondary"
        size="sm"
        onClick={onAssignTicket}
      >
        {isTicketAssignedToMe ? 'Unassign' : isTicketAssignedToOther ? 'Ditugaskan' : 'Assign'}
      </Button>

      <Button
        data-testid="btn-resolve-ticket"
        variant={isTicketResolved ? 'secondary' : 'teal'}
        size="sm"
        onClick={onResolveTicket}
      >
        {isTicketResolved ? 'Buka Kembali' : 'Resolve'}
      </Button>
    </div>
  )
}

export function ThreadInputMediaButtons({
  onOpenTemplateDialog,
}: {
  onOpenTemplateDialog?: () => void
}) {
  return (
    <>
      <button
        type="button"
        title="Emoji"
        className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-200/60 cursor-pointer"
      >
        <Smile className="w-5 h-5" />
      </button>

      <button
        type="button"
        title="Lampiran Gambar/File"
        className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-200/60 cursor-pointer"
      >
        <Paperclip className="w-5 h-5" />
      </button>

      <button
        type="button"
        data-testid="btn-open-template-dialog"
        title="Template Pesan WhatsApp Resmi"
        onClick={onOpenTemplateDialog}
        className="p-2 text-slate-500 hover:text-emerald-700 rounded-full hover:bg-slate-200/60 cursor-pointer"
      >
        <FileText className="w-5 h-5" />
      </button>
    </>
  )
}

export function OutboundChannelSelector({
  channels,
  selectedChannelId,
  onChange,
}: {
  channels?: Array<{ id: string; name: string; phoneNumber?: string }>
  selectedChannelId?: string
  onChange?: (id: string) => void
}) {
  if (!channels || channels.length === 0) return null

  return (
    <select
      data-testid="select-outbound-channel"
      value={selectedChannelId || channels[0]?.id}
      onChange={(e) => onChange?.(e.target.value)}
      className="text-xs bg-white border border-wa-border text-slate-700 rounded px-2 py-1.5 focus:outline-none focus:border-wa-teal-primary cursor-pointer shrink-0"
      title="Kirim sebagai Saluran WhatsApp"
    >
      {channels.map((ch) => (
        <option key={ch.id} value={ch.id}>
          {ch.name}
        </option>
      ))}
    </select>
  )
}

export default EmptyConversationState
