import type React from 'react'
import type { TicketCsatData } from './types'

export type { TicketCsatData }

export interface TicketCsatCardProps {
  csat?: TicketCsatData | null
  className?: string
}

const RATING_CONFIG: Record<number, { label: string; emoji: string; badgeClass: string }> = {
  1: {
    label: 'Sangat Kecewa',
    emoji: '😡',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  2: {
    label: 'Kecewa',
    emoji: '🙁',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  3: {
    label: 'Cukup',
    emoji: '😐',
    badgeClass: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  },
  4: {
    label: 'Puas',
    emoji: '🙂',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  5: {
    label: 'Sangat Puas',
    emoji: '😍',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
  },
}

export function TicketCsatCard({ csat, className = '' }: TicketCsatCardProps) {
  // 1. Empty State
  if (!csat) {
    return (
      <div
        data-testid="ticket-csat-card"
        className={`border border-[#e9edef] rounded-xl p-3.5 bg-[#f9fafb] flex flex-col gap-1.5 ${className}`}
      >
        <div className="flex items-center justify-between">
          <h5 className="font-semibold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <span>⭐</span>
            <span>Kepuasan Pelanggan (CSAT)</span>
          </h5>
          <span className="text-[10px] text-slate-400 font-medium">N/A</span>
        </div>
        <p className="text-xs font-semibold text-slate-700 mt-1">Belum ada penilaian CSAT</p>
        <p className="text-[11px] text-slate-400">
          Tiket ini belum memiliki tanggapan survei kepuasan.
        </p>
      </div>
    )
  }

  // 2. Pending State
  if (csat.status === 'pending' || (!csat.rating && csat.inviteToken)) {
    return (
      <div
        data-testid="ticket-csat-card"
        className={`border border-amber-200 rounded-xl p-3.5 bg-amber-50/40 flex flex-col gap-2 ${className}`}
      >
        <div className="flex items-center justify-between">
          <h5 className="font-semibold text-xs text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
            <span>⌛</span>
            <span>Kepuasan Pelanggan (CSAT)</span>
          </h5>
          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
            Pending
          </span>
        </div>
        <div>
          <p className="text-xs font-semibold text-amber-900">Menunggu Penilaian Pelanggan</p>
          <p className="text-[11px] text-amber-700/80 mt-0.5">
            Survei telah dikirimkan ke pelanggan saat tiket ini diselesaikan.
          </p>
        </div>
      </div>
    )
  }

  // 3. Submitted State with Rating
  const rating = csat.rating && csat.rating >= 1 && csat.rating <= 5 ? csat.rating : 5
  const config = RATING_CONFIG[rating] || RATING_CONFIG[5]

  return (
    <div
      data-testid="ticket-csat-card"
      className={`border border-emerald-200 rounded-xl p-3.5 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 flex flex-col gap-2.5 shadow-2xs ${className}`}
    >
      {/* Header CSAT */}
      <div className="flex items-center justify-between">
        <h5 className="font-semibold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <span>⭐</span>
          <span>Kepuasan Pelanggan (CSAT)</span>
        </h5>
        <span
          className={`rounded-md px-2 py-0.5 text-[11px] font-bold border flex items-center gap-1 ${config.badgeClass}`}
        >
          <span>{config.emoji}</span>
          <span>{config.label}</span>
        </span>
      </div>

      {/* Rating Score & Stars Display */}
      <div className="flex items-center justify-between py-1 bg-white/70 px-3 rounded-lg border border-emerald-100">
        <div className="flex items-center gap-1.5">
          <span className="text-base font-extrabold text-slate-800">{rating} / 5</span>
          <span className="text-amber-400 tracking-widest text-sm select-none">
            {'★'.repeat(rating)}
            {'☆'.repeat(Math.max(0, 5 - rating))}
          </span>
        </div>
        {csat.submittedAt && (
          <span className="text-[10px] text-slate-400">
            {new Date(csat.submittedAt).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        )}
      </div>

      {/* Customer Feedback Text */}
      {csat.feedbackText && (
        <div className="rounded-lg bg-white/80 p-2.5 border border-slate-200/60 text-xs text-slate-700 italic">
          &ldquo;{csat.feedbackText}&rdquo;
        </div>
      )}
    </div>
  )
}

export default TicketCsatCard
