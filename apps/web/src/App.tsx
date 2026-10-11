import type { BotFlowDefinition, WhatsAppTemplate } from '@xatxoot/shared'
import { useState } from 'react'
import type { TimelineMessage } from './components/chat'
import { VisualFlowBuilder } from './components/flow-builder'
import { WhatsAppLayout } from './components/layout/WhatsAppLayout'
import type {
  ChatFilter,
  ConversationItem,
  LayoutChannelFilter,
  LayoutNavTab,
  LayoutUser,
  PresenceStatus,
} from './components/layout/types'
import { BaileysPairingDialog, type BaileysPairingState } from './components/pairing'
import { type AgentUser, TeamManagement, type TeamWithMembers } from './components/teams'
import { WhatsAppTemplateDialog } from './components/templates'
import {
  applyRealtimeMessage,
  applyRealtimeMessageStatus,
  applyRealtimeTicket,
  useRealtimeStream,
} from './hooks'

const INITIAL_USER: LayoutUser = {
  id: 'usr_default_agent',
  name: 'Petugas CS',
  email: 'agent@xatxoot.local',
  role: 'agent',
  status: 'online',
}

const INITIAL_CONVERSATIONS: ConversationItem[] = [
  {
    id: 'conv-1',
    contactName: 'Budi Santoso',
    contactPhone: '+6281234567890',
    channel: 'whatsapp',
    lastMessage: 'Halo min, paket saya dari kemarin belum sampai ya?',
    lastMessageTimestamp: '10:42',
    unreadCount: 2,
    presence: 'online',
    ticket: {
      id: 't-101',
      ticketNumber: 'T-101',
      status: 'open',
      priority: 'high',
      assignedTo: 'usr_default_agent',
    },
  },
  {
    id: 'conv-2',
    contactName: 'Siti Rahma',
    contactPhone: '+6289876543210',
    channel: 'website_widget',
    lastMessage: 'Halo kak, apakah ada diskon untuk pembelian grosir?',
    lastMessageTimestamp: '09:15',
    unreadCount: 0,
    presence: 'offline',
    ticket: {
      id: 't-102',
      ticketNumber: 'T-102',
      status: 'pending',
      priority: 'medium',
    },
  },
  {
    id: 'conv-3',
    contactName: 'Ahmad Fauzi',
    contactPhone: '+6287711223344',
    channel: 'whatsapp',
    lastMessage: 'Baik, terima kasih atas bantuannya kak!',
    lastMessageTimestamp: 'Kemarin',
    unreadCount: 0,
    presence: 'offline',
    ticket: {
      id: 't-103',
      ticketNumber: 'T-103',
      status: 'resolved',
      priority: 'low',
    },
  },
]

const INITIAL_MESSAGES_MAP: Record<string, TimelineMessage[]> = {
  'conv-1': [
    {
      id: 'm-101',
      conversationId: 'conv-1',
      senderId: 'contact-01',
      senderType: 'contact',
      senderName: 'Budi Santoso',
      messageType: 'incoming',
      contentType: 'text',
      content:
        'Halo min, paket saya resi ```JKT-8899``` dari kemarin belum sampai ya? *Mohon dicek* segera kak 🙏',
      timestamp: '10:40',
      dateGroup: 'HARI INI',
      status: 'read',
    },
    {
      id: 'm-102',
      conversationId: 'conv-1',
      messageType: 'activity',
      contentType: 'text',
      content: 'Tiket #T-101 dibuat otomatis dari pesan WhatsApp.',
      timestamp: '10:40',
      dateGroup: 'HARI INI',
    },
    {
      id: 'm-103',
      conversationId: 'conv-1',
      senderId: 'usr_default_agent',
      senderType: 'user',
      senderName: 'Petugas CS',
      messageType: 'outgoing',
      contentType: 'text',
      content: 'Halo kak Budi! Paket sedang di _hub sortir kurir_. Estimasi tiba sore ini ya kak.',
      timestamp: '10:42',
      dateGroup: 'HARI INI',
      status: 'read',
    },
  ],
  'conv-2': [
    {
      id: 'm-201',
      conversationId: 'conv-2',
      senderId: 'contact-02',
      senderType: 'contact',
      senderName: 'Siti Rahma',
      messageType: 'incoming',
      contentType: 'text',
      content: 'Halo kak, apakah ada diskon untuk pembelian grosir?',
      timestamp: '09:15',
      dateGroup: 'HARI INI',
      status: 'read',
    },
  ],
  'conv-3': [
    {
      id: 'm-301',
      conversationId: 'conv-3',
      senderId: 'contact-03',
      senderType: 'contact',
      senderName: 'Ahmad Fauzi',
      messageType: 'incoming',
      contentType: 'text',
      content: 'Baik, terima kasih atas bantuannya kak!',
      timestamp: '16:00',
      dateGroup: 'KEMARIN',
      status: 'read',
    },
    {
      id: 'm-302',
      conversationId: 'conv-3',
      messageType: 'activity',
      contentType: 'text',
      content: 'Tiket #T-103 diselesaikan oleh Petugas CS.',
      timestamp: '16:05',
      dateGroup: 'KEMARIN',
    },
  ],
}

