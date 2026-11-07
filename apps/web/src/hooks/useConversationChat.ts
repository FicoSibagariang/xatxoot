import type { MessageType, TimelineMessage } from '../components/chat'
import type { LayoutUser } from '../components/layout/types'
import { api } from '../services/apiClient'
import {
  areMessagesIdentical,
  mapRawConversationMessage,
  parseContentAttributes,
} from './conversationChatHelpers'
import type { MessageCreatedEvent, TicketUpdatedEvent } from './types'
import { useActiveConversation } from './useActiveConversation'
import {
  type FilterConversationOptions,
  filterConversations,
  useConversationList,
} from './useConversationList'
import {
  applyRealtimeMessage,
  applyRealtimeMessageEdit,
  applyRealtimeMessageRevoke,
  applyRealtimeMessageStatus,
  applyRealtimeTicket,
  useRealtimeStream,
} from './useRealtimeStream'
import { useTicketActions } from './useTicketActions'

export interface UseConversationChatOptions {
  user: LayoutUser
  initialConversationId?: string | null
}

export {
  areMessagesIdentical,
  mapRawConversationMessage,
  parseContentAttributes,
  filterConversations,
}
export type { FilterConversationOptions }

export function useConversationChat({ user, initialConversationId }: UseConversationChatOptions) {
  const list = useConversationList({ userId: user.id })

  const active = useActiveConversation({
    user,
    initialConversationId,
    setConversations: list.setConversations,
    onRefreshConversations: list.fetchConversations,
  })

  const ticket = useTicketActions({
    user,
    conversations: list.conversations,
    setConversations: list.setConversations,
    selectedConversationId: active.selectedConversationId,
    onRefreshConversations: list.fetchConversations,
  })

  const realtime = useRealtimeStream({
    token: api.getToken() || 'valid-access-token',
    onMessageCreated: (rawEvent) => {
      // biome-ignore lint/suspicious/noExplicitAny: event normalization
      const anyEvt = rawEvent as any
      const rawMsg = anyEvt.message || anyEvt
      const convId = anyEvt.conversation?.id || anyEvt.conversationId || rawMsg.conversationId

      const isCustomer =
        rawMsg.senderType === 'contact' ||
        rawMsg.senderType === 'customer' ||
        anyEvt.senderType === 'contact' ||
        anyEvt.contact !== undefined ||
        rawMsg.messageType === 'incoming'

      const msgType: MessageType =
        rawMsg.messageType === 'activity' || rawMsg.senderType === 'system'
          ? 'activity'
          : isCustomer
            ? 'incoming'
            : 'outgoing'

      const rawTime = rawMsg.createdAt || anyEvt.timestamp || anyEvt.createdAt
      const timeStr =
        rawTime?.includes('T') && rawTime.includes('Z')
          ? new Date(rawTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
          : rawTime || 'Baru saja'

      const attrs = parseContentAttributes(anyEvt.contentAttributes || rawMsg.contentAttributes)
      const isEcho = Boolean(
        anyEvt.isEcho || rawMsg.isEcho || attrs.echo || attrs.source === 'whatsapp_mobile',
      )
      const isMsgGroup = Boolean(anyEvt.isGroup || rawMsg.isGroup || attrs.isGroup)
      const participant = anyEvt.participant || rawMsg.participant || attrs.participant
      const participantName =
        anyEvt.participantName || rawMsg.participantName || attrs.participantName

      const senderName = isCustomer
        ? isMsgGroup && participantName
          ? participantName
          : anyEvt.contact?.name || 'Pelanggan WhatsApp'
        : anyEvt.senderName ||
          rawMsg.senderName ||
          attrs.senderName ||
          (isEcho ? 'WhatsApp HP' : rawMsg.senderType === 'bot' ? 'Bot Otomasi' : user.name)

      const event: MessageCreatedEvent = {
        id: rawMsg.id || anyEvt.id,
        conversationId: convId,
        ticketId: rawMsg.ticketId || anyEvt.ticket?.id,
        ticketDisplayId:
          rawMsg.ticketDisplayId || anyEvt.ticket?.displayId || anyEvt.ticket?.ticketNumber,
        content: rawMsg.content || anyEvt.content || '',
        messageType: msgType,
        contentType:
          rawMsg.contentType ||
          anyEvt.contentType ||
          (rawMsg.messageType === 'image' || anyEvt.messageType === 'image' ? 'image' : 'text'),
        mediaUrl:
          rawMsg.mediaUrl ||
          anyEvt.mediaUrl ||
          attrs.mediaUrl ||
          (Array.isArray(rawMsg.attachments) && rawMsg.attachments[0]?.fileUrl) ||
          undefined,
        senderId: rawMsg.senderId || anyEvt.contact?.id || anyEvt.senderId,
        senderType: isCustomer ? 'contact' : rawMsg.senderType || anyEvt.senderType || 'user',
        senderName,
        isGroup: isMsgGroup,
        participant: participant ? String(participant) : undefined,
        participantName: participantName ? String(participantName) : undefined,
        isEcho,
        replyTo: rawMsg.replyTo || anyEvt.replyTo || attrs.replyTo || null,
        contentAttributes: rawMsg.contentAttributes || anyEvt.contentAttributes,
        timestamp: timeStr,
        status: rawMsg.status || (isCustomer ? 'delivered' : 'sent'),
      }

      active.setMessagesMap((prev) => applyRealtimeMessage(prev, event))
      list.fetchConversations()

      if (active.selectedIdRef.current && active.selectedIdRef.current === convId) {
        active.fetchMessages(convId)
      }
    },
    onMessageStatusUpdated: (event) => {
      active.setMessagesMap((prev) => applyRealtimeMessageStatus(prev, event))
    },
    onMessageEdited: (event) => {
      active.setMessagesMap((prev) => applyRealtimeMessageEdit(prev, event))
      list.setConversations((prev) =>
        prev.map((c) => (c.id === event.conversationId ? { ...c, lastMessage: event.content } : c)),
      )
    },
    onMessageRevoked: (event) => {
      active.setMessagesMap((prev) => applyRealtimeMessageRevoke(prev, event))
      list.setConversations((prev) =>
        prev.map((c) =>
          c.id === event.conversationId ? { ...c, lastMessage: '🚫 Pesan telah ditarik' } : c,
        ),
      )
    },
    onTicketUpdated: (rawEvt) => {
      // biome-ignore lint/suspicious/noExplicitAny: event normalization
      const anyEvt = rawEvt as any
      const t = anyEvt?.ticket || anyEvt
      if (!t) return
      const event: TicketUpdatedEvent = {
        id: t.id,
        ticketNumber: String(t.ticketNumber ?? t.displayId ?? ''),
        status: t.status,
        priority: t.priority,
        assignedTo: t.assignedTo ?? t.assigneeId ?? null,
        internalNote: t.internalNote ?? null,
        updatedAt: t.updatedAt,
      }
      list.setConversations((prev) => applyRealtimeTicket(prev, event))
      if (
        active.selectedConversationId &&
        event.internalNote !== undefined &&
        event.internalNote !== null
      ) {
        ticket.setInternalNote(event.internalNote)
      }
    },
  })

  const selectedConversation = list.conversations.find(
    (c) => c.id === active.selectedConversationId,
  )

  return {
    conversations: list.conversations,
    setConversations: list.setConversations,
    messagesMap: active.messagesMap,
    setMessagesMap: active.setMessagesMap,
    selectedConversationId: active.selectedConversationId,
    setSelectedConversationId: active.setSelectedConversationId,
    replyingToMessage: active.replyingToMessage,
    setReplyingToMessage: active.setReplyingToMessage,
    cancelReply: active.cancelReply,
    isDrawerOpen: ticket.isDrawerOpen,
    setIsDrawerOpen: ticket.setIsDrawerOpen,
    activeTab: list.activeTab,
    setActiveTab: list.setActiveTab,
    activeChannelFilter: list.activeChannelFilter,
    setActiveChannelFilter: list.setActiveChannelFilter,
    activeFilter: list.activeFilter,
    setActiveFilter: list.setActiveFilter,
    searchQuery: list.searchQuery,
    setSearchQuery: list.setSearchQuery,
    internalNote: ticket.internalNote,
    setInternalNote: ticket.setInternalNote,
    filteredConversations: list.filteredConversations,
    selectedConversation,
    currentMessages: active.currentMessages,
    fetchConversations: list.fetchConversations,
    handleSendMessage: active.handleSendMessage,
    handleResolveTicket: ticket.handleResolveTicket,
    handleAssignTicket: ticket.handleAssignTicket,
    handleSaveInternalNote: ticket.handleSaveInternalNote,
    handleSelectConversation: active.handleSelectConversation,
    forwardingMessage: active.forwardingMessage,
    setForwardingMessage: active.setForwardingMessage,
    isForwarding: active.isForwarding,
    handleForwardMessage: active.handleForwardMessage,
    handleConfirmForward: active.handleConfirmForward,
    realtime,
    paginationMap: active.paginationMap,
    hasMore: active.hasMore,
    isLoadingMore: active.isLoadingMore,
    loadMoreMessages: active.loadMoreMessages,
  }
}
