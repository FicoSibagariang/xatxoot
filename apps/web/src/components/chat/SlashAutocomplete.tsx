import type React from 'react'
import { Badge } from '../astryx'

export interface CannedItem {
  id: string
  shortCode: string
  content: string
  title?: string
}

export interface CommandItem {
  id: string
  name: string
  description?: string
  endpointUrl?: string
}

export type AutocompleteEntry =
  | ({ type: 'canned' } & CannedItem)
  | ({ type: 'command' } & CommandItem)

export interface DetectSlashResult {
  isActive: boolean
  query: string
  startIndex: number
}

export function detectSlashQuery(text: string): DetectSlashResult {
  if (!text) {
    return { isActive: false, query: '', startIndex: -1 }
  }

  // Look for slash at beginning of string or preceded by whitespace
  // followed by optional alphanumeric/dash/underscore chars up to the end
  const match = text.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/)
  if (!match) {
    return { isActive: false, query: '', startIndex: -1 }
  }

  const query = match[1] || ''
  const matchIndex = match.index ?? 0
  const startsWithWhitespace = /^\s/.test(match[0])
  const startIndex = startsWithWhitespace ? matchIndex + 1 : matchIndex

  return {
    isActive: true,
    query,
    startIndex,
  }
}

export function filterAutocompleteEntries(
  canned: CannedItem[] = [],
  commands: CommandItem[] = [],
  query = '',
): AutocompleteEntry[] {
  const q = query.toLowerCase().trim()

  const mappedCanned: AutocompleteEntry[] = canned.map((c) => ({
    type: 'canned',
    ...c,
  }))

  const mappedCommands: AutocompleteEntry[] = commands.map((cmd) => ({
    type: 'command',
    ...cmd,
  }))

  if (!q) {
    return [...mappedCanned, ...mappedCommands]
  }

  const filteredCanned = mappedCanned.filter((item) => {
    if (item.type !== 'canned') return false
    return (
      item.shortCode.toLowerCase().includes(q) ||
      item.content.toLowerCase().includes(q) ||
      item.title?.toLowerCase().includes(q)
    )
  })

  const filteredCommands = mappedCommands.filter((item) => {
    if (item.type !== 'command') return false
    return item.name.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q)
  })

  return [...filteredCanned, ...filteredCommands]
}

export function applyAutocompleteSelection(
  currentText: string,
  startIndex: number,
  entry: AutocompleteEntry,
): string {
  const prefix = currentText.slice(0, startIndex)
  if (entry.type === 'canned') {
    return prefix + entry.content
  }
  return `${prefix}/${entry.name} `
}

export interface SlashAutocompletePopupProps {
  isOpen: boolean
  query: string
  entries: AutocompleteEntry[]
  selectedIndex: number
  onSelect: (entry: AutocompleteEntry) => void
  onHover?: (index: number) => void
  onClose?: () => void
}

export function SlashAutocompletePopup({
  isOpen,
  query,
  entries,
  selectedIndex,
  onSelect,
  onHover,
}: SlashAutocompletePopupProps) {
  if (!isOpen) return null

  return (
    <div
      data-testid="slash-autocomplete-popup"
      className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 flex flex-col text-slate-800 transition-all animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      <div
        data-testid="autocomplete-header"
        className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-500 flex items-center justify-between"
      >
        <span className="font-medium flex items-center gap-1.5">
          <span className="text-wa-teal-primary font-bold">/</span>
          {entries.length > 0
            ? `Menampilkan ${entries.length} balasan & perintah`
            : 'Pencarian Balasan Cepat & Slash Commands'}
        </span>
        <span className="text-[11px] text-slate-400">
          ↑↓ navigasi &bull; Enter pilih &bull; Esc tutup
        </span>
      </div>

      {entries.length === 0 ? (
        <div
          data-testid="autocomplete-empty-state"
          className="p-4 text-center text-xs text-slate-500"
        >
          Tidak ada balasan cepat atau slash command yang cocok dengan &apos;/{query}&apos;
        </div>
      ) : (
        <ul
          data-testid="autocomplete-list"
          className="max-h-60 overflow-y-auto divide-y divide-slate-100"
        >
          {entries.map((entry, index) => {
            const isSelected = index === selectedIndex
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  data-testid={`autocomplete-item-${entry.id}`}
                  data-selected={isSelected ? 'true' : 'false'}
                  onClick={() => onSelect(entry)}
                  onMouseEnter={() => onHover?.(index)}
                  className={`w-full text-left px-3.5 py-2.5 flex items-start justify-between gap-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-emerald-50 border-l-4 border-wa-teal-primary pl-2.5'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs font-semibold text-emerald-800">
                        /{entry.type === 'canned' ? entry.shortCode : entry.name}
                      </span>
                      {entry.type === 'canned' ? (
                        <Badge variant="success" size="sm">
                          💬 Balasan Cepat
                        </Badge>
                      ) : (
                        <Badge variant="ticket-snoozed" size="sm">
                          ⚡ Slash Command
                        </Badge>
                      )}
                      {entry.type === 'canned' && entry.title && (
                        <span className="text-[11px] text-slate-400 font-medium truncate">
                          &bull; {entry.title}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-1 truncate">
                      {entry.type === 'canned'
                        ? entry.content
                        : entry.description || entry.endpointUrl || 'Perintah eksternal'}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400 self-center shrink-0">
                    {isSelected ? '⏎ Enter' : ''}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
