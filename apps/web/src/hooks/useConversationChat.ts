import { useCallback, useEffect, useRef, useState } from 'react'
import type { ContentType, MessageType, TimelineMessage } from '../components/chat'
import type {
  ChatFilter,
  ConversationItem,
  LayoutChannelFilter,
  LayoutNavTab,
  LayoutUser,
} from '../components/layout/types'
import type { MessageCreatedEvent, TicketUpdatedEvent } from './types'
import {
  applyRealtimeMessage,
  applyRealtimeMessageStatus,
  applyRealtimeTicket,
  useRealtimeStream,
} from './useRealtimeStream'

export interface UseConversationChatOptions {
  user: LayoutUser
}

export function useConversationChat({ user }: UseConversationChatOptions) {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [messagesMap, setMessagesMap] = useState<Record<string, TimelineMessage[]>>({})
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  selectedIdRef.current = selectedConversationId

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<LayoutNavTab>('inbox')
  const [activeChannelFilter, setActiveChannelFilter] = useState<LayoutChannelFilter>('all')
  const [activeFilter, setActiveFilter] = useState<ChatFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [internalNote, setInternalNote] = useState('')

  // Initial load: Fetch conversations from backend API
  const fetchConversations = useCallback(async () => {
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('auth_token') || 'valid-access-token'
          : 'valid-access-token'
      const res = await fetch('/api/v1/conversations', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        // biome-ignore lint/suspicious/noExplicitAny: backend conversation item
        const data = (await res.json()) as any[]
        if (Array.isArray(data)) {
          if (data.length > 0) {
            const currentSelected = selectedIdRef.current
            // biome-ignore lint/suspicious/noExplicitAny: mapping backend schema
            const mapped: ConversationItem[] = data.map((item: any) => {
              const isSelected = item.id === currentSelected
              return {
                id: item.id,
                contactName:
                  item.contact?.name || item.contact?.phoneNumber || 'Pelanggan WhatsApp',
                contactPhone: item.contact?.phoneNumber,
                // biome-ignore lint/suspicious/noExplicitAny: channel type
                channel: (item.channelType as any) || 'whatsapp',
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
                      ticketNumber: item.activeTicket.displayId || 'T-000',
                      status: item.activeTicket.status || 'open',
                      priority: item.activeTicket.priority || 'medium',
                      assignedTo: item.activeTicket.assigneeId,
                    }
                  : undefined,
              }
            })

            setConversations(mapped)
            setSelectedConversationId((prev) =>
              prev && mapped.some((m) => m.id === prev) ? prev : mapped[0].id,
            )
          } else {
            setConversations([])
            setSelectedConversationId(null)
          }
        }
      }
    } catch (err) {
      console.error('Failed to load conversations from backend:', err)
    }
  }, [])

  useEffect(() => {
    fetchConversations()
    const timer = setInterval(() => {
      fetchConversations()
    }, 2500)
    return () => clearInterval(timer)
  }, [fetchConversations])

  // Fetch messages when conversation is selected
  useEffect(() => {
    if (!selectedConversationId) return
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedConversationId ? { ...c, unreadCount: 0 } : c)),
    )
    const fetchMessages = async () => {
      try {
        const token =
          typeof window !== 'undefined'
            ? localStorage.getItem('auth_token') || 'valid-access-token'
            : 'valid-access-token'
        const res = await fetch(`/api/v1/conversations/${selectedConversationId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          // biome-ignore lint/suspicious/noExplicitAny: backend conversation detail
          const data = (await res.json()) as any
          if (data.messages && Array.isArray(data.messages)) {
            // biome-ignore lint/suspicious/noExplicitAny: message mapping
            const mappedMsgs: TimelineMessage[] = data.messages.map((m: any) => {
              const isCustomer = m.senderType === 'contact' || m.senderType === 'customer'
              const msgType: MessageType =
                m.messageType === 'activity' || m.senderType === 'system'
                  ? 'activity'
                  : isCustomer
                    ? 'incoming'
                    : 'outgoing'

              return {
                id: m.id,
                conversationId: m.conversationId,
                ticketId: m.ticketId,
                ticketDisplayId: m.ticketDisplayId,
                senderId: m.senderId || (isCustomer ? 'customer' : user.id),
                senderType: isCustomer ? 'contact' : 'user',
                senderName: isCustomer
                  ? data.contact?.name || data.contact?.phoneNumber || 'Pelanggan'
                  : user.name,
                messageType: msgType,
                contentType: (m.contentType as ContentType) || 'text',
                content: m.content || '',
                timestamp: m.createdAt
                  ? new Date(m.createdAt).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Baru saja',
                dateGroup: 'HARI INI',
                status: m.status || (isCustomer ? 'delivered' : 'read'),
              }
            })
            setMessagesMap((prev) => ({
              ...prev,
              [selectedConversationId]: mappedMsgs,
            }))
          }
        }
      } catch {
        // preserve memory messages on error
      }
    }
    fetchMessages()
    const timer = setInterval(fetchMessages, 2000)
    return () => clearInterval(timer)
  }, [selectedConversationId, user.name, user.id])

  // Real-time SSE updates without page refresh
  const sseToken =
    typeof window !== 'undefined'
      ? localStorage.getItem('auth_token') || 'valid-access-token'
      : 'valid-access-token'

  useRealtimeStream({
    token: sseToken,
    onMessageCreated: (rawEvent) => {
      // biome-ignore lint/suspicious/noExplicitAny: event normalization
      const anyEvt = rawEvent as any
      const event: MessageCreatedEvent = {
        id: anyEvt.message?.id || anyEvt.id,
        conversationId:
          anyEvt.conversation?.id || anyEvt.conversationId || anyEvt.message?.conversationId,
        content: anyEvt.message?.content || anyEvt.content || '',
        messageType: anyEvt.message?.messageType || anyEvt.messageType || 'incoming',
        contentType: anyEvt.message?.contentType || anyEvt.contentType || 'text',
        senderId: anyEvt.message?.senderId || anyEvt.contact?.id || anyEvt.senderId,
        senderType:
          anyEvt.message?.senderType ||
          anyEvt.senderType ||
          (anyEvt.message?.messageType === 'activity' || anyEvt.messageType === 'activity'
            ? 'system'
            : 'contact'),
        senderName: anyEvt.contact?.name || anyEvt.senderName || 'Pelanggan WhatsApp',
        timestamp: anyEvt.message?.createdAt || anyEvt.timestamp,
      }

      setMessagesMap((prev) => applyRealtimeMessage(prev, event))
      fetchConversations()
    },
    onMessageStatusUpdated: (event) => {
      setMessagesMap((prev) => applyRealtimeMessageStatus(prev, event))
    },
    onTicketUpdated: (rawEvt) => {
      // biome-ignore lint/suspicious/noExplicitAny: event normalization
      const anyEvt = rawEvt as any
      const t = anyEvt?.ticket || anyEvt
      if (!t) return
      const event: TicketUpdatedEvent = {
        id: t.id,
        ticketNumber: t.ticketNumber || t.displayId || '',
        status: t.status,
        priority: t.priority,
        assignedTo: t.assignedTo ?? t.assigneeId ?? null,
        internalNote: t.internalNote ?? null,
        updatedAt: t.updatedAt,
      }
      setConversations((prev) => applyRealtimeTicket(prev, event))
      if (
        selectedConversationId &&
        event.internalNote !== undefined &&
        event.internalNote !== null
      ) {
        setInternalNote(event.internalNote)
      }
    },
  })

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    // Channel filter
    if (activeChannelFilter !== 'all' && c.channel !== activeChannelFilter) {
      return false
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchName = c.contactName.toLowerCase().includes(q)
      const matchPhone = c.contactPhone?.toLowerCase().includes(q)
      const matchMsg = c.lastMessage?.toLowerCase().includes(q)
      if (!matchName && !matchPhone && !matchMsg) return false
    }

    // Status / Assignment filter
    if (activeFilter === 'unread' && (!c.unreadCount || c.unreadCount === 0)) {
      return false
    }
    if (activeFilter === 'assigned_me' && c.ticket?.assignedTo !== user.id) {
      return false
    }
    if (activeFilter === 'unassigned' && Boolean(c.ticket?.assignedTo)) {
      return false
    }

    return true
  })

  const currentMessages = selectedConversationId ? messagesMap[selectedConversationId] || [] : []

  const handleSendMessage = async (text: string) => {
    if (!selectedConversationId || !text.trim()) return

    const tempId = `msg-${Date.now()}`
    const now = new Date()
    const timeStr = now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    })

    const newMsg: TimelineMessage = {
      id: tempId,
      conversationId: selectedConversationId,
      senderId: user.id,
      senderType: 'user',
      senderName: user.name,
      messageType: 'outgoing',
      contentType: 'text',
      content: text.trim(),
      timestamp: timeStr,
      dateGroup: 'HARI INI',
      status: 'pending',
    }

    setMessagesMap((prev) => ({
      ...prev,
      [selectedConversationId]: [...(prev[selectedConversationId] || []), newMsg],
    }))

    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversationId
          ? {
              ...c,
              lastMessage: text.trim(),
              lastMessageTimestamp: timeStr,
              unreadCount: 0,
            }
          : c,
      ),
    )

    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('auth_token') || 'valid-access-token'
          : 'valid-access-token'

      const res = await fetch(`/api/v1/conversations/${selectedConversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: text.trim(),
          contentType: 'text',
        }),
      })

      if (res.ok) {
        // biome-ignore lint/suspicious/noExplicitAny: backend message response
        const data = (await res.json()) as any
        const m = data?.message
        if (m) {
          const sentMsg: TimelineMessage = {
            id: m.id || tempId,
            conversationId: selectedConversationId,
            senderId: m.senderId || user.id,
            senderType: 'user',
            senderName: user.name,
            messageType: 'outgoing',
            contentType: (m.contentType as ContentType) || 'text',
            content: m.content || text.trim(),
            timestamp: m.createdAt
              ? new Date(m.createdAt).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : timeStr,
            dateGroup: 'HARI INI',
            status: m.status || 'sent',
          }

          setMessagesMap((prev) => ({
            ...prev,
            [selectedConversationId]: (prev[selectedConversationId] || []).map((msg) =>
              msg.id === tempId ? sentMsg : msg,
            ),
          }))
        }
      } else {
        setMessagesMap((prev) => ({
          ...prev,
          [selectedConversationId]: (prev[selectedConversationId] || []).map((msg) =>
            msg.id === tempId ? { ...msg, status: 'failed' } : msg,
          ),
        }))
      }
    } catch (err) {
      console.error('Failed to send message:', err)
      setMessagesMap((prev) => ({
        ...prev,
        [selectedConversationId]: (prev[selectedConversationId] || []).map((msg) =>
          msg.id === tempId ? { ...msg, status: 'failed' } : msg,
        ),
      }))
    }
  }

  const handleResolveTicket = async () => {
    if (!selectedConversationId) return
    const currentConv = conversations.find((c) => c.id === selectedConversationId)
    const activeTicket = currentConv?.ticket
    if (!activeTicket?.id) return

    const nextStatus = activeTicket.status === 'resolved' ? 'open' : 'resolved'

    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversationId && c.ticket
          ? {
              ...c,
              ticket: {
                ...c.ticket,
                status: nextStatus,
              },
            }
          : c,
      ),
    )

    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('auth_token') || 'valid-access-token'
          : 'valid-access-token'
      const res = await fetch(`/api/v1/tickets/${activeTicket.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) {
        fetchConversations()
      }
    } catch {
      fetchConversations()
    }
  }

  const handleAssignTicket = async () => {
    if (!selectedConversationId) return
    const currentConv = conversations.find((c) => c.id === selectedConversationId)
    const activeTicket = currentConv?.ticket
    if (!activeTicket?.id) return

    const isAssignedToMe = activeTicket.assignedTo === user.id
    const nextAssigneeId = isAssignedToMe ? null : user.id

    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversationId && c.ticket
          ? {
              ...c,
              ticket: {
                ...c.ticket,
                assignedTo: nextAssigneeId || undefined,
              },
            }
          : c,
      ),
    )

    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('auth_token') || 'valid-access-token'
          : 'valid-access-token'
      const res = await fetch(`/api/v1/tickets/${activeTicket.id}/assignee`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ assigneeId: nextAssigneeId }),
      })
      if (!res.ok) {
        fetchConversations()
      }
    } catch {
      fetchConversations()
    }
  }

  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id)
    selectedIdRef.current = id
    // Clear unread in local state
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)))

    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('auth_token') || 'valid-access-token'
          : 'valid-access-token'
      fetch(`/api/v1/conversations/${id}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {})
    } catch {
      // Ignore
    }
  }

  return {
    conversations,
    filteredConversations,
    currentMessages,
    selectedConversationId,
    setSelectedConversationId,
    isDrawerOpen,
    setIsDrawerOpen,
    activeTab,
    setActiveTab,
    activeChannelFilter,
    setActiveChannelFilter,
    activeFilter,
    setActiveFilter,
    searchQuery,
    setSearchQuery,
    internalNote,
    setInternalNote,
    setMessagesMap,
    handleSendMessage,
    handleResolveTicket,
    handleAssignTicket,
    handleSelectConversation,
  }
}