const INITIAL_BOT_FLOW: BotFlowDefinition = {
  startNodeId: 'node-msg-start',
  nodes: [
    {
      id: 'node-msg-start',
      type: 'message',
      name: 'Sambutan Pelanggan',
      data: {
        text: 'Halo! Selamat datang di layanan asisten virtual kami. Ada yang bisa kami bantu hari ini?',
      },
    },
    {
      id: 'node-q-menu',
      type: 'question',
      name: 'Pilihan Menu Layanan',
      data: {
        question: 'Pilih jenis pertanyaan Anda:',
        questionType: 'choice',
        variableName: 'menu_pilihan',
        options: [
          { id: 'opt-1', label: '1. Cek Status Pengiriman', value: 'ongkir' },
          { id: 'opt-2', label: '2. Hubungkan ke Agent CS', value: 'cs_agent' },
        ],
      },
    },
    {
      id: 'node-handoff-agent',
      type: 'handoff',
      name: 'Handoff ke Agent Manusia',
      data: {
        priority: 'high',
        handoffMessage: 'Pelanggan memilih bantuan agent CS manusia.',
      },
    },
  ],
  edges: [
    { id: 'edge-1', source: 'node-msg-start', target: 'node-q-menu' },
    { id: 'edge-2', source: 'node-q-menu', target: 'node-handoff-agent' },
  ],
}

const AVAILABLE_AGENTS: AgentUser[] = [
  {
    id: 'usr_default_agent',
    name: 'Petugas CS',
    email: 'agent@xatxoot.local',
    role: 'agent',
    status: 'online',
  },
  {
    id: 'usr_sarah',
    name: 'Sarah CS',
    email: 'sarah@xatxoot.local',
    role: 'agent',
    status: 'online',
  },
  {
    id: 'usr_budi',
    name: 'Budi Support',
    email: 'budi@xatxoot.local',
    role: 'agent',
    status: 'busy',
  },
]

const INITIAL_TEAMS: TeamWithMembers[] = [
  {
    id: 'team-cs-general',
    name: 'Tim Layanan Pelanggan Umum',
    description: 'Menangani pertanyaan umum, informasi produk, dan komplain pelanggan',
    allowAutoAssign: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    members: [AVAILABLE_AGENTS[0], AVAILABLE_AGENTS[1]],
  },
  {
    id: 'team-tech-support',
    name: 'Tim Bantuan Teknis',
    description: 'Menangani kendala teknis integrasi, sistem eror, dan eskalasi bug',
    allowAutoAssign: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    members: [AVAILABLE_AGENTS[2]],
  },
]

