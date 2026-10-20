import { Search, SquarePen } from 'lucide-react'
import { Avatar, Badge, Button, Input } from '../astryx'
import { DeadlineTimerBadge, TicketSlaBadge } from '../chat'
import type { ChatFilter, ConversationItem, LayoutChannelFilter } from './types'

// ==========================================
// Kolom 2: ChatListPanel (360px - 400px Bounded)
// ==========================================
export interface ChatListPanelProps {
  conversations: ConversationItem[]
  selectedConversationId?: string | null
  activeFilter: ChatFilter
  searchQuery: string
  activeChannelFilter?: LayoutChannelFilter
  now?: Date
  onSelectConversation: (id: string) => void
  onFilterChange: (filter: ChatFilter) => void
  onSearchChange: (query: string) => void
  onNewChat: () => void
  onResetChannelFilter?: () => void
}

export function formatTicketStatus(status?: string): string {
  if (!status) return ''
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function ChatListPanel({
  conversations,
  selectedConversationId,
  activeFilter,
  searchQuery,
  activeChannelFilter,
  now,
  onSelectConversation,
  onFilterChange,
  onSearchChange,
  onNewChat,
  onResetChannelFilter,
}: ChatListPanelProps) {
  return (
    <section
      data-testid="chat-list-panel"
      className="w-[360px] md:w-[380px] h-full bg-white border-r border-wa-border flex flex-col shrink-0 select-none overflow-hidden"
    >
      {/* Header Bar (#f0f2f5) */}
      <div
        data-testid="chat-list-header"
        className="h-16 bg-wa-header-bg px-4 flex items-center justify-between border-b border-wa-border shrink-0"
      >
        <h2 className="text-xl font-bold text-wa-text-primary">Chat</h2>
        <div className="flex items-center gap-2">
          <Button variant="icon" size="icon" onClick={onNewChat} title="Chat Baru / Broadcast">
            <SquarePen className="w-5 h-5 text-slate-600" />
          </Button>
        </div>
      </div>

      {/* Search Bar Pill */}
      <div className="p-2.5 bg-white border-b border-wa-header-bg shrink-0">
        <Input
          data-testid="chat-search-input"
          placeholder="Cari atau mulai chat baru (/)"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          icon={<Search className="w-4 h-4 text-slate-400" />}
          shortcutHint="/"
        />
      </div>

      {/* Quick Filter Pills */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-white overflow-x-auto border-b border-wa-header-bg shrink-0 scrollbar-none">
        <button
          type="button"
          data-testid="filter-pill-all"
          data-active={activeFilter === 'all'}
          onClick={() => onFilterChange('all')}
          className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors whitespace-nowrap cursor-pointer ${
            activeFilter === 'all'
              ? 'bg-wa-bubble-light text-wa-teal-dark'
              : 'bg-wa-header-bg text-wa-text-muted hover:bg-wa-border'
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
              ? 'bg-wa-bubble-light text-wa-teal-dark'
              : 'bg-wa-header-bg text-wa-text-muted hover:bg-wa-border'
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
              ? 'bg-wa-bubble-light text-wa-teal-dark'
              : 'bg-wa-header-bg text-wa-text-muted hover:bg-wa-border'
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
              ? 'bg-wa-bubble-light text-wa-teal-dark'
              : 'bg-wa-header-bg text-wa-text-muted hover:bg-wa-border'
          }`}
        >
          Belum Ditugaskan
        </button>
      </div>

      {/* Conversation List Scroll Area */}
      <div className="flex-1 overflow-y-auto divide-y divide-wa-header-bg">
        {conversations.length === 0 ? (
          <div className="p-8 text-center text-wa-text-secondary text-sm flex flex-col items-center gap-2">
            <div>
              {activeChannelFilter && activeChannelFilter !== 'all'
                ? 'Tidak ada percakapan untuk filter saluran ini.'
                : 'Tidak ada percakapan ditemukan.'}
            </div>
            {activeChannelFilter && activeChannelFilter !== 'all' && onResetChannelFilter && (
              <button
                type="button"
                data-testid="empty-channel-filter-reset"
                onClick={onResetChannelFilter}
                className="text-xs text-wa-teal-primary font-semibold hover:underline cursor-pointer"
              >
                Tampilkan Semua Saluran
              </button>
            )}
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
                  isSelected ? 'bg-wa-header-bg' : 'hover:bg-wa-search-bg'
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
                    <span className="font-semibold text-sm text-wa-text-primary truncate">
                      {conv.contactName}
                    </span>
                    {conv.lastMessageTimestamp && (
                      <span className="text-[11px] text-wa-text-secondary shrink-0 ml-2">
                        {conv.lastMessageTimestamp}
                      </span>
                    )}
                  </div>

                  {/* Ticket Badge & Last Message */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 truncate">
                      {conv.ticket && (
                        <>
                          <span className="text-[11px] font-semibold text-wa-teal-dark shrink-0">
                            #{conv.ticket.ticketNumber} [{formatTicketStatus(conv.ticket.status)}]
                          </span>
                          {conv.ticket.slaStatus ? (
                            <TicketSlaBadge
                              firstResponseDeadline={conv.ticket.slaStatus.firstResponseDeadline}
                              resolutionDeadline={conv.ticket.slaStatus.resolutionDeadline}
                              isBreached={conv.ticket.slaStatus.isBreached}
                              breachedAt={conv.ticket.slaStatus.breachedAt}
                              policyName={conv.ticket.slaStatus.policyName}
                              ticketStatus={conv.ticket.status}
                              now={now}
                            />
                          ) : (
                            <DeadlineTimerBadge
                              deadlineAt={conv.ticket.deadlineAt}
                              status={conv.ticket.status}
                              now={now}
                            />
                          )}
                        </>
                      )}
                      {conv.inboxName && (
                        <span
                          data-testid="inbox-name-pill"
                          className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0"
                        >
                          {conv.inboxName}
                        </span>
                      )}
                      <p
                        className={`text-xs truncate ${
                          conv.lastMessage?.includes('Pesan telah ditarik')
                            ? 'italic text-slate-400'
                            : 'text-wa-text-secondary'
                        }`}
                      >
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

export default ChatListPanel
