import type { BotFlowDefinition, WhatsAppTemplate } from '@xatxoot/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BusinessHoursSettings } from './components/business-hours'
import { ChannelWizard } from './components/channels'
import type { ContentType, MessageType, TimelineMessage } from './components/chat'
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
import { LoginPage } from './pages/LoginPage'
import { SetupPage } from './pages/SetupPage'

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
  const [isPairingDialogOpen, setIsPairingDialogOpen] = useState(false)
  const [isBotFlowBuilderOpen, setIsBotFlowBuilderOpen] = useState(false)
  const [isTeamManagementOpen, setIsTeamManagementOpen] = useState(false)
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  const [isChannelWizardOpen, setIsChannelWizardOpen] = useState(false)
  const [isBusinessHoursOpen, setIsBusinessHoursOpen] = useState(false)
  const [teams, setTeams] = useState<TeamWithMembers[]>(INITIAL_TEAMS)
  const [templates] = useState<WhatsAppTemplate[]>(INITIAL_TEMPLATES)
  const [botFlow, setBotFlow] = useState<BotFlowDefinition>(INITIAL_BOT_FLOW)
  const [pairingState, setPairingState] = useState<BaileysPairingState>({
    status: 'connecting',
  })

  // Fetch live Baileys pairing QR code from backend API
  const fetchBaileysQr = useCallback(async () => {
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('auth_token') || 'valid-access-token'
          : 'valid-access-token'
      const res = await fetch('/api/v1/inboxes/default/channel/whatsapp-unofficial/qr', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (res.ok) {
        const data = (await res.json()) as {
          sessionId?: string
          connectionStatus?: string
          qrCode?: string | null
          phoneNumber?: string | null
        }
        if (data.connectionStatus === 'connected') {
          setPairingState({
            status: 'connected',
            sessionId: data.sessionId,
            phoneNumber: data.phoneNumber || '+6281234567890',
          })
        } else if (data.qrCode) {
          setPairingState({
            status: 'qr_ready',
            qrData: data.qrCode,
            sessionId: data.sessionId,
          })
        } else {
          setPairingState((prev) => ({
            ...prev,
            status: (data.connectionStatus as BaileysPairingState['status']) || 'connecting',
            sessionId: data.sessionId || prev.sessionId,
          }))
        }
      }
    } catch (err) {
      console.error('Failed to fetch Baileys live QR code:', err)
    }
  }, [])

  // Poll for Baileys pairing QR status while pairing dialog is open
  useEffect(() => {
    if (!isPairingDialogOpen) return

    fetchBaileysQr()
    const timer = setInterval(() => {
      fetchBaileysQr()
    }, 2500)

    return () => clearInterval(timer)
  }, [isPairingDialogOpen, fetchBaileysQr])

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

  const { status: _realtimeStatus } = useRealtimeStream({
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
        senderType: anyEvt.message?.senderType || anyEvt.senderType || 'contact',
        senderName: anyEvt.contact?.name || anyEvt.senderName || 'Pelanggan WhatsApp',
        timestamp: anyEvt.message?.createdAt || anyEvt.timestamp,
      }

      setMessagesMap((prev) => applyRealtimeMessage(prev, event))
      fetchConversations()
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

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/'

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    } catch {
      // Ignore network error on logout
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token')
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
        onLogout={handleLogout}
        onAddChannel={() => setIsChannelWizardOpen(true)}
        onOpenWhatsAppPairing={() => setIsPairingDialogOpen(true)}
        whatsappConnectionStatus={pairingState.status}
      />

      <BaileysPairingDialog
        isOpen={isPairingDialogOpen}
        inboxName="WhatsApp Layanan CS"
        state={pairingState}
        onClose={() => setIsPairingDialogOpen(false)}
        onRefreshQr={() => {
          setPairingState((prev) => ({
            ...prev,
            status: 'connecting',
          }))
          fetchBaileysQr()
        }}
        onRetry={() => {
          setPairingState((prev) => ({
            ...prev,
            status: 'connecting',
          }))
          fetchBaileysQr()
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

      {isChannelWizardOpen && (
        <ChannelWizard
          onClose={() => setIsChannelWizardOpen(false)}
          onOpenWhatsAppPairing={() => {
            setIsChannelWizardOpen(false)
            setIsPairingDialogOpen(true)
          }}
          onSaveChannel={async (payload) => {
            try {
              const token =
                typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
              await fetch('/api/v1/inboxes', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                  name: payload.inboxName,
                  channelType: payload.channelType,
                  channelConfig:
                    payload.emailConfig ||
                    payload.telegramConfig ||
                    payload.facebookConfig ||
                    payload.instagramConfig ||
                    payload.smsConfig,
                }),
              })
            } catch {
              // ignore network errors
            }
            setIsChannelWizardOpen(false)
          }}
        />
      )}

      {isBusinessHoursOpen && (
        <BusinessHoursSettings
          inboxName="WhatsApp Layanan CS"
          onClose={() => setIsBusinessHoursOpen(false)}
          onSave={(_config) => {
            setIsBusinessHoursOpen(false)
          }}
        />
      )}
    </>
  )
}

export default App
