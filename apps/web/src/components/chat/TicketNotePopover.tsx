import { type KeyboardEvent, useEffect, useRef, useState } from 'react'

export interface TicketNotePopoverProps {
  isOpen: boolean
  ticketNumber?: string | number
  initialNote?: string | null
  updatedAt?: string | null
  updatedBy?: string | null
  isSaving?: boolean
  onSave: (note: string) => void | Promise<void>
  onClose: () => void
  onDelete?: () => void | Promise<void>
}

export function TicketNotePopover({
  isOpen,
  ticketNumber,
  initialNote = '',
  updatedAt,
  updatedBy,
  isSaving = false,
  onSave,
  onClose,
  onDelete,
}: TicketNotePopoverProps) {
  const [note, setNote] = useState(initialNote || '')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      setNote(initialNote || '')
      // Auto focus textarea on open
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 50)
    }
  }, [isOpen, initialNote])

  if (!isOpen) return null

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  const handleSave = () => {
    onSave(note)
  }

  const handleDelete = () => {
    if (onDelete) {
      onDelete()
    } else {
      onSave('')
    }
    setNote('')
  }

  const formatMetaTime = (iso?: string | null) => {
    if (!iso) return null
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formattedTime = formatMetaTime(updatedAt)

  return (
    <div
      data-testid="ticket-note-popover"
      className="absolute top-full mt-2 right-0 z-50 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 p-4 text-left select-text"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <span className="text-base select-none">📌</span>
          <h4 id="ticket-note-title" className="text-xs font-bold text-slate-800">
            Catatan Internal Tiket {ticketNumber ? `(#${ticketNumber})` : ''}
          </h4>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 text-xs leading-none cursor-pointer"
          title="Tutup (Esc)"
        >
          ✕
        </button>
      </div>

      {/* Note Textarea */}
      <textarea
        ref={textareaRef}
        data-testid="ticket-note-textarea"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Tulis catatan internal untuk agen lain... (Ctrl+Enter untuk simpan)"
        rows={4}
        className="w-full text-xs text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:bg-white focus:border-wa-teal-primary focus:ring-1 focus:ring-wa-teal-primary resize-y"
      />

      {/* Metadata info */}
      <div
        data-testid="ticket-note-meta"
        className="mt-1.5 mb-3 text-[11px] text-slate-500 flex items-center justify-between"
      >
        <span>
          {updatedBy || formattedTime ? (
            <>
              Diperbarui
              {updatedBy ? ` oleh ${updatedBy}` : ''}
              {formattedTime ? ` • ${formattedTime}` : ''}
            </>
          ) : (
            'Belum ada riwayat pembaruan'
          )}
        </span>
        <span className="text-[10px] text-slate-400">Ctrl+Enter</span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div>
          {initialNote && (
            <button
              type="button"
              data-testid="btn-delete-ticket-note"
              onClick={handleDelete}
              disabled={isSaving}
              className="text-xs text-rose-600 hover:text-rose-700 hover:underline cursor-pointer disabled:opacity-50"
            >
              Hapus
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="btn-cancel-ticket-note"
            onClick={onClose}
            disabled={isSaving}
            className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 rounded hover:bg-slate-100 cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            data-testid="btn-save-ticket-note"
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-wa-teal-primary hover:bg-wa-teal-dark rounded shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1"
          >
            {isSaving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
