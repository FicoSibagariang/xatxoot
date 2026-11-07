import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  ChatFilter,
  ConversationItem,
  LayoutChannelFilter,
  LayoutNavTab,
} from '../components/layout/types'
import { api } from '../services/apiClient'

export interface FilterConversationOptions {
  activeChannelFilter?: LayoutChannelFilter | string
  searchQuery?: string
  activeFilter?: ChatFilter | string
  userId?: string
}

export function filterConversations(
  conversations: ConversationItem[],
  options: FilterConversationOptions = {},
): ConversationItem[] {
  const { activeChannelFilter = 'all', searchQuery = '', activeFilter = 'all', userId } = options
  const trimmedQuery = searchQuery.trim().toLowerCase()

  return conversations.filter((c) => {
    // Channel filter
    if (activeChannelFilter !== 'all' && c.channel !== activeChannelFilter) {
      return false
    }

    // Search query filter
    if (trimmedQuery !== '') {
      const contactNameStr = String(c.contactName || '').toLowerCase()
      const contactPhoneStr = String(c.contactPhone || '').toLowerCase()
      const lastMsgStr = String(c.lastMessage || '').toLowerCase()
      const ticketNumStr = String(c.ticket?.ticketNumber || c.ticket?.id || '').toLowerCase()

      const matchName = contactNameStr.includes(trimmedQuery)
      const matchPhone = contactPhoneStr.includes(trimmedQuery)
      const matchMsg = lastMsgStr.includes(trimmedQuery)
      const matchTicket = ticketNumStr.includes(trimmedQuery)

      if (!matchName && !matchPhone && !matchMsg && !matchTicket) {
        return false
      }
    }

    // Quick filter pills
    if (activeFilter === 'unread' && (c.unreadCount ?? 0) === 0) return false
    if (activeFilter === 'assigned_me') {
      return Boolean(c.ticket?.assignedTo && c.ticket.assignedTo === userId)
    }
    if (activeFilter === 'unassigned') {
      return Boolean(c.ticket && !c.ticket.assignedTo)
    }

    return true
  })
}

export interface UseConversationListOptions {
  userId?: string
  selectedConversationIdRef?: React.MutableRefObject<string | null>
  onFirstConversationLoaded?: (id: string) => void
}

export function useConversationList({
  userId,
  selectedConversationIdRef,
  onFirstConversationLoaded,
}: UseConversationListOptions = {}) {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [activeTab, setActiveTab] = useState<LayoutNavTab>('inbox')
  const [activeChannelFilter, setActiveChannelFilter] = useState<LayoutChannelFilter>('all')
  const [activeFilter, setActiveFilter] = useState<ChatFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchConversations = useCallback(async () => {
    try {
      // biome-ignore lint/suspicious/noExplicitAny: backend conversation item
      const data = await api.get<any[]>('/api/v1/conversations')
      if (Array.isArray(data)) {
        if (data.length > 0) {
          const currentSelected = selectedConversationIdRef?.current
          // biome-ignore lint/suspicious/noExplicitAny: mapping backend schema
          const mapped: ConversationItem[] = data.map((item: any) => {
            const isSelected = item.id === currentSelected
            const isGroup = Boolean(
              item.isGroup ||
                item.contact?.phoneNumber?.includes('@g.us') ||
                item.contact?.phoneNumber?.includes('120363') ||
                item.contact?.identifier?.includes('@g.us') ||
                item.contact?.identifier?.includes('120363'),
            )
            const groupJid = item.groupJid || item.contact?.phoneNumber || item.contact?.identifier

            return {
              id: item.id,
              contactName: isGroup
                ? item.contact?.name || 'Grup WhatsApp'
                : item.contact?.name || item.contact?.phoneNumber || 'Pelanggan WhatsApp',
              contactPhone: item.contact?.phoneNumber,
              // biome-ignore lint/suspicious/noExplicitAny: channel type
              channel: (item.channel as any) || (item.channelType as any) || 'whatsapp',
              inboxId: item.inboxId,
              inboxName: item.inboxName,
              isGroup: isGroup ? true : undefined,
              groupJid: isGroup ? groupJid : undefined,
              availableChannels: item.availableChannels,
              lastMessage:
                item.lastMessage ||
                (item.lastMessageAt ? 'Pesan baru diterima' : 'Percakapan baru'),
              lastMessageTimestamp: item.lastMessageAt
                ? new Date(item.lastMessageAt).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Baru saja',
              unreadCount: isSelected ? 0 : item.unreadCount || 0,
              ticket: item.activeTicket
                ? {
                    id: item.activeTicket.id,
                    ticketNumber: String(item.activeTicket.displayId ?? 'T-000'),
                    status: item.activeTicket.status || 'open',
                    priority: item.activeTicket.priority || 'medium',
                    assignedTo: item.activeTicket.assigneeId,
                  }
                : undefined,
            }
          })

          setConversations(mapped)
          if (mapped[0]?.id && onFirstConversationLoaded) {
            onFirstConversationLoaded(mapped[0].id)
          }
        } else {
          setConversations([])
        }
      }
    } catch (err) {
      console.error('Failed to load conversations from backend:', err)
    }
  }, [selectedConversationIdRef, onFirstConversationLoaded])

  // Periodic refresh
  useEffect(() => {
    fetchConversations()
    const timer = setInterval(() => {
      fetchConversations()
    }, 5000)
    return () => clearInterval(timer)
  }, [fetchConversations])

  const filteredConversations = useMemo(
    () =>
      filterConversations(conversations, {
        activeChannelFilter,
        searchQuery,
        activeFilter,
        userId,
      }),
    [conversations, activeChannelFilter, searchQuery, activeFilter, userId],
  )

  return {
    conversations,
    setConversations,
    activeTab,
    setActiveTab,
    activeChannelFilter,
    setActiveChannelFilter,
    activeFilter,
    setActiveFilter,
    searchQuery,
    setSearchQuery,
    fetchConversations,
    filteredConversations,
  }
}
