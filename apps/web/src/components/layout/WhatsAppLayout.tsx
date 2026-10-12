import { type ReactNode, useState } from 'react'
import { AnalyticsDashboard } from '../analytics'
import { Avatar, Badge, Button, Input } from '../astryx'
import {
  type AutocompleteEntry,
  type CannedItem,
  ChatTimeline,
  type CommandItem,
  DeadlineTimerBadge,
  SlashAutocompletePopup,
  type TimelineMessage,
  applyAutocompleteSelection,
  detectSlashQuery,
  filterAutocompleteEntries,
} from '../chat'
import { type ContactDrawerData, ContactDrawer as CrmContactDrawer } from '../drawer'
import type {
  ChatFilter,
  ConversationItem,
  LayoutChannelFilter,
  LayoutNavTab,
  LayoutUser,
  PresenceStatus,
} from './types'

// ==========================================
// Kolom 1: NavRail (60px fixed width)
// ==========================================
export interface NavRailProps {
  currentUser: LayoutUser
  activeTab: LayoutNavTab
  activeChannelFilter: LayoutChannelFilter
  onTabChange: (tab: LayoutNavTab) => void
  onChannelFilterChange: (channel: LayoutChannelFilter) => void
  onPresenceChange: (status: PresenceStatus) => void
  onOpenSettings?: () => void
}

