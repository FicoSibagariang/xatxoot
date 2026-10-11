import type React from 'react'
import { useState } from 'react'

export interface CsatRatingOption {
  rating: number
  label: string
  emoji: string
  colorClass: string
}

export const CSAT_RATING_OPTIONS: CsatRatingOption[] = [
  {
    rating: 1,
    label: 'Sangat Kecewa',
    emoji: '😡',
    colorClass: 'hover:border-rose-400 hover:bg-rose-50/50',
  },
  {
    rating: 2,
    label: 'Kecewa',
    emoji: '🙁',
    colorClass: 'hover:border-amber-400 hover:bg-amber-50/50',
  },
  {
    rating: 3,
    label: 'Cukup',
    emoji: '😐',
    colorClass: 'hover:border-yellow-400 hover:bg-yellow-50/50',
  },
  {
    rating: 4,
    label: 'Puas',
    emoji: '🙂',
    colorClass: 'hover:border-emerald-400 hover:bg-emerald-50/50',
  },
  {
    rating: 5,
    label: 'Sangat Puas',
    emoji: '😍',
    colorClass: 'hover:border-teal-400 hover:bg-teal-50/50',
  },
]

export interface CsatWidgetSubmission {
  rating: number
  feedbackText?: string
}

export function validateCsatSubmission(submission: CsatWidgetSubmission): {
  success: boolean
  errors?: Record<string, string>
} {
  const errors: Record<string, string> = {}

  if (
    typeof submission.rating !== 'number' ||
    submission.rating < 1 ||
    submission.rating > 5 ||
    !Number.isInteger(submission.rating)
  ) {
    errors.rating = 'Pilih tingkat kepuasan Anda (1 - 5)'
  }

  if (submission.feedbackText && submission.feedbackText.length > 2000) {
    errors.feedbackText = 'Umpan balik maksimal 2000 karakter'
  }

  return {
    success: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  }
}

export interface CsatSurveyWidgetProps {
  token: string
  ticketDisplayId?: string | number
  agentName?: string
  organizationName?: string
  initialRating?: number
  initialState?: 'loading' | 'form' | 'submitted' | 'already_submitted' | 'expired'
  onSubmit?: (data: CsatWidgetSubmission) => void | Promise<void>
  onSuccess?: () => void
}

