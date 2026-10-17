import type { BotFlowDefinition, WhatsAppTemplate } from '@xatxoot/shared'
import type { TimelineMessage } from '../components/chat'
import type { ConversationItem, LayoutUser } from '../components/layout/types'
import type { AgentUser, TeamWithMembers } from '../components/teams'

export const INITIAL_USER: LayoutUser = {
  id: '3b87d597-cde4-4b3e-8cce-e3bd24ac1c4f',
  name: 'Petugas CS',
  email: 'agent@xatxoot.local',
  role: 'agent',
  status: 'online',
}

export const INITIAL_CONVERSATIONS: ConversationItem[] = [
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
      assignedTo: '3b87d597-cde4-4b3e-8cce-e3bd24ac1c4f',
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

export const INITIAL_MESSAGES_MAP: Record<string, TimelineMessage[]> = {
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

export const INITIAL_BOT_FLOW: BotFlowDefinition = {
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

export const AVAILABLE_AGENTS: AgentUser[] = [
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

export const INITIAL_TEAMS: TeamWithMembers[] = [
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

export const INITIAL_TEMPLATES: WhatsAppTemplate[] = [
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
