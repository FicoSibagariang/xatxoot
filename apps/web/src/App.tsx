import { useState } from 'react'
import type { TimelineMessage } from './components/chat'
import { WhatsAppLayout } from './components/layout'
import type { LayoutUser, PresenceStatus } from './components/layout/types'
import { AppModals } from './components/modals'
import { INITIAL_USER } from './data/mockData'
import { useAppModals, useConversationChat } from './hooks'
import { LoginPage } from './pages/LoginPage'
import { SetupPage } from './pages/SetupPage'
import { api } from './services/apiClient'

export interface AppProps {
  initialAuthenticated?: boolean
}

export function App({ initialAuthenticated }: AppProps = {}) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof initialAuthenticated === 'boolean') return initialAuthenticated
    if (typeof window === 'undefined') return true
    return Boolean(localStorage.getItem('auth_token'))
  })

  const [user, setUser] = useState<LayoutUser>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('auth_user')
        if (stored) {
          const u = JSON.parse(stored)
          return {
            id: u.id,
            name: u.displayName || u.email,
            email: u.email,
            role: u.role || 'agent',
            status: 'online',
          }
        }
      } catch {
        // ignore JSON parse error
      }
    }
    return INITIAL_USER
  })

  const chat = useConversationChat({ user })

  const modals = useAppModals({
    onSendTemplateMessage: (payload) => {
      if (!chat.selectedConversationId) return
      const newMsg: TimelineMessage = {
        id: `msg-${Date.now()}`,
        conversationId: chat.selectedConversationId,
        senderId: user.id,
        senderType: 'user',
        senderName: user.name,
        messageType: 'template',
        contentType: 'text',
        content: `[Template: ${payload.templateName}] Pesan template terkirim.`,
        timestamp: 'Baru saja',
        dateGroup: 'HARI INI',
        status: 'sent',
      }
      if (!chat.selectedConversationId) return
      const activeConvId = chat.selectedConversationId
      chat.setMessagesMap((prev) => ({
        ...prev,
        [activeConvId]: [...(prev[activeConvId] || []), newMsg],
      }))
    },
  })

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/'

  const handleLogout = async () => {
    try {
      await api.post('/api/v1/auth/logout')
    } catch {
      // Ignore network error on logout
    }
    api.clearToken()
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_user')
    }
    setIsAuthenticated(false)
  }

  // 1. First-time Setup page route
  if (currentPath === '/setup') {
    return (
      <SetupPage
        onSuccess={() => {
          if (typeof window !== 'undefined') {
            window.location.href = '/login'
          }
        }}
      />
    )
  }

  // 2. Login Page route or unauthenticated state
  if (!isAuthenticated || currentPath === '/login') {
    return (
      <LoginPage
        onSuccess={(data: unknown) => {
          const authData = data as {
            user?: { id: string; email: string; displayName?: string; role?: string }
          }
          if (authData?.user) {
            setUser({
              id: authData.user.id,
              name: authData.user.displayName || authData.user.email,
              email: authData.user.email,
              role: authData.user.role || 'agent',
              status: 'online',
            })
          }
          setIsAuthenticated(true)
          if (typeof window !== 'undefined' && window.location.pathname === '/login') {
            window.history.pushState({}, '', '/')
          }
        }}
      />
    )
  }

  return (
    <>
      <WhatsAppLayout
        currentUser={user}
        conversations={chat.filteredConversations}
        selectedConversationId={chat.selectedConversationId}
        isDrawerOpen={chat.isDrawerOpen}
        activeTab={chat.activeTab}
        activeChannelFilter={chat.activeChannelFilter}
        activeFilter={chat.activeFilter}
        searchQuery={chat.searchQuery}
        internalNote={chat.internalNote}
        messages={chat.currentMessages}
        onTabChange={chat.setActiveTab}
        onChannelFilterChange={chat.setActiveChannelFilter}
        onPresenceChange={(status: PresenceStatus) => setUser((u) => ({ ...u, status }))}
        onSelectConversation={chat.handleSelectConversation}
        onFilterChange={chat.setActiveFilter}
        onSearchChange={chat.setSearchQuery}
        onNewChat={() => chat.setSelectedConversationId(null)}
        onToggleDrawer={() => chat.setIsDrawerOpen(!chat.isDrawerOpen)}
        onCloseDrawer={() => chat.setIsDrawerOpen(false)}
        onSendMessage={chat.handleSendMessage}
        onAssignTicket={chat.handleAssignTicket}
        onResolveTicket={chat.handleResolveTicket}
        onSaveInternalNote={chat.setInternalNote}
        onOpenSettings={() => {
          if (chat.activeTab === 'settings') {
            modals.setIsBotFlowBuilderOpen(true)
          } else {
            modals.setIsPairingDialogOpen(true)
          }
        }}
        onOpenTemplateDialog={() => modals.setIsTemplateDialogOpen(true)}
        onLogout={handleLogout}
        onAddChannel={() => modals.setIsChannelWizardOpen(true)}
        onOpenWhatsAppPairing={() => modals.setIsPairingDialogOpen(true)}
        whatsappConnectionStatus={modals.pairingState.status}
      />

      <AppModals
        isPairingDialogOpen={modals.isPairingDialogOpen}
        pairingState={modals.pairingState}
        onClosePairingDialog={() => modals.setIsPairingDialogOpen(false)}
        onRefreshPairingQr={modals.handleRefreshPairingQr}
        onRetryPairing={modals.handleRefreshPairingQr}
        isBotFlowBuilderOpen={modals.isBotFlowBuilderOpen}
        botFlow={modals.botFlow}
        onSaveBotFlow={(saved) => {
          modals.setBotFlow(saved)
          modals.setIsBotFlowBuilderOpen(false)
        }}
        onCloseBotFlowBuilder={() => modals.setIsBotFlowBuilderOpen(false)}
        isTeamManagementOpen={modals.isTeamManagementOpen}
        teams={modals.teams}
        availableAgents={modals.availableAgents}
        onSaveTeam={modals.handleSaveTeam}
        onDeleteTeam={modals.handleDeleteTeam}
        onAddTeamMember={modals.handleAddTeamMember}
        onRemoveTeamMember={modals.handleRemoveTeamMember}
        onToggleRoundRobin={modals.handleToggleRoundRobin}
        onCloseTeamManagement={() => modals.setIsTeamManagementOpen(false)}
        isTemplateDialogOpen={modals.isTemplateDialogOpen}
        selectedConversationId={chat.selectedConversationId}
        templates={modals.templates}
        onCloseTemplateDialog={() => modals.setIsTemplateDialogOpen(false)}
        onSendTemplate={modals.handleSendTemplate}
        isChannelWizardOpen={modals.isChannelWizardOpen}
        onCloseChannelWizard={() => modals.setIsChannelWizardOpen(false)}
        onOpenWhatsAppPairingFromWizard={() => {
          modals.setIsChannelWizardOpen(false)
          modals.setIsPairingDialogOpen(true)
        }}
        onSaveChannel={modals.handleSaveChannel}
        isBusinessHoursOpen={modals.isBusinessHoursOpen}
        onCloseBusinessHours={() => modals.setIsBusinessHoursOpen(false)}
      />
    </>
  )
}

export default App
