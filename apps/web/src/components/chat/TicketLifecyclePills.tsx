import { useState } from 'react'

export function formatLifecycleDuration(durationMs: number): string {
  if (durationMs < 60 * 1000) {
    return 'kurang dari 1 menit'
  }
  const totalMinutes = Math.round(durationMs / (60 * 1000))
  if (totalMinutes < 60) {
    return `${totalMinutes} menit`
  }
  const totalHours = Math.floor(durationMs / (60 * 60 * 1000))
  const remainingMinutes = Math.round((durationMs % (60 * 60 * 1000)) / (60 * 1000))
  if (totalHours < 24) {
    return remainingMinutes > 0
      ? `${totalHours} jam ${remainingMinutes} menit`
      : `${totalHours} jam`
  }
  const totalDays = Math.floor(durationMs / (24 * 60 * 60 * 1000))
  const remainingHours = Math.floor((durationMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
  return remainingHours > 0 ? `${totalDays} hari ${remainingHours} jam` : `${totalDays} hari`
}

export interface TicketLifecyclePopoverProps {
  type: 'opened' | 'resolved'
  ticketNumber?: string | number
  openedAt?: string
  resolvedAt?: string
  resolvedBy?: string
  durationText?: string
  firstResponseTime?: string
  timestamp?: string
  onClose: () => void
}

export function TicketLifecyclePopover({
  type,
  ticketNumber,
  openedAt,
  resolvedAt,
  resolvedBy,
  durationText,
  firstResponseTime,
  timestamp,
  onClose,
}: TicketLifecyclePopoverProps) {
  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '-'
    const d = new Date(timeStr)
    return Number.isNaN(d.getTime())
      ? timeStr
      : d.toLocaleString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
  }

  return (
    <div
      data-testid="ticket-lifecycle-popover"
      className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 z-30 w-72 bg-white/95 backdrop-blur-xs rounded-xl shadow-lg border border-wa-border p-3 text-left text-xs select-text"
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-wa-border font-semibold text-wa-teal-dark">
        <span className="flex items-center gap-1.5">
          <span>{type === 'resolved' ? '🏁' : '🎫'}</span>
          <span>Metrik Tiket #{ticketNumber || 'T-Baru'}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          title="Tutup"
        >
          ✕
        </button>
      </div>

      <div className="space-y-1.5 text-slate-700">
        <div className="flex justify-between items-center">
          <span className="text-slate-500">Waktu Dibuat:</span>
          <span className="font-medium text-slate-900">
            {formatTime(openedAt) || timestamp || '-'}
          </span>
        </div>

        {firstResponseTime && (
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Respon Pertama:</span>
            <span className="font-medium text-slate-900">{formatTime(firstResponseTime)}</span>
          </div>
        )}

        {type === 'resolved' && (
          <>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Waktu Selesai:</span>
              <span className="font-medium text-slate-900">
                {formatTime(resolvedAt) || timestamp || '-'}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500">Ditutup Oleh:</span>
              <span className="font-semibold text-wa-teal-dark">{resolvedBy || 'Sistem'}</span>
            </div>

            <div className="flex justify-between items-center pt-1 border-t border-slate-100">
              <span className="text-slate-500 font-medium">Total Durasi:</span>
              <span className="font-bold text-emerald-700">{durationText || 'Selesai'}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export interface TicketOpenedPillProps {
  ticketNumber?: string | number
  timestamp?: string
  dateText?: string
  openedAt?: string
  className?: string
}

export function TicketOpenedPill({
  ticketNumber,
  timestamp,
  dateText,
  openedAt,
  className = '',
}: TicketOpenedPillProps) {
  const [isOpen, setIsOpen] = useState(false)

  const timeLabel = timestamp || dateText || 'Baru saja'

  return (
    <div
      data-testid="ticket-separator-pill"
      className={`flex items-center justify-center my-3 select-none px-4 group ${className}`}
    >
      <div className="flex-1 border-t border-slate-300/80 max-w-xs" />
      <div className="relative">
        <button
          type="button"
          data-testid="ticket-opened-pill"
          onClick={() => setIsOpen((prev) => !prev)}
          className="mx-3 px-3.5 py-1 bg-emerald-50 text-emerald-800 font-semibold text-xs rounded-full border border-emerald-300 shadow-2xs flex items-center gap-1.5 cursor-pointer hover:bg-emerald-100/80 transition-colors"
          title="Klik untuk melihat ringkasan waktu tiket"
        >
          <span data-testid="activity-pill" className="flex items-center gap-1.5">
            <span>🎫</span>
            <span>
              Tiket #{ticketNumber || 'T-Baru'} Dibuka • {timeLabel}
            </span>
          </span>
        </button>
        {isOpen && (
          <TicketLifecyclePopover
            type="opened"
            ticketNumber={ticketNumber}
            openedAt={openedAt}
            timestamp={timestamp || dateText}
            onClose={() => setIsOpen(false)}
          />
        )}
      </div>
      <div className="flex-1 border-t border-slate-300/80 max-w-xs" />
    </div>
  )
}

export interface TicketResolvedPillProps {
  ticketNumber?: string | number
  resolvedBy?: string
  timestamp?: string
  durationText?: string
  openedAt?: string
  resolvedAt?: string
  durationMs?: number
  firstResponseTime?: string
  className?: string
}

export function TicketResolvedPill({
  ticketNumber,
  resolvedBy,
  timestamp,
  durationText,
  openedAt,
  resolvedAt,
  firstResponseTime,
  className = '',
}: TicketResolvedPillProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div
      data-testid="ticket-resolved-wrapper"
      className={`flex items-center justify-center my-3 select-none px-4 group ${className}`}
    >
      <div className="flex-1 border-t border-slate-300/80 max-w-xs" />
      <div className="relative">
        <button
          type="button"
          data-testid="ticket-resolved-pill"
          onClick={() => setIsOpen((prev) => !prev)}
          className="mx-3 px-3.5 py-1.5 bg-emerald-50 text-emerald-800 font-semibold text-xs rounded-full border border-emerald-300 shadow-2xs flex items-center gap-1.5 cursor-pointer hover:bg-emerald-100/80 transition-colors"
          title="Klik untuk melihat metrik penyelesaian tiket"
        >
          <span data-testid="activity-pill" className="flex items-center gap-1.5">
            <span>🏁</span>
            <span>
              Tiket #{ticketNumber || 'T-Baru'} Diselesaikan oleh {resolvedBy || 'Sistem'} •{' '}
              {timestamp || 'Baru saja'} (Durasi: {durationText || 'Selesai'})
            </span>
          </span>
        </button>
        {isOpen && (
          <TicketLifecyclePopover
            type="resolved"
            ticketNumber={ticketNumber}
            resolvedBy={resolvedBy}
            openedAt={openedAt}
            resolvedAt={resolvedAt}
            durationText={durationText}
            firstResponseTime={firstResponseTime}
            timestamp={timestamp}
            onClose={() => setIsOpen(false)}
          />
        )}
      </div>
      <div className="flex-1 border-t border-slate-300/80 max-w-xs" />
    </div>
  )
}
