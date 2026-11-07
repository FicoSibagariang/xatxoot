import { useCallback, useState } from 'react'
import type { ConversationItem, LayoutUser } from '../components/layout/types'
import { api } from '../services/apiClient'

export interface UseTicketActionsOptions {
  user: LayoutUser
  conversations: ConversationItem[]
  setConversations: React.Dispatch<React.SetStateAction<ConversationItem[]>>
  selectedConversationId: string | null
  onRefreshConversations?: () => void
}

export function useTicketActions({
  user,
  conversations,
  setConversations,
  selectedConversationId,
  onRefreshConversations,
}: UseTicketActionsOptions) {
  const [internalNote, setInternalNote] = useState('')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const handleResolveTicket = useCallback(async () => {
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
      await api.patch(`/api/v1/tickets/${activeTicket.id}/status`, { status: nextStatus })
    } catch {
      if (onRefreshConversations) onRefreshConversations()
    }
  }, [conversations, selectedConversationId, setConversations, onRefreshConversations])

  const handleAssignTicket = useCallback(async () => {
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
      await api.patch(`/api/v1/tickets/${activeTicket.id}/assignee`, { assigneeId: nextAssigneeId })
    } catch {
      if (onRefreshConversations) onRefreshConversations()
    }
  }, [conversations, selectedConversationId, setConversations, user.id, onRefreshConversations])

  const handleSaveInternalNote = useCallback(
    async (note: string, ticketIdOverride?: string) => {
      const activeTicketId =
        ticketIdOverride || conversations.find((c) => c.id === selectedConversationId)?.ticket?.id

      if (!activeTicketId) {
        setInternalNote(note)
        return
      }

      const prevNote = internalNote
      const prevConversations = conversations
      const nowIso = new Date().toISOString()

      // Optimistic state update
      setInternalNote(note)
      setConversations((prev) =>
        prev.map((c) =>
          c.ticket?.id === activeTicketId
            ? {
                ...c,
                ticket: {
                  ...c.ticket,
                  internalNote: note,
                  internalNoteUpdatedAt: nowIso,
                  internalNoteUpdatedBy: user?.name || 'Agen CS',
                },
              }
            : c,
        ),
      )

      try {
        await api.patch(`/api/v1/tickets/${activeTicketId}/note`, { internalNote: note })
      } catch (err) {
        // Rollback on network/server error
        setInternalNote(prevNote)
        setConversations(prevConversations)
        throw err
      }
    },
    [conversations, selectedConversationId, internalNote, user?.name, setConversations],
  )

  return {
    internalNote,
    setInternalNote,
    isDrawerOpen,
    setIsDrawerOpen,
    handleResolveTicket,
    handleAssignTicket,
    handleSaveInternalNote,
  }
}