export function NavRail({
  currentUser,
  activeTab,
  activeChannelFilter,
  onTabChange,
  onChannelFilterChange,
  onPresenceChange,
  onOpenSettings,
}: NavRailProps) {
  const [showPresenceMenu, setShowPresenceMenu] = useState(false)

  return (
    <aside
      data-testid="nav-rail"
      className="w-[60px] h-full bg-[#111b21] text-slate-300 flex flex-col items-center py-3.5 justify-between shrink-0 select-none z-20 border-r border-slate-800"
    >
      {/* Top Section: User Avatar & Main Navigation Tabs */}
      <div className="flex flex-col items-center gap-4 w-full">
        {/* User Avatar with Presence Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPresenceMenu(!showPresenceMenu)}
            className="rounded-full focus:outline-none focus:ring-2 focus:ring-wa-teal-primary cursor-pointer transition-transform hover:scale-105"
            title={`${currentUser.name} (${currentUser.status})`}
          >
            <Avatar
              name={currentUser.name}
              src={currentUser.avatarUrl}
              size="md"
              presence={currentUser.status}
            />
          </button>

          {showPresenceMenu && (
            <div className="absolute left-14 top-0 bg-[#202c33] text-white text-xs rounded-xl shadow-xl border border-slate-700 py-1.5 w-32 z-50">
              <div className="px-3 py-1 font-semibold text-slate-400 border-b border-slate-700/60 mb-1">
                Ubah Status
              </div>
              {(['online', 'busy', 'offline'] as PresenceStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    onPresenceChange(st)
                    setShowPresenceMenu(false)
                  }}
                  className={`w-full text-left px-3 py-1.5 hover:bg-slate-700/60 flex items-center gap-2 capitalize ${
                    currentUser.status === st ? 'text-wa-teal-primary font-bold' : 'text-slate-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      st === 'online'
                        ? 'bg-emerald-500'
                        : st === 'busy'
                          ? 'bg-amber-500'
                          : 'bg-slate-400'
                    }`}
                  />
                  {st}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-8 h-[1px] bg-slate-800 my-1" />

        {/* Main Navigation Tabs */}
        <div className="flex flex-col items-center gap-2.5 w-full">
          <button
            type="button"
            data-testid="nav-tab-inbox"
            data-active={activeTab === 'inbox'}
            onClick={() => onTabChange('inbox')}
            title="Inbox Percakapan"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'inbox'
                ? 'bg-[#202c33] text-wa-teal-primary font-bold shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            💬
          </button>

          <button
            type="button"
            data-testid="nav-tab-contacts"
            data-active={activeTab === 'contacts'}
            onClick={() => onTabChange('contacts')}
            title="Kontak & CRM"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'contacts'
                ? 'bg-[#202c33] text-wa-teal-primary font-bold shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            👥
          </button>

          <button
            type="button"
            data-testid="nav-tab-reports"
            data-active={activeTab === 'reports'}
            onClick={() => onTabChange('reports')}
            title="Laporan & Metrik"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-[#202c33] text-wa-teal-primary font-bold shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            📊
          </button>

          <button
            type="button"
            data-testid="nav-tab-settings"
            data-active={activeTab === 'settings'}
            onClick={() => {
              onTabChange('settings')
              if (onOpenSettings) onOpenSettings()
            }}
            title="Pengaturan Instance"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-[#202c33] text-wa-teal-primary font-bold shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Bottom Section: Quick Channel Filters */}
      <div className="flex flex-col items-center gap-2 w-full pt-3 border-t border-slate-800">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">
          CH
        </div>

        <button
          type="button"
          data-testid="channel-filter-all"
          data-active={activeChannelFilter === 'all'}
          onClick={() => onChannelFilterChange('all')}
          title="Semua Channel"
          className={`w-8 h-8 rounded-lg text-xs flex items-center justify-center transition-all cursor-pointer ${
            activeChannelFilter === 'all'
              ? 'bg-wa-teal-primary text-white font-bold'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          ALL
        </button>

        <button
          type="button"
          data-testid="channel-filter-whatsapp"
          data-active={activeChannelFilter === 'whatsapp'}
          onClick={() => onChannelFilterChange('whatsapp')}
          title="Filter WhatsApp"
          className={`w-8 h-8 rounded-lg text-xs flex items-center justify-center transition-all cursor-pointer ${
            activeChannelFilter === 'whatsapp'
              ? 'bg-wa-teal-primary text-white font-bold'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          💬
        </button>

        <button
          type="button"
          data-testid="channel-filter-widget"
          data-active={activeChannelFilter === 'widget'}
          onClick={() => onChannelFilterChange('widget')}
          title="Filter Live Chat Widget"
          className={`w-8 h-8 rounded-lg text-xs flex items-center justify-center transition-all cursor-pointer ${
            activeChannelFilter === 'widget'
              ? 'bg-wa-teal-primary text-white font-bold'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          🌐
        </button>

        <button
          type="button"
          data-testid="channel-filter-api"
          data-active={activeChannelFilter === 'api'}
          onClick={() => onChannelFilterChange('api')}
          title="Filter API Channel"
          className={`w-8 h-8 rounded-lg text-xs flex items-center justify-center transition-all cursor-pointer ${
            activeChannelFilter === 'api'
              ? 'bg-wa-teal-primary text-white font-bold'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          ⚡
        </button>
      </div>
    </aside>
  )
}

// ==========================================
// Kolom 2: ChatListPanel (360px - 400px Bounded)
// ==========================================
export interface ChatListPanelProps {
  conversations: ConversationItem[]
  selectedConversationId?: string | null
  activeFilter: ChatFilter
  searchQuery: string
  now?: Date
  onSelectConversation: (id: string) => void
  onFilterChange: (filter: ChatFilter) => void
  onSearchChange: (query: string) => void
  onNewChat: () => void
}

export function ChatListPanel({
  conversations,
  selectedConversationId,
  activeFilter,
  searchQuery,
  now,
  onSelectConversation,
  onFilterChange,
  onSearchChange,
  onNewChat,
}: ChatListPanelProps) {
  const getTicketStatusBadgeVariant = (status?: string) => {
    switch (status) {
      case 'open':
        return 'ticket-open'
      case 'pending':
        return 'ticket-pending'
      case 'resolved':
        return 'ticket-resolved'
      case 'snoozed':
        return 'ticket-snoozed'
      default:
        return 'default'
    }
  }

  const formatTicketStatus = (status?: string) => {
    if (!status) return ''
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  return (
    <section
      data-testid="chat-list-panel"
      className="w-[360px] md:w-[380px] h-full bg-white border-r border-[#e9edef] flex flex-col shrink-0 select-none overflow-hidden"
    >
      {/* Header Bar (#f0f2f5) */}
      <div
        data-testid="chat-list-header"
        className="h-16 bg-[#f0f2f5] px-4 flex items-center justify-between border-b border-[#e9edef] shrink-0"
      >
        <h2 className="text-xl font-bold text-[#111b21]">Chat</h2>
        <div className="flex items-center gap-2">
          <Button variant="icon" size="icon" onClick={onNewChat} title="Chat Baru / Broadcast">
            ✏️
          </Button>
        </div>
      </div>

      {/* Search Bar Pill */}
      <div className="p-2.5 bg-white border-b border-[#f0f2f5] shrink-0">
        <Input
          data-testid="chat-search-input"
          placeholder="Cari atau mulai chat baru (/)"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          icon={<span className="text-slate-400">🔍</span>}
          shortcutHint="/"
        />
      </div>

      {/* Quick Filter Pills */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-white overflow-x-auto border-b border-[#f0f2f5] shrink-0 scrollbar-none">
        <button
          type="button"
          data-testid="filter-pill-all"
          data-active={activeFilter === 'all'}
          onClick={() => onFilterChange('all')}
          className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors whitespace-nowrap cursor-pointer ${
            activeFilter === 'all'
              ? 'bg-[#e7fce3] text-[#008069]'
              : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
          }`}
        >
          Semua
        </button>

        <button
          type="button"
          data-testid="filter-pill-unread"
          data-active={activeFilter === 'unread'}
          onClick={() => onFilterChange('unread')}
          className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors whitespace-nowrap cursor-pointer ${
            activeFilter === 'unread'
              ? 'bg-[#e7fce3] text-[#008069]'
              : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
          }`}
        >
          Belum Dibaca
        </button>

        <button
          type="button"
          data-testid="filter-pill-assigned_me"
          data-active={activeFilter === 'assigned_me'}
          onClick={() => onFilterChange('assigned_me')}
          className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors whitespace-nowrap cursor-pointer ${
            activeFilter === 'assigned_me'
              ? 'bg-[#e7fce3] text-[#008069]'
              : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
          }`}
        >
          Ditugaskan ke Saya
        </button>

        <button
          type="button"
          data-testid="filter-pill-unassigned"
          data-active={activeFilter === 'unassigned'}
          onClick={() => onFilterChange('unassigned')}
          className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors whitespace-nowrap cursor-pointer ${
            activeFilter === 'unassigned'
              ? 'bg-[#e7fce3] text-[#008069]'
              : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
          }`}
        >
          Belum Ditugaskan
        </button>
      </div>

      {/* Conversation List Scroll Area */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#f0f2f5]">
        {conversations.length === 0 ? (
          <div className="p-8 text-center text-[#667781] text-sm">
            Tidak ada percakapan ditemukan.
          </div>
        ) : (
          conversations.map((conv) => {
            const isSelected = selectedConversationId === conv.id
            return (
              <button
                type="button"
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                  isSelected ? 'bg-[#f0f2f5]' : 'hover:bg-[#f5f6f6]'
                }`}
              >
                {/* Contact Avatar */}
                <Avatar
                  name={conv.contactName}
                  src={conv.contactAvatarUrl}
                  channel={conv.channel}
                  size="md"
                />

                {/* Info Container */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-semibold text-sm text-[#111b21] truncate">
                      {conv.contactName}
                    </span>
                    {conv.lastMessageTimestamp && (
                      <span className="text-[11px] text-[#667781] shrink-0 ml-2">
                        {conv.lastMessageTimestamp}
                      </span>
                    )}
                  </div>

                  {/* Ticket Badge & Last Message */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 truncate">
                      {conv.ticket && (
                        <>
                          <span className="text-[11px] font-semibold text-[#008069] shrink-0">
                            #{conv.ticket.ticketNumber} [{formatTicketStatus(conv.ticket.status)}]
                          </span>
                          <DeadlineTimerBadge
                            deadlineAt={conv.ticket.deadlineAt}
                            status={conv.ticket.status}
                            now={now}
                          />
                        </>
                      )}
                      <p className="text-xs text-[#667781] truncate">
                        {conv.lastMessage || 'Tidak ada pesan'}
                      </p>
                    </div>

                    {/* Unread Badge */}
                    {Boolean(conv.unreadCount && conv.unreadCount > 0) && (
                      <Badge variant="wa-unread" data-testid="unread-badge" size="sm">
                        {conv.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </section>
  )
}

// ==========================================
// Kolom 3: ConversationThread (Flex-1 Canvas Obrolan)
// ==========================================
const DEFAULT_CANNED_RESPONSES: CannedItem[] = [
  {
    id: 'canned-halo',
    shortCode: 'halo',
    content:
      'Halo kak! Selamat datang di layanan pelanggan kami. Ada yang bisa kami bantu hari ini?',
    title: 'Salam Pembuka',
  },
  {
    id: 'canned-ongkir',
    shortCode: 'ongkir',
    content:
      'Untuk pengecekan estimasi ongkos kirim, mohon informasikan alamat kecamatan dan kota tujuan ya kak.',
    title: 'Estimasi Ongkir',
  },
  {
    id: 'canned-terimakasih',
    shortCode: 'terimakasih',
    content: 'Terima kasih banyak telah menghubungi kami kak! Semoga harimu menyenangkan.',
    title: 'Ucapan Terima Kasih',
  },
  {
    id: 'canned-jamkerja',
    shortCode: 'jamkerja',
    content: 'Jam operasional layanan kami adalah Senin - Jumat pukul 08.00 - 17.00 WIB.',
    title: 'Jam Operasional',
  },
]

const DEFAULT_SLASH_COMMANDS: CommandItem[] = [
  {
    id: 'cmd-cekresi',
    name: 'cekresi',
    description: 'Lacak status pengiriman kurir ekspedisi secara real-time',
    endpointUrl: 'https://api.external.com/courier/track',
  },
  {
    id: 'cmd-statusorder',
    name: 'statusorder',
    description: 'Periksa status pemesanan pelanggan di sistem e-commerce',
    endpointUrl: 'https://api.external.com/orders/status',
  },
  {
    id: 'cmd-refund',
    name: 'refund',
    description: 'Proses pengajuan klaim pengembalian dana tiket pelanggan',
    endpointUrl: 'https://api.external.com/orders/refund',
  },
]

export interface ConversationThreadProps {
  conversation: ConversationItem | null
  isDrawerOpen: boolean
  messages?: TimelineMessage[]
  cannedResponses?: CannedItem[]
  slashCommands?: CommandItem[]
  now?: Date
  onToggleDrawer: () => void
  onSendMessage: (message: string) => void
  onAssignTicket: () => void
  onResolveTicket: () => void
  onRetryMessage?: (message: TimelineMessage) => void
  onOpenTemplateDialog?: () => void
  children?: ReactNode
}

export function ConversationThread({
  conversation,
  isDrawerOpen,
  messages,
  cannedResponses,
  slashCommands,
  now,
  onToggleDrawer,
  onSendMessage,
  onAssignTicket,
  onResolveTicket,
  onRetryMessage,
  onOpenTemplateDialog,
  children,
}: ConversationThreadProps) {
  const [inputText, setInputText] = useState('')
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false)
  const [selectedAutocompleteIndex, setSelectedAutocompleteIndex] = useState(0)

  const activeCanned = cannedResponses ?? DEFAULT_CANNED_RESPONSES
  const activeCommands = slashCommands ?? DEFAULT_SLASH_COMMANDS

  const slashInfo = detectSlashQuery(inputText)
  const filteredEntries = slashInfo.isActive
    ? filterAutocompleteEntries(activeCanned, activeCommands, slashInfo.query)
    : []

  if (!conversation) {
    return (
      <main
        data-testid="conversation-empty-state"
        className="flex-1 h-full bg-[#f0f2f5] flex flex-col items-center justify-center p-8 text-center select-none border-b-6 border-[#00a884]"
      >
        <div className="w-20 h-20 rounded-full bg-emerald-100 text-wa-teal-primary text-4xl flex items-center justify-center mb-6 shadow-sm">
          💬
        </div>
        <h2 className="text-2xl font-semibold text-[#41525d] mb-2">Xatxoot Customer Support</h2>
        <p className="text-sm text-[#667781] max-w-md leading-relaxed mb-6">
          Pilih percakapan di bilah kiri untuk membaca pesan dan menangani tiket pelanggan secara
          real-time.
        </p>
        <div className="flex items-center gap-2 text-xs text-[#8696a0]">
          <span>🔒</span>
          <span>End-to-end encrypted dengan WhatsApp Cloud & Baileys Gateway</span>
        </div>
      </main>
    )
  }

  const handleSend = () => {
    if (!inputText.trim()) return
    onSendMessage(inputText)
    setInputText('')
    setIsAutocompleteOpen(false)
  }

  const handleInputChange = (val: string) => {
    setInputText(val)
    const detected = detectSlashQuery(val)
    if (detected.isActive) {
      setIsAutocompleteOpen(true)
      setSelectedAutocompleteIndex(0)
    } else {
      setIsAutocompleteOpen(false)
    }
  }

  const handleSelectEntry = (entry: AutocompleteEntry) => {
    if (!slashInfo.isActive) return
    const newText = applyAutocompleteSelection(inputText, slashInfo.startIndex, entry)
    setInputText(newText)
    setIsAutocompleteOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isAutocompleteOpen && slashInfo.isActive && filteredEntries.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedAutocompleteIndex((prev) => (prev + 1) % filteredEntries.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedAutocompleteIndex(
          (prev) => (prev - 1 + filteredEntries.length) % filteredEntries.length,
        )
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const selected = filteredEntries[selectedAutocompleteIndex]
        if (selected) {
          handleSelectEntry(selected)
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setIsAutocompleteOpen(false)
        return
      }
    }

    if (e.key === 'Enter') {
      handleSend()
    }
  }

  return (
    <main
      data-testid="conversation-thread"
      className="flex-1 h-full flex flex-col bg-[#efeae2] overflow-hidden"
    >
      {/* Header Percakapan */}
      <header
        data-testid="thread-header"
        className="h-16 bg-[#f0f2f5] px-4 flex items-center justify-between border-b border-[#e9edef] shrink-0 z-10"
      >
        {/* Contact info pill (Click to open Drawer) */}
        <button
          type="button"
          data-testid="btn-toggle-drawer"
          onClick={onToggleDrawer}
          className="flex items-center gap-3 text-left focus:outline-none hover:bg-slate-200/50 p-1.5 rounded-lg transition-colors cursor-pointer"
        >
          <Avatar
            name={conversation.contactName}
            src={conversation.contactAvatarUrl}
            channel={conversation.channel}
            size="md"
          />
          <div>
            <h3 className="font-semibold text-sm text-[#111b21] flex items-center gap-1.5 leading-tight">
              <span>{conversation.contactName}</span>
              {conversation.contactPhone && (
                <span className="text-xs font-normal text-[#667781]">
                  ({conversation.contactPhone})
                </span>
              )}
            </h3>
            <p className="text-[11px] text-[#00a884] font-medium leading-tight">
              {conversation.presence === 'typing'
                ? 'mengetik...'
                : conversation.presence || 'online'}
            </p>
          </div>
        </button>

        {/* Quick Ticket Actions */}
        <div className="flex items-center gap-2">
          {conversation.ticket && (
            <>
              <span className="text-xs font-semibold px-2 py-1 rounded bg-[#e7fce3] text-[#008069] border border-[#c1f7b7]">
                #{conversation.ticket.ticketNumber}
              </span>
              <DeadlineTimerBadge
                deadlineAt={conversation.ticket.deadlineAt}
                status={conversation.ticket.status}
                now={now}
                size="md"
              />
            </>
          )}

          <Button
            data-testid="btn-assign-ticket"
            variant="secondary"
            size="sm"
            onClick={onAssignTicket}
          >
            Assign
          </Button>

          <Button
            data-testid="btn-resolve-ticket"
            variant="teal"
            size="sm"
            onClick={onResolveTicket}
          >
            Resolve
          </Button>
        </div>
      </header>

      {/* Canvas Obrolan (Doodle Wallpaper Background) */}
      <div data-testid="doodle-canvas" className="flex-1 overflow-y-auto p-4 wa-doodle-pattern">
        {children ||
          (messages && messages.length > 0 ? (
            <ChatTimeline messages={messages} onRetryMessage={onRetryMessage} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="bg-[#ffffff]/90 backdrop-blur-xs px-4 py-2 rounded-lg shadow-xs text-xs text-[#54656f] border border-[#e9edef] max-w-sm">
                <span className="font-semibold text-emerald-800">Tiket Aktif: </span>
                {conversation.ticket?.ticketNumber || 'T-Baru'} &bull; Mulai percakapan di bawah
                ini.
              </div>
            </div>
          ))}
      </div>

      {/* Bottom Input Bar */}
      <footer
        data-testid="thread-input-bar"
        className="bg-[#f0f2f5] px-4 py-2.5 flex items-center gap-2.5 border-t border-[#e9edef] shrink-0 relative"
      >
        <button
          type="button"
          title="Emoji"
          className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-200/60 text-lg"
        >
          😊
        </button>

        <button
          type="button"
          title="Lampiran Gambar/File"
          className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-200/60 text-lg cursor-pointer"
        >
          📎
        </button>

        <button
          type="button"
          data-testid="btn-open-template-dialog"
          title="Template Pesan WhatsApp Resmi"
          onClick={onOpenTemplateDialog}
          className="p-2 text-slate-500 hover:text-emerald-700 rounded-full hover:bg-slate-200/60 text-lg cursor-pointer"
        >
          📋
        </button>

        <div className="relative flex-1">
          <SlashAutocompletePopup
            isOpen={isAutocompleteOpen && slashInfo.isActive}
            query={slashInfo.query}
            entries={filteredEntries}
            selectedIndex={selectedAutocompleteIndex}
            onSelect={handleSelectEntry}
            onHover={setSelectedAutocompleteIndex}
            onClose={() => setIsAutocompleteOpen(false)}
          />

          <input
            type="text"
            placeholder="Ketik pesan atau ketik / untuk balasan cepat..."
            value={inputText}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-white text-sm text-[#111b21] rounded-lg px-4 py-2 border border-[#e9edef] focus:outline-none focus:border-wa-teal-primary"
          />
        </div>

        <Button variant="teal" size="sm" onClick={handleSend} className="rounded-lg px-4 py-2">
          Kirim
        </Button>
      </footer>
    </main>
  )
}

// ==========================================
// Kolom 3.5: ContactDrawer (Slide-Over Context CRM)
// ==========================================
export interface ContactDrawerProps {
  isOpen: boolean
  conversation: ConversationItem | null
  internalNote?: string
  contactData?: ContactDrawerData | null
  onClose: () => void
  onSaveInternalNote?: (note: string) => void
  onSelectTicket?: (ticketId: string) => void
}

export function ContactDrawer({
  isOpen,
  conversation,
  internalNote = '',
  contactData,
  onClose,
  onSaveInternalNote,
  onSelectTicket,
}: ContactDrawerProps) {
  if (!isOpen || (!conversation && !contactData)) {
    return null
  }

  const data: ContactDrawerData =
    contactData ||
    (conversation
      ? {
          contactId: conversation.id,
          contactName: conversation.contactName,
          contactPhone: conversation.contactPhone,
          avatarUrl: conversation.contactAvatarUrl,
          channel: conversation.channel,
          tags: ['VIP', 'Pelanggan Aktif'],
          customAttributes: {
            Channel: conversation.channel,
            Kehadiran: conversation.presence || 'online',
          },
          activeTicket: conversation.ticket
            ? {
                id: conversation.ticket.id,
                ticketNumber: conversation.ticket.ticketNumber,
                status: conversation.ticket.status,
                priority: conversation.ticket.priority || 'high',
                internalNote: internalNote,
              }
            : undefined,
          ticketHistory: conversation.ticket
            ? [
                {
                  id: conversation.ticket.id,
                  ticketNumber: conversation.ticket.ticketNumber,
                  status: conversation.ticket.status,
                  priority: conversation.ticket.priority || 'high',
                  createdAt: 'Hari ini',
                },
              ]
            : [],
        }
      : {
          contactId: 'unknown',
          contactName: 'Kontak',
          channel: 'whatsapp',
        })

  return (
    <CrmContactDrawer
      isOpen={isOpen}
      data={data}
      onClose={onClose}
      onSaveNote={onSaveInternalNote}
      onSelectTicket={onSelectTicket}
    />
  )
}

// ==========================================
// Main WhatsAppLayout Orchestrator
// ==========================================
export interface WhatsAppLayoutProps {
  currentUser: LayoutUser
  conversations: ConversationItem[]
  selectedConversationId?: string | null
  isDrawerOpen?: boolean
  activeTab?: LayoutNavTab
  activeChannelFilter?: LayoutChannelFilter
  activeFilter?: ChatFilter
  searchQuery?: string
  internalNote?: string
  onTabChange?: (tab: LayoutNavTab) => void
  onChannelFilterChange?: (channel: LayoutChannelFilter) => void
  onPresenceChange?: (status: PresenceStatus) => void
  onSelectConversation?: (id: string) => void
  onFilterChange?: (filter: ChatFilter) => void
  onSearchChange?: (query: string) => void
  onNewChat?: () => void
  onToggleDrawer?: () => void
  onCloseDrawer?: () => void
  onSendMessage?: (msg: string) => void
  onAssignTicket?: () => void
  onResolveTicket?: () => void
  onSaveInternalNote?: (note: string) => void
  cannedResponses?: CannedItem[]
  slashCommands?: CommandItem[]
  messages?: TimelineMessage[]
  now?: Date
  onRetryMessage?: (message: TimelineMessage) => void
  onOpenSettings?: () => void
  onOpenTemplateDialog?: () => void
  children?: ReactNode
}

export function WhatsAppLayout({
  currentUser,
  conversations,
  selectedConversationId,
  isDrawerOpen = false,
  activeTab = 'inbox',
  activeChannelFilter = 'all',
  activeFilter = 'all',
  searchQuery = '',
  internalNote = '',
  cannedResponses,
  slashCommands,
  messages,
  now,
  onTabChange = () => {},
  onChannelFilterChange = () => {},
  onPresenceChange = () => {},
  onSelectConversation = () => {},
  onFilterChange = () => {},
  onSearchChange = () => {},
  onNewChat = () => {},
  onToggleDrawer = () => {},
  onCloseDrawer = () => {},
  onSendMessage = () => {},
  onAssignTicket = () => {},
  onResolveTicket = () => {},
  onSaveInternalNote = () => {},
  onRetryMessage,
  onOpenSettings,
  onOpenTemplateDialog,
  children,
}: WhatsAppLayoutProps) {
  const selectedConversation = conversations.find((c) => c.id === selectedConversationId) || null

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#efeae2] text-[#111b21] antialiased">
      {/* Kolom 1: NavRail */}
      <NavRail
        currentUser={currentUser}
        activeTab={activeTab}
        activeChannelFilter={activeChannelFilter}
        onTabChange={onTabChange}
        onChannelFilterChange={onChannelFilterChange}
        onPresenceChange={onPresenceChange}
        onOpenSettings={onOpenSettings}
      />

      {activeTab === 'reports' ? (
        <div className="flex-1 h-full overflow-y-auto">
          <AnalyticsDashboard />
        </div>
      ) : (
        <>
          {/* Kolom 2: ChatListPanel */}
          <ChatListPanel
            conversations={conversations}
            selectedConversationId={selectedConversationId}
            activeFilter={activeFilter}
            searchQuery={searchQuery}
            now={now}
            onSelectConversation={onSelectConversation}
            onFilterChange={onFilterChange}
            onSearchChange={onSearchChange}
            onNewChat={onNewChat}
          />

          {/* Kolom 3: ConversationThread */}
          <ConversationThread
            conversation={selectedConversation}
            isDrawerOpen={isDrawerOpen}
            messages={messages}
            cannedResponses={cannedResponses}
            slashCommands={slashCommands}
            now={now}
            onToggleDrawer={onToggleDrawer}
            onSendMessage={onSendMessage}
            onAssignTicket={onAssignTicket}
            onResolveTicket={onResolveTicket}
            onRetryMessage={onRetryMessage}
            onOpenTemplateDialog={onOpenTemplateDialog}
          >
            {children}
          </ConversationThread>

          {/* Kolom 3.5: ContactDrawer (Slide-Over CRM) */}
          <ContactDrawer
            isOpen={isDrawerOpen}
            conversation={selectedConversation}
            internalNote={internalNote}
            onClose={onCloseDrawer}
            onSaveInternalNote={onSaveInternalNote}
          />
        </>
      )}
    </div>
  )
}

export default WhatsAppLayout
