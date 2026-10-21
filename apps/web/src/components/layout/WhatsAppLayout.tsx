import type { ReactNode } from 'react'
import { AnalyticsDashboard } from '../analytics'
import type { CannedItem, CommandItem, TimelineMessage } from '../chat'
import { ContactsDashboard } from '../contacts/ContactsDashboard'
import { type ContactDrawerData, ContactDrawer as CrmContactDrawer } from '../drawer'
import { ChatListPanel, type ChatListPanelProps, formatTicketStatus } from './ChatListPanel'
import { ConversationThread, type ConversationThreadProps } from './ConversationThread'
import { NavRail, type NavRailProps } from './NavRail'
import type {
  ChatFilter,
  ConversationItem,
  LayoutChannelFilter,
  LayoutNavTab,
  LayoutUser,
  PresenceStatus,
  WhatsAppChannelSummary,
} from './types'

// Re-export sub-components and types for backward compatibility
export { NavRail, type NavRailProps }
export { ChatListPanel, type ChatListPanelProps, formatTicketStatus }
export { ConversationThread, type ConversationThreadProps }

// ==========================================
// Kolom 3.5: ContactDrawer Adapter (Slide-Over Context CRM)
// ==========================================
export interface ContactDrawerProps {
  isOpen: boolean
  conversation: ConversationItem | null
  internalNote?: string
  contactData?: ContactDrawerData | null
  onClose: () => void
  onSaveInternalNote?: (note: string) => void
  onSelectTicket?: (ticketId: string) => void
  onUpdateContact?: (updated: Partial<ContactDrawerData>) => Promise<void> | void
}

export function ContactDrawer({
  isOpen,
  conversation,
  internalNote = '',
  contactData,
  onClose,
  onSaveInternalNote,
  onSelectTicket,
  onUpdateContact,
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
      onUpdateContact={onUpdateContact}
    />
  )
}

// ==========================================
// Main WhatsAppLayout Orchestrator
// ==========================================
export interface WhatsAppLayoutProps {
  currentUser: LayoutUser
  conversations: ConversationItem[]
  allConversations?: ConversationItem[]
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
  onSendMessage?: (msg: string, replyToMessageId?: string | null) => void
  replyingToMessage?: TimelineMessage | null
  onCancelReply?: () => void
  onReplyToMessage?: (message: TimelineMessage) => void
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
  onLogout?: () => void
  onAddChannel?: () => void
  onOpenWhatsAppPairing?: (inboxId?: string, inboxName?: string) => void
  whatsappConnectionStatus?: 'connected' | 'qr_ready' | 'connecting' | 'disconnected'
  whatsappChannels?: WhatsAppChannelSummary[]
  onOpenUserManagement?: () => void
  onUpdateContact?: (updated: Partial<ContactDrawerData>) => Promise<void> | void
  children?: ReactNode
}

export function WhatsAppLayout({
  currentUser,
  conversations,
  allConversations,
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
  replyingToMessage,
  onCancelReply,
  onReplyToMessage,
  onAssignTicket = () => {},
  onResolveTicket = () => {},
  onSaveInternalNote = () => {},
  onRetryMessage,
  onOpenSettings,
  onOpenTemplateDialog,
  onLogout,
  onAddChannel,
  onOpenWhatsAppPairing,
  whatsappConnectionStatus,
  whatsappChannels,
  onOpenUserManagement,
  onUpdateContact,
  children,
}: WhatsAppLayoutProps) {
  const selectedConversation =
    (allConversations || conversations).find((c) => c.id === selectedConversationId) || null

  return (
    <div className="flex h-screen w-full overflow-hidden bg-wa-chat-bg text-wa-text-primary antialiased">
      {/* Kolom 1: NavRail */}
      <NavRail
        currentUser={currentUser}
        activeTab={activeTab}
        activeChannelFilter={activeChannelFilter}
        onTabChange={onTabChange}
        onChannelFilterChange={onChannelFilterChange}
        onPresenceChange={onPresenceChange}
        onOpenSettings={onOpenSettings}
        onOpenUserManagement={onOpenUserManagement}
        onLogout={onLogout}
        onAddChannel={onAddChannel}
        onOpenWhatsAppPairing={onOpenWhatsAppPairing}
        whatsappConnectionStatus={whatsappConnectionStatus}
        whatsappChannels={whatsappChannels}
      />

      {activeTab === 'reports' ? (
        <div className="flex-1 h-full overflow-y-auto">{children || <AnalyticsDashboard />}</div>
      ) : activeTab === 'contacts' ? (
        <div className="flex-1 h-full overflow-y-auto">
          <ContactsDashboard
            conversations={conversations}
            onStartChat={(conversationId) => {
              onTabChange('inbox')
              onSelectConversation(conversationId)
            }}
          />
        </div>
      ) : activeTab !== 'inbox' ? (
        <div className="flex-1 h-full overflow-y-auto">{children}</div>
      ) : (
        <>
          {/* Kolom 2: ChatListPanel */}
          <ChatListPanel
            conversations={conversations}
            selectedConversationId={selectedConversationId}
            activeFilter={activeFilter}
            searchQuery={searchQuery}
            activeChannelFilter={activeChannelFilter}
            now={now}
            onSelectConversation={onSelectConversation}
            onFilterChange={onFilterChange}
            onSearchChange={onSearchChange}
            onNewChat={onNewChat}
            onResetChannelFilter={() => onChannelFilterChange('all')}
          />

          {/* Kolom 3: ConversationThread */}
          <ConversationThread
            conversation={selectedConversation}
            currentUser={currentUser}
            isDrawerOpen={isDrawerOpen}
            messages={messages}
            replyingToMessage={replyingToMessage}
            onCancelReply={onCancelReply}
            onReplyToMessage={onReplyToMessage}
            cannedResponses={cannedResponses}
            slashCommands={slashCommands}
            now={now}
            onToggleDrawer={onToggleDrawer}
            onSendMessage={onSendMessage}
            onAssignTicket={onAssignTicket}
            onResolveTicket={onResolveTicket}
            onSaveInternalNote={onSaveInternalNote}
            onRetryMessage={onRetryMessage}
            onOpenTemplateDialog={onOpenTemplateDialog}
          />

          {/* Kolom 3.5: ContactDrawer (Slide-Over CRM) */}
          <ContactDrawer
            isOpen={isDrawerOpen}
            conversation={selectedConversation}
            internalNote={internalNote}
            onClose={onCloseDrawer}
            onSaveInternalNote={onSaveInternalNote}
            onUpdateContact={onUpdateContact}
          />
        </>
      )}
    </div>
  )
}

export default WhatsAppLayout