const INITIAL_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'tpl-order-confirm',
    wabaTemplateId: 'waba-order-confirm',
    name: 'order_confirmation',
    language: 'id',
    category: 'UTILITY',
    status: 'APPROVED',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Konfirmasi Pesanan #{{1}}',
      },
      {
        type: 'BODY',
        text: 'Halo {{1}}, terima kasih telah berbelanja di {{2}}. Pesanan Anda senilai {{3}} sedang diproses.',
      },
      {
        type: 'FOOTER',
        text: 'Balas STOP untuk berhenti berlangganan.',
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'QUICK_REPLY',
            text: 'Lacak Status Pesanan',
          },
        ],
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl-shipping-update',
    wabaTemplateId: 'waba-shipping-update',
    name: 'shipping_receipt_media',
    language: 'id',
    category: 'UTILITY',
    status: 'APPROVED',
    components: [
      {
        type: 'HEADER',
        format: 'IMAGE',
      },
      {
        type: 'BODY',
        text: 'Paket nomor resi {{1}} telah dikirim melalui kurir {{2}}.',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl-promo-flash',
    wabaTemplateId: 'waba-promo-flash',
    name: 'promo_flash_sale',
    language: 'id',
    category: 'MARKETING',
    status: 'APPROVED',
    components: [
      {
        type: 'BODY',
        text: 'Promo spesial diskon {{1}}% berlaku hingga {{2}}! Jangan lewatkan kesempatan ini.',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

export function App() {
  const [user, setUser] = useState<LayoutUser>(INITIAL_USER)
  const [conversations, setConversations] = useState<ConversationItem[]>(INITIAL_CONVERSATIONS)
  const [messagesMap, setMessagesMap] =
    useState<Record<string, TimelineMessage[]>>(INITIAL_MESSAGES_MAP)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>('conv-1')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<LayoutNavTab>('inbox')
  const [activeChannelFilter, setActiveChannelFilter] = useState<LayoutChannelFilter>('all')
  const [activeFilter, setActiveFilter] = useState<ChatFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [internalNote, setInternalNote] = useState(
    'Pelanggan VIP. Sering melakukan pemesanan rutin setiap awal bulan.',
  )
  const [isPairingDialogOpen, setIsPairingDialogOpen] = useState(false)
  const [isBotFlowBuilderOpen, setIsBotFlowBuilderOpen] = useState(false)
  const [isTeamManagementOpen, setIsTeamManagementOpen] = useState(false)
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  const [teams, setTeams] = useState<TeamWithMembers[]>(INITIAL_TEAMS)
  const [templates] = useState<WhatsAppTemplate[]>(INITIAL_TEMPLATES)
  const [botFlow, setBotFlow] = useState<BotFlowDefinition>(INITIAL_BOT_FLOW)
  const [pairingState, setPairingState] = useState<BaileysPairingState>({
    status: 'qr_ready',
    qrData: '2@fK7x8Y1...xatxoot-baileys-live-session-qr',
  })

  // Real-time SSE updates without page refresh
  const { status: _realtimeStatus } = useRealtimeStream({
    token: 'mock-agent-jwt',
    onMessageCreated: (event) => {
      setMessagesMap((prev) => applyRealtimeMessage(prev, event))
      setConversations((prev) =>
        prev.map((c) =>
          c.id === event.conversationId
            ? {
                ...c,
                lastMessage: event.content,
                lastMessageTimestamp: 'Baru saja',
                unreadCount:
                  selectedConversationId === event.conversationId ? 0 : (c.unreadCount || 0) + 1,
              }
            : c,
        ),
      )
    },
    onMessageStatusUpdated: (event) => {
      setMessagesMap((prev) => applyRealtimeMessageStatus(prev, event))
    },
    onTicketUpdated: (event) => {
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

  const handleSendMessage = (text: string) => {
    if (!selectedConversationId) return

    const newMsg: TimelineMessage = {
      id: `msg-${Date.now()}`,
      conversationId: selectedConversationId,
      senderId: user.id,
      senderType: 'user',
      senderName: user.name,
      messageType: 'outgoing',
      contentType: 'text',
      content: text,
      timestamp: 'Baru saja',
      dateGroup: 'HARI INI',
      status: 'sent',
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
              lastMessage: text,
              lastMessageTimestamp: 'Baru saja',
              unreadCount: 0,
            }
          : c,
      ),
    )
  }

  const handleResolveTicket = () => {
    if (!selectedConversationId) return

    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversationId && c.ticket
          ? {
              ...c,
              ticket: {
                ...c.ticket,
                status: 'resolved',
              },
            }
          : c,
      ),
    )
  }

  const handleAssignTicket = () => {
    if (!selectedConversationId) return

    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversationId && c.ticket
          ? {
              ...c,
              ticket: {
                ...c.ticket,
                assignedTo: user.id,
              },
            }
          : c,
      ),
    )
  }

  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id)
    // Clear unread
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)))
  }

  return (
    <>
      <WhatsAppLayout
        currentUser={user}
        conversations={filteredConversations}
        selectedConversationId={selectedConversationId}
        isDrawerOpen={isDrawerOpen}
        activeTab={activeTab}
        activeChannelFilter={activeChannelFilter}
        activeFilter={activeFilter}
        searchQuery={searchQuery}
        internalNote={internalNote}
        messages={currentMessages}
        onTabChange={setActiveTab}
        onChannelFilterChange={setActiveChannelFilter}
        onPresenceChange={(status: PresenceStatus) => setUser((u) => ({ ...u, status }))}
        onSelectConversation={handleSelectConversation}
        onFilterChange={setActiveFilter}
        onSearchChange={setSearchQuery}
        onNewChat={() => setSelectedConversationId(null)}
        onToggleDrawer={() => setIsDrawerOpen(!isDrawerOpen)}
        onCloseDrawer={() => setIsDrawerOpen(false)}
        onSendMessage={handleSendMessage}
        onAssignTicket={handleAssignTicket}
        onResolveTicket={handleResolveTicket}
        onSaveInternalNote={setInternalNote}
        onOpenSettings={() => {
          // Open Bot Flow Builder if active tab is settings or toggle
          if (activeTab === 'settings') {
            setIsBotFlowBuilderOpen(true)
          } else {
            setIsPairingDialogOpen(true)
          }
        }}
        onOpenTemplateDialog={() => setIsTemplateDialogOpen(true)}
      />

      <BaileysPairingDialog
        isOpen={isPairingDialogOpen}
        inboxName="WhatsApp Layanan CS"
        state={pairingState}
        onClose={() => setIsPairingDialogOpen(false)}
        onRefreshQr={() => {
          setPairingState((prev) => ({
            ...prev,
            status: 'qr_ready',
            qrData: `2@fK7x8Y1...refreshed-${Date.now()}`,
          }))
        }}
        onRetry={() => {
          setPairingState({
            status: 'connecting',
          })
          setTimeout(() => {
            setPairingState({
              status: 'qr_ready',
              qrData: `2@fK7x8Y1...reconnected-${Date.now()}`,
            })
          }, 500)
        }}
      />

      {isBotFlowBuilderOpen && (
        <div
          data-testid="bot-flow-builder-modal"
          className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-xs p-4 md:p-8"
        >
          <div className="flex-1 rounded-2xl overflow-hidden shadow-2xl border border-slate-300 bg-white flex flex-col">
            <VisualFlowBuilder
              initialFlow={botFlow}
              onSave={(saved) => {
                setBotFlow(saved)
                setIsBotFlowBuilderOpen(false)
              }}
              onCancel={() => setIsBotFlowBuilderOpen(false)}
            />
          </div>
        </div>
      )}

      {isTeamManagementOpen && (
        <TeamManagement
          teams={teams}
          availableAgents={AVAILABLE_AGENTS}
          isModal={true}
          onSaveTeam={(teamData) => {
            if (teamData.id) {
              setTeams((prev) =>
                prev.map((t) =>
                  t.id === teamData.id
                    ? {
                        ...t,
                        name: teamData.name,
                        description: teamData.description,
                        allowAutoAssign: teamData.allowAutoAssign,
                        updatedAt: new Date().toISOString(),
                      }
                    : t,
                ),
              )
            } else {
              const newT: TeamWithMembers = {
                id: `team-${Date.now().toString(36)}`,
                name: teamData.name,
                description: teamData.description,
                allowAutoAssign: teamData.allowAutoAssign,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                members: [],
              }
              setTeams((prev) => [...prev, newT])
            }
          }}
          onDeleteTeam={(teamId) => {
            setTeams((prev) => prev.filter((t) => t.id !== teamId))
          }}
          onAddMember={(teamId, agentId) => {
            const ag = AVAILABLE_AGENTS.find((a) => a.id === agentId)
            if (!ag) return
            setTeams((prev) =>
              prev.map((t) =>
                t.id === teamId
                  ? {
                      ...t,
                      members: [...(t.members || []), ag],
                    }
                  : t,
              ),
            )
          }}
          onRemoveMember={(teamId, agentId) => {
            setTeams((prev) =>
              prev.map((t) =>
                t.id === teamId
                  ? {
                      ...t,
                      members: (t.members || []).filter((m) => m.id !== agentId),
                    }
                  : t,
              ),
            )
          }}
          onToggleRoundRobin={(teamId, activeVal) => {
            setTeams((prev) =>
              prev.map((t) => (t.id === teamId ? { ...t, allowAutoAssign: activeVal } : t)),
            )
          }}
          onClose={() => setIsTeamManagementOpen(false)}
        />
      )}

      {isTemplateDialogOpen && (
        <WhatsAppTemplateDialog
          isOpen={isTemplateDialogOpen}
          conversationId={selectedConversationId || 'conv-1'}
          templates={templates}
          onClose={() => setIsTemplateDialogOpen(false)}
          onSendTemplate={(payload) => {
            if (!selectedConversationId) return
            const newMsg: TimelineMessage = {
              id: `msg-${Date.now()}`,
              conversationId: selectedConversationId,
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
            setMessagesMap((prev) => ({
              ...prev,
              [selectedConversationId]: [...(prev[selectedConversationId] || []), newMsg],
            }))
            setIsTemplateDialogOpen(false)
          }}
        />
      )}
    </>
  )
}

export default App
