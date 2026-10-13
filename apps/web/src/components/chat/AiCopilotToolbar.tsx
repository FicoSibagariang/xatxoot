import type React from 'react'
import { useState } from 'react'

export type CopilotTone = 'polite' | 'formal' | 'concise' | 'friendly'
export type CopilotResultType = 'summary' | 'improve' | 'draft' | 'tone'

export interface SuggestedArticle {
  id: string
  title: string
  snippet?: string
}

export interface AiCopilotToolbarProps {
  isOpen: boolean
  isLoading?: boolean
  loadingAction?: string
  errorMessage?: string | null
  resultText?: string | null
  resultType?: CopilotResultType | null
  suggestedArticles?: SuggestedArticle[]
  currentText?: string
  onToggle: () => void
  onSummarize: () => void
  onImproveWriting: (text?: string) => void
  onDraftReply: () => void
  onChangeTone: (tone: CopilotTone) => void
  onApplyText: (text: string) => void
  onInjectNote?: (summary: string) => void
  onClearResult?: () => void
}

export interface AiMagicButtonProps {
  isOpen: boolean
  onToggle: () => void
  isLoading?: boolean
  hasResult?: boolean
  className?: string
}

export function AiMagicButton({
  isOpen,
  onToggle,
  isLoading,
  hasResult,
  className = '',
}: AiMagicButtonProps) {
  return (
    <button
      type="button"
      data-testid="btn-ai-magic"
      title="AI Copilot: Ringkas, Perbaiki Bahasa, atau Buat Draf"
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
        isOpen
          ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-300'
          : hasResult
            ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
            : 'text-slate-600 hover:text-purple-700 hover:bg-purple-50'
      } ${className}`}
    >
      <span className="text-sm select-none">✨</span>
      <span className="hidden sm:inline font-semibold">AI Copilot</span>
      {isLoading && <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />}
    </button>
  )
}

export function AiCopilotToolbar({
  isOpen,
  isLoading = false,
  loadingAction = 'AI sedang memproses...',
  errorMessage = null,
  resultText = null,
  resultType = null,
  suggestedArticles = [],
  currentText = '',
  onToggle,
  onSummarize,
  onImproveWriting,
  onDraftReply,
  onChangeTone,
  onApplyText,
  onInjectNote,
  onClearResult,
}: AiCopilotToolbarProps) {
  const [selectedTone, setSelectedTone] = useState<CopilotTone>('polite')

  if (!isOpen) return null

  const handleToneClick = (tone: CopilotTone) => {
    setSelectedTone(tone)
    onChangeTone(tone)
  }

  return (
    <div
      data-testid="ai-copilot-toolbar"
      className="absolute bottom-full left-0 right-0 mb-2 mx-3 bg-white/95 backdrop-blur-md border border-purple-200 rounded-xl shadow-xl p-3 z-30 transition-all text-xs"
    >
      {/* Header Toolbar */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-md bg-purple-100 text-purple-700 text-sm">✨</span>
          <span className="font-semibold text-slate-800">AI Copilot Assistant</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-50 text-purple-600 border border-purple-200">
            Smart Reply
          </span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          title="Tutup Toolbar AI"
          className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* Main Action Buttons */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
        <button
          type="button"
          data-testid="btn-copilot-summarize"
          disabled={isLoading}
          onClick={onSummarize}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 font-medium border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <span>📝</span>
          <span>Ringkas</span>
        </button>

        <button
          type="button"
          data-testid="btn-copilot-improve"
          disabled={isLoading}
          onClick={() => onImproveWriting(currentText)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 font-medium border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <span>✍️</span>
          <span>Perbaiki Bahasa</span>
        </button>

        <button
          type="button"
          data-testid="btn-copilot-draft"
          disabled={isLoading}
          onClick={onDraftReply}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
        >
          <span>💡</span>
          <span>Buat Draf</span>
        </button>

        {/* Tone Adjustment Pills */}
        <div className="hidden sm:flex items-center gap-1 pl-2 ml-auto border-l border-slate-200">
          <span className="text-[11px] text-slate-500 font-medium">Nada:</span>
          {(['polite', 'formal', 'concise', 'friendly'] as CopilotTone[]).map((t) => (
            <button
              key={t}
              type="button"
              data-testid={`tone-select-${t}`}
              disabled={isLoading}
              onClick={() => handleToneClick(t)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                selectedTone === t
                  ? 'bg-purple-100 text-purple-700 border border-purple-300'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t === 'polite' && 'Sopan'}
              {t === 'formal' && 'Formal'}
              {t === 'concise' && 'Ringkas'}
              {t === 'friendly' && 'Ramah'}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Shimmer State */}
      {isLoading && (
        <div
          data-testid="ai-loading-indicator"
          className="flex items-center gap-2 p-2.5 bg-purple-50/80 rounded-lg text-purple-700 border border-purple-100 animate-pulse"
        >
          <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <span className="font-medium">{loadingAction}</span>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div
          data-testid="ai-error-banner"
          className="flex items-center justify-between p-2.5 bg-rose-50 text-rose-700 rounded-lg border border-rose-200 mb-2"
        >
          <span>⚠️ {errorMessage}</span>
        </div>
      )}

      {/* Result Preview Box */}
      {resultText && (
        <div
          data-testid="ai-result-preview"
          className="p-3 bg-slate-50 rounded-lg border border-slate-200 mt-2 space-y-2"
        >
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
            <span>
              {resultType === 'summary' && 'Ringkasan Percakapan'}
              {resultType === 'improve' && 'Hasil Perbaikan Bahasa'}
              {resultType === 'draft' && 'Usulan Draf Balasan AI'}
              {resultType === 'tone' && `Penyesuaian Nada (${selectedTone})`}
              {!resultType && 'Hasil AI'}
            </span>
            {onClearResult && (
              <button
                type="button"
                onClick={onClearResult}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Bersihkan
              </button>
            )}
          </div>

          <p className="text-slate-800 text-xs leading-relaxed whitespace-pre-wrap bg-white p-2.5 rounded border border-slate-200 font-sans">
            {resultText}
          </p>

          {/* Suggested RAG Articles */}
          {suggestedArticles && suggestedArticles.length > 0 && (
            <div data-testid="ai-suggested-articles" className="pt-1 border-t border-slate-200">
              <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                📚 Referensi Help Center:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {suggestedArticles.map((art) => (
                  <span
                    key={art.id}
                    title={art.snippet}
                    className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200"
                  >
                    📖 {art.title}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions for Generated Result */}
          <div className="flex items-center justify-end gap-2 pt-1">
            {resultType === 'summary' && onInjectNote && (
              <button
                type="button"
                data-testid="btn-inject-note"
                onClick={() => onInjectNote(resultText)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors cursor-pointer shadow-xs"
              >
                <span>📌</span>
                <span>Sematkan ke Catatan</span>
              </button>
            )}

            <button
              type="button"
              data-testid="btn-apply-result"
              onClick={() => onApplyText(resultText)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors cursor-pointer shadow-xs"
            >
              <span>✓</span>
              <span>
                {resultType === 'summary'
                  ? 'Gunakan Teks'
                  : resultType === 'draft'
                    ? 'Gunakan Draf'
                    : 'Terapkan'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
