import { useEffect, useState } from 'react'
import {
  BrowserRouter,
  MemoryRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'
import type { TimelineMessage } from './components/chat'
import { WhatsAppLayout } from './components/layout'
import type { LayoutNavTab, LayoutUser, PresenceStatus } from './components/layout/types'
import { AppModals } from './components/modals'
import { INITIAL_USER } from './data/mockData'
import { useAppModals, useConversationChat } from './hooks'
import { AiProviderSettingsPage } from './pages/AiProviderSettingsPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { AutomationRulesPage } from './pages/AutomationRulesPage'
import { CampaignsPage } from './pages/CampaignsPage'
import { ChannelWizardPage } from './pages/ChannelWizardPage'
import { CsatSurveyPage } from './pages/CsatSurveyPage'
import { EnterpriseSecurityPage } from './pages/EnterpriseSecurityPage'
import { HelpCenterPage } from './pages/HelpCenterPage'
import { LoginPage } from './pages/LoginPage'
import { SetupPage } from './pages/SetupPage'
import { api } from './services/apiClient'

export interface AppProps {
  initialAuthenticated?: boolean
  initialPath?: string
}

function InboxConversationSync({
  currentSelectedId,
  onSelect,
}: {
  currentSelectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const { conversationId } = useParams()
  useEffect(() => {
    if (conversationId && conversationId !== currentSelectedId) {
      onSelect(conversationId)
    }
  }, [conversationId, currentSelectedId, onSelect])
  return null
}

function ProtectedRoute({
  isAuthenticated,
  onLoginSuccess,
  children,
}: {
  isAuthenticated: boolean
  onLoginSuccess: (data: unknown) => void
  children: React.ReactNode
}) {
  const navigate = useNavigate()

  useEffect(() => {
    if (
      !isAuthenticated &&
      typeof window !== 'undefined' &&
      window.location.pathname !== '/login'
    ) {
      navigate('/login')
    }
  }, [isAuthenticated, navigate])

  if (!isAuthenticated) {
    return <LoginPage onSuccess={onLoginSuccess} />
  }

  return <>{children}</>
}

function AppContent({ initialAuthenticated }: { initialAuthenticated?: boolean }) {
  const location = useLocation()
  const navigate = useNavigate()

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

  const initialConvId = location.pathname.startsWith('/inbox/')
    ? location.pathname.slice('/inbox/'.length)
    : null

  const chat = useConversationChat({
    user,
    initialConversationId: initialConvId || undefined,
  })

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
      const activeConvId = chat.selectedConversationId
      chat.setMessagesMap((prev) => ({
        ...prev,
        [activeConvId]: [...(prev[activeConvId] || []), newMsg],
      }))
    },
  })

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
    navigate('/login')
  }

  const handleLoginSuccess = (data: unknown) => {
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
    navigate('/inbox')
  }

  const getActiveTab = (pathname: string): LayoutNavTab => {
    if (pathname.startsWith('/contacts')) return 'contacts'
    if (pathname.startsWith('/analytics') || pathname.startsWith('/reports')) return 'reports'
    if (pathname.startsWith('/campaigns')) return 'campaigns'
    if (pathname.startsWith('/automation')) return 'automation'
    if (pathname.startsWith('/help-center')) return 'help-center'
    if (pathname.startsWith('/settings')) return 'settings'
    return 'inbox'
  }

  const handleTabChange = (tab: LayoutNavTab) => {
    switch (tab) {
      case 'inbox':
        navigate('/inbox')
        break
      case 'contacts':
        navigate('/contacts')
        break
      case 'reports':
        navigate('/analytics')
        break
      case 'campaigns':
        navigate('/campaigns')
        break
      case 'automation':
        navigate('/automation')
        break
      case 'help-center':
        navigate('/help-center')
        break
      case 'settings':
        navigate('/settings/channels')
        break
    }
  }

  const handleSelectConversation = (id: string | null) => {
    chat.handleSelectConversation(id)
    if (id) {
      navigate(`/inbox/${id}`)
    } else {
      navigate('/inbox')
    }
  }

  const renderDashboard = (children?: React.ReactNode) => {
    return (
      <>
        <WhatsAppLayout
          currentUser={user}
          conversations={chat.filteredConversations}
          allConversations={chat.conversations}
          selectedConversationId={chat.selectedConversationId}
          isDrawerOpen={chat.isDrawerOpen}
          activeTab={getActiveTab(location.pathname)}
          activeChannelFilter={chat.activeChannelFilter}
          activeFilter={chat.activeFilter}
          searchQuery={chat.searchQuery}
          internalNote={chat.internalNote}
          messages={chat.currentMessages}
          onTabChange={handleTabChange}
          onChannelFilterChange={chat.setActiveChannelFilter}
          onPresenceChange={(status: PresenceStatus) => setUser((u) => ({ ...u, status }))}
          onSelectConversation={handleSelectConversation}
          onFilterChange={chat.setActiveFilter}
          onSearchChange={chat.setSearchQuery}
          onNewChat={() => {
            chat.setSelectedConversationId(null)
            navigate('/inbox')
          }}
          onToggleDrawer={() => chat.setIsDrawerOpen(!chat.isDrawerOpen)}
          onCloseDrawer={() => chat.setIsDrawerOpen(false)}
          onSendMessage={chat.handleSendMessage}
          onAssignTicket={chat.handleAssignTicket}
          onResolveTicket={chat.handleResolveTicket}
          onSaveInternalNote={chat.setInternalNote}
          onOpenSettings={() => {
            navigate('/settings/channels')
          }}
          onOpenUserManagement={() => modals.setIsUserManagementOpen(true)}
          onOpenTemplateDialog={() => modals.setIsTemplateDialogOpen(true)}
          onLogout={handleLogout}
          onAddChannel={() => modals.setIsChannelWizardOpen(true)}
          onOpenWhatsAppPairing={(inboxId, inboxName) =>
            modals.openPairingDialog(inboxId || 'default', inboxName || 'WhatsApp Layanan CS')
          }
          whatsappConnectionStatus={modals.pairingState.status}
          whatsappChannels={modals.whatsappChannels}
          onUpdateContact={async (updated) => {
            if (chat.selectedConversationId && updated.contactName) {
              chat.setConversations((prev) =>
                prev.map((c) =>
                  c.id === chat.selectedConversationId
                    ? {
                        ...c,
                        contactName: updated.contactName || c.contactName,
                        contactPhone:
                          updated.contactPhone !== undefined
                            ? updated.contactPhone
                            : c.contactPhone,
                      }
                    : c,
                ),
              )
            }
          }}
        >
          {children}
        </WhatsAppLayout>

        <AppModals
          isPairingDialogOpen={modals.isPairingDialogOpen}
          pairingState={modals.pairingState}
          pairingInboxName={modals.pairingInboxName}
          onClosePairingDialog={() => {
            modals.setIsPairingDialogOpen(false)
            modals.fetchWhatsAppChannels()
          }}
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
          isUserManagementOpen={modals.isUserManagementOpen}
          onCloseUserManagement={() => modals.setIsUserManagementOpen(false)}
          isTemplateDialogOpen={modals.isTemplateDialogOpen}
          selectedConversationId={chat.selectedConversationId}
          templates={modals.templates}
          onCloseTemplateDialog={() => modals.setIsTemplateDialogOpen(false)}
          onSendTemplate={modals.handleSendTemplate}
          isChannelWizardOpen={modals.isChannelWizardOpen}
          onCloseChannelWizard={() => modals.setIsChannelWizardOpen(false)}
          onOpenWhatsAppPairingFromWizard={() =>
            modals.openPairingDialog('default', 'WhatsApp Layanan CS')
          }
          onSaveChannel={modals.handleSaveChannel}
          isBusinessHoursOpen={modals.isBusinessHoursOpen}
          onCloseBusinessHours={() => modals.setIsBusinessHoursOpen(false)}
        />
      </>
    )
  }

  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/setup" element={<SetupPage onSuccess={() => navigate('/login')} />} />
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/inbox" replace />
          ) : (
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
                navigate('/inbox')
              }}
            />
          )
        }
      />
      <Route path="/csat/:token" element={<CsatSurveyPage />} />
      <Route path="/csat" element={<CsatSurveyPage />} />

      {/* Protected Dashboard Pages */}
      <Route
        path="/inbox"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated} onLoginSuccess={handleLoginSuccess}>
            {renderDashboard()}
          </ProtectedRoute>
        }
      />
      <Route
        path="/inbox/:conversationId"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated} onLoginSuccess={handleLoginSuccess}>
            <InboxConversationSync
              currentSelectedId={chat.selectedConversationId}
              onSelect={chat.handleSelectConversation}
            />
            {renderDashboard()}
          </ProtectedRoute>
        }
      />
      <Route
        path="/contacts"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated} onLoginSuccess={handleLoginSuccess}>
            {renderDashboard()}
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated} onLoginSuccess={handleLoginSuccess}>
            {renderDashboard(<AnalyticsPage />)}
          </ProtectedRoute>
        }
      />
      <Route path="/reports" element={<Navigate to="/analytics" replace />} />
      <Route
        path="/campaigns"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated} onLoginSuccess={handleLoginSuccess}>
            {renderDashboard(<CampaignsPage />)}
          </ProtectedRoute>
        }
      />
      <Route
        path="/automation"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated} onLoginSuccess={handleLoginSuccess}>
            {renderDashboard(<AutomationRulesPage />)}
          </ProtectedRoute>
        }
      />
      <Route
        path="/help-center"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated} onLoginSuccess={handleLoginSuccess}>
            {renderDashboard(<HelpCenterPage />)}
          </ProtectedRoute>
        }
      />
      <Route path="/settings" element={<Navigate to="/settings/channels" replace />} />
      <Route
        path="/settings/ai"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated} onLoginSuccess={handleLoginSuccess}>
            {renderDashboard(<AiProviderSettingsPage />)}
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/security"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated} onLoginSuccess={handleLoginSuccess}>
            {renderDashboard(<EnterpriseSecurityPage />)}
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/channels"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated} onLoginSuccess={handleLoginSuccess}>
            {renderDashboard(
              <ChannelWizardPage initialView="list" onBack={() => navigate('/settings/ai')} />,
            )}
          </ProtectedRoute>
        }
      />

      {/* Root & Fallback */}
      <Route path="/" element={<Navigate to={isAuthenticated ? '/inbox' : '/login'} replace />} />
      <Route path="*" element={<Navigate to={isAuthenticated ? '/inbox' : '/login'} replace />} />
    </Routes>
  )
}

export function App({ initialAuthenticated, initialPath }: AppProps = {}) {
  const isServerOrTest = typeof window === 'undefined' || Boolean(initialPath)

  if (isServerOrTest) {
    const entry = initialPath || (initialAuthenticated === false ? '/login' : '/inbox')
    return (
      <MemoryRouter initialEntries={[entry]}>
        <AppContent initialAuthenticated={initialAuthenticated} />
      </MemoryRouter>
    )
  }

  return (
    <BrowserRouter>
      <AppContent initialAuthenticated={initialAuthenticated} />
    </BrowserRouter>
  )
}

export default App
