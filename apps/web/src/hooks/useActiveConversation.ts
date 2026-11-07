import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ContentType, TimelineMessage } from '../components/chat'
import type { ConversationItem, LayoutUser } from '../components/layout/types'
import { api } from '../services/apiClient'
import { areMessagesIdentical, mapRawConversationMessage } from './conversationChatHelpers'

export interface UseActiveConversationOptions {
  user: LayoutUser
  initialConversationId?: string | null
  setConversations: React.Dispatch<React.SetStateAction<ConversationItem[]>>
  onInternalNoteLoaded?: (note: string) => void
  onRefreshConversations?: () => void
}

export function useActiveConversation({
  user,
  initialConversationId,
  setConversations,
  onInternalNoteLoaded,
  onRefreshConversations,
}: UseActiveConversationOptions) {
  const [messagesMap, setMessagesMap] = useState<Record<string, TimelineMessage[]>>({})
  const [paginationMap, setPaginationMap] = useState<
    Record<string, { hasMore: boolean; nextCursor?: string }>
  >({})
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    initialConversationId || null,
  )
  const selectedIdRef = useRef<string | null>(null)
  selectedIdRef.current = selectedConversationId

  const [replyingToMessage, setReplyingToMessage] = useState<TimelineMessage | null>(null)
  const [forwardingMessage, setForwardingMessage] = useState<TimelineMessage | null>(null)
  const [isForwarding, setIsForwarding] = useState(false)

  const fetchMessages = useCallback(
    async (convId?: string) => {
      const targetId = convId || selectedIdRef.current || selectedConversationId
      if (!targetId) return
      try {
        // biome-ignore lint/suspicious/noExplicitAny: backend conversation detail
        const data = await api.get<any>(`/api/v1/conversations/${targetId}?limit=50`)

        if (data?.contact || data?.activeTicket) {
          setConversations((prev) => {
            const exists = prev.some((c) => c.id === targetId)
            if (exists) {
              return prev.map((c) => {
                if (c.id !== targetId) return c
                return {
                  ...c,
                  contactName: data.contact?.name || data.contact?.phoneNumber || c.contactName,
                  contactPhone: data.contact?.phoneNumber || c.contactPhone,
                  ticket: data.activeTicket
                    ? {
                        id: data.activeTicket.id,
                        ticketNumber: String(data.activeTicket.displayId ?? 'T-000'),
                        status: data.activeTicket.status || 'open',
                        priority: data.activeTicket.priority || 'medium',
                        assignedTo: data.activeTicket.assigneeId,
                      }
                    : c.ticket,
                }
              })
            }
            const newConv: ConversationItem = {
              id: targetId,
              contactName: data.contact?.name || data.contact?.phoneNumber || 'Pelanggan WhatsApp',
              contactPhone: data.contact?.phoneNumber,
              // biome-ignore lint/suspicious/noExplicitAny: channel type
              channel: (data.conversation?.channelType as any) || 'whatsapp',
              lastMessage: data.messages?.[data.messages.length - 1]?.content || 'Percakapan baru',
              lastMessageTimestamp: 'Baru saja',
              unreadCount: 0,
              ticket: data.activeTicket
                ? {
                    id: data.activeTicket.id,
                    ticketNumber: String(data.activeTicket.displayId ?? 'T-000'),
                    status: data.activeTicket.status || 'open',
                    priority: data.activeTicket.priority || 'medium',
                    assignedTo: data.activeTicket.assigneeId,
                  }
                : undefined,
            }
            return [newConv, ...prev]
          })
        }

        if (data?.activeTicket?.internalNote && onInternalNoteLoaded) {
          onInternalNoteLoaded(data.activeTicket.internalNote)
        }

        if (data?.pagination) {
          setPaginationMap((prev) => ({
            ...prev,
            [targetId]: {
              hasMore: Boolean(data.pagination.hasMore),
              nextCursor: data.pagination.nextCursor,
            },
          }))
        }

        if (data?.messages && Array.isArray(data.messages)) {
          // biome-ignore lint/suspicious/noExplicitAny: message mapping
          const mappedMsgs: TimelineMessage[] = data.messages.map((m: any) =>
            mapRawConversationMessage(m, data, user),
          )
          setMessagesMap((prev) => {
            if (areMessagesIdentical(prev[targetId], mappedMsgs)) {
              return prev
            }
            return {
              ...prev,
              [targetId]: mappedMsgs,
            }
          })
        }
      } catch {
        // preserve memory messages on error
      }
    },
    [selectedConversationId, user, setConversations, onInternalNoteLoaded],
  )

  const loadMoreMessages = useCallback(async () => {
    const targetId = selectedIdRef.current || selectedConversationId
    if (!targetId || isLoadingMore) return
    const pagination = paginationMap[targetId]
    if (!pagination?.hasMore || !pagination.nextCursor) return

    setIsLoadingMore(true)
    try {
      // biome-ignore lint/suspicious/noExplicitAny: backend conversation detail
      const data = await api.get<any>(
        `/api/v1/conversations/${targetId}?limit=50&before=${encodeURIComponent(pagination.nextCursor)}`,
      )
      if (data?.messages && Array.isArray(data.messages)) {
        // biome-ignore lint/suspicious/noExplicitAny: message mapping
        const olderMsgs: TimelineMessage[] = data.messages.map((m: any) =>
          mapRawConversationMessage(m, data, user),
        )

        setMessagesMap((prev) => {
          const current = prev[targetId] || []
          const existingIds = new Set(current.map((m) => m.id))
          const newUnique = olderMsgs.filter((m) => !existingIds.has(m.id))
          return {
            ...prev,
            [targetId]: [...newUnique, ...current],
          }
        })
      }

      if (data?.pagination) {
        setPaginationMap((prev) => ({
          ...prev,
          [targetId]: {
            hasMore: Boolean(data.pagination.hasMore),
            nextCursor: data.pagination.nextCursor,
          },
        }))
      }
    } catch (err) {
      console.error('Failed to load more messages:', err)
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, paginationMap, selectedConversationId, user])

  useEffect(() => {
    if (!selectedConversationId) return
    fetchMessages(selectedConversationId)
    const timer = setInterval(() => {
      fetchMessages(selectedConversationId)
    }, 3000)
    return () => clearInterval(timer)
  }, [selectedConversationId, fetchMessages])

  const handleSendMessage = async (text: string, replyToMessageId?: string | null) => {
    if (!text.trim() || !selectedConversationId) return
    const resolvedReplyToId = replyToMessageId ?? replyingToMessage?.id ?? null
    const targetReplyingMsg = replyingToMessage

    const now = new Date()
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    const tempId = `temp-${Date.now()}`

    const optimisticMsg: TimelineMessage = {
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
      status: 'sending',
      replyTo: targetReplyingMsg
        ? {
            messageId: targetReplyingMsg.id,
            senderName: targetReplyingMsg.senderName || 'Pelanggan',
            snippet: targetReplyingMsg.content.slice(0, 100),
          }
        : null,
    }

    setReplyingToMessage(null)
    setMessagesMap((prev) => ({
      ...prev,
      [selectedConversationId]: [...(prev[selectedConversationId] || []), optimisticMsg],
    }))

    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversationId
          ? { ...c, lastMessage: text.trim(), lastMessageTimestamp: timeStr, unreadCount: 0 }
          : c,
      ),
    )

    try {
      // biome-ignore lint/suspicious/noExplicitAny: backend message response
      const data = await api.post<any>(`/api/v1/conversations/${selectedConversationId}/messages`, {
        content: text.trim(),
        contentType: 'text',
        ...(resolvedReplyToId ? { replyToMessageId: resolvedReplyToId } : {}),
      })

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
          replyTo: m.replyTo || m.contentAttributes?.replyTo || optimisticMsg.replyTo,
        }
        setMessagesMap((prev) => ({
          ...prev,
          [selectedConversationId]: (prev[selectedConversationId] || []).map((msg) =>
            msg.id === tempId ? sentMsg : msg,
          ),
        }))
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

  const handleSelectConversation = useCallback(
    (id: string | null) => {
      setSelectedConversationId(id)
      selectedIdRef.current = id
      setReplyingToMessage(null)
      if (!id) return
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)))
      api.post(`/api/v1/conversations/${id}/read`).catch(() => {})
      fetchMessages(id)
    },
    [fetchMessages, setConversations],
  )

  const handleForwardMessage = useCallback((msg: TimelineMessage) => {
    setForwardingMessage(msg)
  }, [])

  const handleConfirmForward = useCallback(
    async (target: {
      targetConversationId?: string
      targetJid?: string
      targetPhone?: string
    }) => {
      if (!forwardingMessage) return
      setIsForwarding(true)
      try {
        await api.post('/api/v1/messages/forward', {
          sourceMessageId: forwardingMessage.id,
          targetConversationId: target.targetConversationId,
          targetJid: target.targetJid,
          targetPhone: target.targetPhone,
        })
        setForwardingMessage(null)
        if (onRefreshConversations) onRefreshConversations()
        if (target.targetConversationId) {
          fetchMessages(target.targetConversationId)
        }
      } catch (err) {
        console.error('Failed to forward message:', err)
        throw err
      } finally {
        setIsForwarding(false)
      }
    },
    [forwardingMessage, onRefreshConversations, fetchMessages],
  )

  const currentMessages = useMemo(
    () => (selectedConversationId ? messagesMap[selectedConversationId] || [] : []),
    [messagesMap, selectedConversationId],
  )

  return {
    selectedConversationId,
    setSelectedConversationId,
    selectedIdRef,
    messagesMap,
    setMessagesMap,
    paginationMap,
    setPaginationMap,
    isLoadingMore,
    hasMore: Boolean(
      selectedConversationId ? paginationMap[selectedConversationId]?.hasMore : false,
    ),
    replyingToMessage,
    setReplyingToMessage,
    cancelReply: () => setReplyingToMessage(null),
    forwardingMessage,
    setForwardingMessage,
    isForwarding,
    currentMessages,
    fetchMessages,
    loadMoreMessages,
    handleSendMessage,
    handleSelectConversation,
    handleForwardMessage,
    handleConfirmForward,
  }
}