export function CsatSurveyWidget({
  token: _token,
  ticketDisplayId,
  agentName,
  organizationName = 'Xatxoot Support',
  initialRating,
  initialState = 'form',
  onSubmit,
  onSuccess,
}: CsatSurveyWidgetProps) {
  const [state, setState] = useState<
    'loading' | 'form' | 'submitted' | 'already_submitted' | 'expired'
  >(initialState)
  const [selectedRating, setSelectedRating] = useState<number | null>(initialRating || null)
  const [feedbackText, setFeedbackText] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleRatingSelect = (rating: number) => {
    setSelectedRating(rating)
    if (errors.rating) {
      setErrors((prev) => {
        const { rating: _, ...rest } = prev
        return rest
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const payload: CsatWidgetSubmission = {
      rating: selectedRating as number,
      feedbackText: feedbackText.trim() ? feedbackText.trim() : undefined,
    }

    const validation = validateCsatSubmission(payload)
    if (!validation.success && validation.errors) {
      setErrors(validation.errors)
      return
    }

    setIsSubmitting(true)
    try {
      if (onSubmit) {
        await onSubmit(payload)
      }
      setState('submitted')
      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mengirim penilaian survei'
      setErrors({ global: msg })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-md mx-auto rounded-3xl bg-white shadow-xl border border-slate-100 overflow-hidden text-slate-800 transition-all">
      {/* Top Header & Branding Banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 text-white text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs text-2xl shadow-inner mb-2">
          ✨
        </div>
        <h2 className="text-base font-bold tracking-tight">{organizationName}</h2>
        <p className="text-xs text-white/80 mt-0.5">Survei Kepuasan Pelanggan (CSAT)</p>
      </div>

      <div className="p-6">
        {/* STATE: LOADING */}
        {state === 'loading' && (
          <div className="py-12 text-center space-y-3">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
            <p className="text-xs font-medium text-slate-500">Memuat survei...</p>
          </div>
        )}

        {/* STATE: ALREADY SUBMITTED */}
        {state === 'already_submitted' && (
          <div className="py-8 text-center space-y-3">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl text-emerald-600">
              ✓
            </span>
            <h3 className="text-lg font-bold text-slate-800">Survei Sudah Pernah Diisi</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Anda telah memberikan penilaian untuk percakapan ini sebelumnya. Terima kasih telah
              membantu kami menjadi lebih baik!
            </p>
          </div>
        )}

        {/* STATE: EXPIRED */}
        {state === 'expired' && (
          <div className="py-8 text-center space-y-3">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-3xl text-amber-600">
              ⌛
            </span>
            <h3 className="text-lg font-bold text-slate-800">Tautan Survei Kedaluwarsa</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Tautan pengisian survei ini sudah tidak berlaku lagi. Anda dapat menghubungi customer
              service kami jika membutuhkan bantuan lebih lanjut.
            </p>
          </div>
        )}

        {/* STATE: SUBMITTED (SUCCESS) */}
        {state === 'submitted' && (
          <div className="py-8 text-center space-y-3">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600 animate-bounce">
              🎉
            </span>
            <h3 className="text-lg font-bold text-slate-800">Terima Kasih Atas Penilaian Anda!</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Tanggapan Anda sangat berharga bagi kami dalam meningkatkan kualitas layanan ke
              depannya.
            </p>
          </div>
        )}

        {/* STATE: FORM */}
        {state === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {errors.global && (
              <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
                {errors.global}
              </div>
            )}

            {/* Ticket & Agent Context Pill */}
            {(ticketDisplayId || agentName) && (
              <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 flex items-center justify-between text-xs text-slate-600">
                {ticketDisplayId && (
                  <span className="font-semibold text-slate-700">Tiket #{ticketDisplayId}</span>
                )}
                {agentName && (
                  <span>
                    Dilayani oleh: <strong className="text-slate-800">{agentName}</strong>
                  </span>
                )}
              </div>
            )}

            {/* Prompt Question */}
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-slate-800">
                Seberapa puas Anda dengan pelayanan kami?
              </h3>
              <p className="text-xs text-slate-400">Pilih salah satu rating di bawah ini</p>
            </div>

            {/* 5 Rating Emoji / Star Cards */}
            <div className="grid grid-cols-5 gap-2 pt-1">
              {CSAT_RATING_OPTIONS.map((item) => {
                const isSelected = selectedRating === item.rating
                return (
                  <button
                    key={item.rating}
                    type="button"
                    onClick={() => handleRatingSelect(item.rating)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/60 shadow-md scale-105 ring-2 ring-emerald-500/30'
                        : `border-slate-200 bg-white ${item.colorClass}`
                    }`}
                  >
                    <span className="text-2xl transition-transform hover:scale-125 mb-1">
                      {item.emoji}
                    </span>
                    <span className="text-[10px] font-bold text-slate-700">{item.rating}</span>
                    <span className="text-[9px] text-slate-500 leading-tight text-center hidden sm:block mt-0.5">
                      {item.label}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Selected rating description badge */}
            {selectedRating && (
              <div className="text-center">
                <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  {CSAT_RATING_OPTIONS.find((o) => o.rating === selectedRating)?.label}
                </span>
              </div>
            )}

            {errors.rating && (
              <p className="text-center text-xs text-rose-600 font-medium">{errors.rating}</p>
            )}

            {/* Feedback Textarea */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <label htmlFor="csat-feedback" className="font-semibold">
                  Ceritakan pengalaman atau masukan Anda:
                </label>
                <span className="text-[11px] text-slate-400">{feedbackText.length}/2000</span>
              </div>
              <textarea
                id="csat-feedback"
                rows={3}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                maxLength={2000}
                placeholder="Pelayanan sangat ramah dan solutif..."
                className="w-full rounded-2xl border border-slate-200 p-3 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-hidden bg-slate-50/30"
              />
              {errors.feedbackText && (
                <p className="text-xs text-rose-600 font-medium">{errors.feedbackText}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !selectedRating}
              className="w-full rounded-2xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {isSubmitting ? 'Mengirim Penilaian...' : 'Kirim Penilaian'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default CsatSurveyWidget
