import { useEffect, useState } from 'react'
import { Avatar, Badge, Button, Input } from '../astryx'
import type { ConversationItem } from '../layout/types'

export interface ContactItem {
  id: string
  name: string
  phone?: string
  email?: string
  company?: string
  avatarUrl?: string
  channel: 'whatsapp' | 'website_widget' | 'api'
  tags?: string[]
  conversationId?: string
  activeTicket?: {
    id: string
    ticketNumber: string
    status: 'open' | 'pending' | 'resolved' | 'snoozed'
  }
}

export interface ContactsDashboardProps {
  conversations?: ConversationItem[]
  initialContacts?: ContactItem[]
  onStartChat?: (conversationId: string) => void
}

const DEFAULT_SEED_CONTACTS: ContactItem[] = [
  {
    id: 'contact-01',
    name: 'Budi Santoso',
    phone: '+6281234567890',
    email: 'budi@example.com',
    company: 'PT Maju Bersama',
    tags: ['VIP', 'Customer'],
    channel: 'whatsapp',
    conversationId: 'conv-1',
    activeTicket: {
      id: 't-101',
      ticketNumber: 'T-101',
      status: 'open',
    },
  },
  {
    id: 'contact-02',
    name: 'Siti Rahma',
    phone: '+6289876543210',
    email: 'siti@example.com',
    company: 'CV Berkah Abadi',
    tags: ['Lead'],
    channel: 'website_widget',
    conversationId: 'conv-2',
    activeTicket: {
      id: 't-102',
      ticketNumber: 'T-102',
      status: 'resolved',
    },
  },
  {
    id: 'contact-03',
    name: 'Ahmad Fauzi',
    phone: '+6287711223344',
    email: 'ahmad.fauzi@corp.id',
    company: 'Fauzi Logistics',
    tags: ['Customer', 'Verified'],
    channel: 'whatsapp',
    conversationId: 'conv-3',
  },
]

export function buildContactsFromConversations(conversations: ConversationItem[]): ContactItem[] {
  const contactMap = new Map<string, { contact: ContactItem; lastMsgTime: number }>()

  for (const c of conversations) {
    const rawPhone = c.contactPhone?.trim() || ''
    // Unique key: normalized phone number if present, otherwise lowercase contact name
    const dedupeKey = rawPhone ? rawPhone.replace(/\s+/g, '') : c.contactName.trim().toLowerCase()

    const msgTime = c.lastMessageTimestamp ? new Date(c.lastMessageTimestamp).getTime() : 0
    const existing = contactMap.get(dedupeKey)

    if (!existing) {
      const idx = contactMap.size
      contactMap.set(dedupeKey, {
        contact: {
          id: `contact-${idx + 1}`,
          name: c.contactName,
          phone: c.contactPhone,
          email: `${c.contactName.toLowerCase().replace(/\s+/g, '.')}@acme.corp`,
          company:
            idx === 0 ? 'PT Maju Bersama' : idx === 1 ? 'CV Berkah Abadi' : 'Fauzi Logistics',
          avatarUrl: c.contactAvatarUrl,
          channel: c.channel,
          tags: idx === 0 ? ['VIP', 'Customer'] : idx === 1 ? ['Lead'] : ['Customer'],
          conversationId: c.id,
          activeTicket: c.ticket
            ? {
                id: c.ticket.id,
                ticketNumber: c.ticket.ticketNumber,
                status: c.ticket.status,
              }
            : undefined,
        },
        lastMsgTime: msgTime,
      })
    } else {
      const { contact: exContact, lastMsgTime: exTime } = existing

      // 1. Prefer meaningful name over raw phone number placeholder
      if (
        (exContact.name.startsWith('+') || exContact.name === exContact.phone) &&
        !c.contactName.startsWith('+') &&
        c.contactName !== c.contactPhone
      ) {
        exContact.name = c.contactName
      }

      // 2. Preserve avatarUrl if existing is missing
      if (!exContact.avatarUrl && c.contactAvatarUrl) {
        exContact.avatarUrl = c.contactAvatarUrl
      }

      // 3. Prioritize active ticket (open or pending) and its conversationId
      const hasActiveTicket =
        exContact.activeTicket &&
        (exContact.activeTicket.status === 'open' || exContact.activeTicket.status === 'pending')
      const newHasActiveTicket =
        c.ticket && (c.ticket.status === 'open' || c.ticket.status === 'pending')

      if (!hasActiveTicket && c.ticket) {
        exContact.activeTicket = {
          id: c.ticket.id,
          ticketNumber: c.ticket.ticketNumber,
          status: c.ticket.status,
        }
        exContact.conversationId = c.id
      } else if (newHasActiveTicket && !hasActiveTicket) {
        exContact.activeTicket = {
          id: c.ticket.id,
          ticketNumber: c.ticket.ticketNumber,
          status: c.ticket.status,
        }
        exContact.conversationId = c.id
      } else if (msgTime > exTime && !hasActiveTicket) {
        exContact.conversationId = c.id
        existing.lastMsgTime = msgTime
      }
    }
  }

  return Array.from(contactMap.values()).map((item) => item.contact)
}

export function ContactsDashboard({
  conversations,
  initialContacts,
  onStartChat,
}: ContactsDashboardProps) {
  const [contacts, setContacts] = useState<ContactItem[]>(() => {
    if (initialContacts && initialContacts.length > 0) return initialContacts

    if (conversations && conversations.length > 0) {
      return buildContactsFromConversations(conversations)
    }

    return DEFAULT_SEED_CONTACTS
  })

  useEffect(() => {
    if (initialContacts && initialContacts.length > 0) {
      setContacts(initialContacts)
      return
    }
    if (conversations && conversations.length > 0) {
      setContacts(buildContactsFromConversations(conversations))
    }
  }, [conversations, initialContacts])

  const [searchQuery, setSearchQuery] = useState('')
  const [filterTag, setFilterTag] = useState<'all' | 'whatsapp' | 'vip' | 'lead'>('all')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedContact, setSelectedContact] = useState<ContactItem | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formCompany, setFormCompany] = useState('')
  const [formTags, setFormTags] = useState('')
  const [formChannel, setFormChannel] = useState<'whatsapp' | 'website_widget' | 'api'>('whatsapp')

  // Filter contacts
  const filteredContacts = contacts.filter((c) => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchName = c.name.toLowerCase().includes(q)
      const matchPhone = c.phone?.toLowerCase().includes(q)
      const matchEmail = c.email?.toLowerCase().includes(q)
      const matchCompany = c.company?.toLowerCase().includes(q)
      if (!matchName && !matchPhone && !matchEmail && !matchCompany) return false
    }

    // Filter pill
    if (filterTag === 'whatsapp') {
      return c.channel === 'whatsapp'
    }
    if (filterTag === 'vip') {
      return c.tags?.some((t) => t.toLowerCase() === 'vip')
    }
    if (filterTag === 'lead') {
      return c.tags?.some((t) => t.toLowerCase() === 'lead')
    }

    return true
  })

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) return

    const newContact: ContactItem = {
      id: `contact-${Date.now()}`,
      name: formName.trim(),
      phone: formPhone.trim() || undefined,
      email: formEmail.trim() || undefined,
      company: formCompany.trim() || undefined,
      channel: formChannel,
      tags: formTags
        ? formTags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : ['Customer'],
    }

    setContacts((prev) => [newContact, ...prev])
    setIsAddModalOpen(false)
    setFormName('')
    setFormPhone('')
    setFormEmail('')
    setFormCompany('')
    setFormTags('')
  }

  return (
    <div
      data-testid="contacts-dashboard"
      className="flex-1 h-full bg-wa-header-bg overflow-y-auto flex flex-col font-sans select-none"
    >
      {/* Header Bar */}
      <header className="h-16 bg-white border-b border-wa-border px-6 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-wa-teal-primary/10 text-xl text-wa-teal-primary">
            👥
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-wa-text-primary">Kontak & CRM</h1>
              <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                {contacts.length} Kontak Terdaftar
              </span>
            </div>
            <p className="text-xs text-wa-text-secondary">
              Basis Data Pelanggan & Profil Omnichannel
            </p>
          </div>
        </div>

        <Button
          data-testid="add-contact-btn"
          variant="primary"
          size="sm"
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 font-bold cursor-pointer bg-wa-teal-primary hover:bg-wa-teal-dark text-white"
        >
          + Tambah Kontak
        </Button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto flex flex-col gap-5">
        {/* Search & Filter Toolbar */}
        <div className="bg-white rounded-2xl p-4 border border-wa-border shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="flex-1 max-w-md">
            <Input
              data-testid="contact-search-input"
              placeholder="Cari nama, no telepon, email, atau perusahaan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<span className="text-slate-400">🔍</span>}
            />
          </div>

          {/* Quick Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <button
              type="button"
              data-testid="filter-pill-all"
              onClick={() => setFilterTag('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors cursor-pointer whitespace-nowrap ${
                filterTag === 'all'
                  ? 'bg-wa-teal-primary text-white shadow-xs'
                  : 'bg-wa-header-bg text-wa-text-muted hover:bg-wa-border'
              }`}
            >
              Semua ({contacts.length})
            </button>

            <button
              type="button"
              data-testid="filter-pill-whatsapp"
              onClick={() => setFilterTag('whatsapp')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors cursor-pointer whitespace-nowrap ${
                filterTag === 'whatsapp'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-wa-header-bg text-wa-text-muted hover:bg-wa-border'
              }`}
            >
              WhatsApp
            </button>

            <button
              type="button"
              data-testid="filter-pill-vip"
              onClick={() => setFilterTag('vip')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors cursor-pointer whitespace-nowrap ${
                filterTag === 'vip'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-wa-header-bg text-wa-text-muted hover:bg-wa-border'
              }`}
            >
              VIP
            </button>

            <button
              type="button"
              data-testid="filter-pill-lead"
              onClick={() => setFilterTag('lead')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors cursor-pointer whitespace-nowrap ${
                filterTag === 'lead'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-wa-header-bg text-wa-text-muted hover:bg-wa-border'
              }`}
            >
              Leads
            </button>
          </div>
        </div>

        {/* Contacts Table Card */}
        <div className="bg-white rounded-2xl border border-wa-border shadow-xs overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-wa-text-primary divide-y divide-wa-border">
              <thead className="bg-wa-header-bg text-xs font-bold uppercase tracking-wider text-wa-text-muted">
                <tr>
                  <th className="py-3 px-4">Kontak</th>
                  <th className="py-3 px-4">Nomor HP / WhatsApp</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Perusahaan</th>
                  <th className="py-3 px-4">Tags & Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wa-header-bg bg-white">
                {filteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-wa-text-secondary text-sm">
                      Tidak ada kontak yang cocok dengan pencarian Anda.
                    </td>
                  </tr>
                ) : (
                  filteredContacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className="hover:bg-wa-search-bg transition-colors cursor-pointer"
                      onClick={() => setSelectedContact(contact)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelectedContact(contact)
                        }
                      }}
                      tabIndex={0}
                    >
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4 flex items-center gap-3">
                        <Avatar
                          name={contact.name}
                          src={contact.avatarUrl}
                          channel={contact.channel}
                          size="md"
                        />
                        <div>
                          <div className="font-bold text-sm text-wa-text-primary">
                            {contact.name}
                          </div>
                          <div className="text-[11px] text-wa-text-secondary">{contact.id}</div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-4 text-xs font-mono text-wa-text-muted">
                        {contact.phone || '-'}
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 text-xs text-wa-text-muted">
                        {contact.email || '-'}
                      </td>

                      {/* Company */}
                      <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                        {contact.company ? (
                          <span className="inline-flex items-center gap-1">
                            <span>🏢</span>
                            <span>{contact.company}</span>
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>

                      {/* Tags & Ticket */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {contact.tags?.map((t) => (
                            <span
                              key={t}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                t.toLowerCase() === 'vip'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : t.toLowerCase() === 'lead'
                                    ? 'bg-sky-50 text-sky-700 border-sky-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {t}
                            </span>
                          ))}
                          {contact.activeTicket && (
                            <Badge
                              variant={
                                contact.activeTicket.status === 'open' ? 'danger' : 'success'
                              }
                              size="sm"
                            >
                              #{contact.activeTicket.ticketNumber}
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            data-testid={`chat-contact-${contact.id}`}
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (onStartChat) {
                                onStartChat(contact.conversationId || 'conv-1')
                              }
                            }}
                            title="Buka Chat Percakapan"
                            className="text-xs font-semibold"
                          >
                            💬 Chat
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal: Tambah Kontak Baru */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="text-xl">👤</span>
                <h2 className="text-base font-bold text-slate-800">Tambah Kontak Baru</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddContact} className="p-6 space-y-3.5">
              <div>
                <label
                  htmlFor="contact-name"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nama Lengkap *
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: Rina Kusuma"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-wa-teal-primary focus:outline-hidden"
                />
              </div>

              <div>
                <label
                  htmlFor="contact-phone"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nomor HP / WhatsApp
                </label>
                <input
                  id="contact-phone"
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+6281234567890"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-wa-teal-primary focus:outline-hidden"
                />
              </div>

              <div>
                <label
                  htmlFor="contact-email"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Email
                </label>
                <input
                  id="contact-email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="rina@perusahaan.com"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-wa-teal-primary focus:outline-hidden"
                />
              </div>

              <div>
                <label
                  htmlFor="contact-company"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nama Perusahaan / Organisasi
                </label>
                <input
                  id="contact-company"
                  type="text"
                  value={formCompany}
                  onChange={(e) => setFormCompany(e.target.value)}
                  placeholder="PT Sinar Gemilang"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-wa-teal-primary focus:outline-hidden"
                />
              </div>

              <div>
                <label
                  htmlFor="contact-channel"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Saluran Komunikasi Utama
                </label>
                <select
                  id="contact-channel"
                  value={formChannel}
                  onChange={(e) =>
                    setFormChannel(e.target.value as 'whatsapp' | 'website_widget' | 'api')
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-wa-teal-primary focus:outline-hidden bg-white"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="website_widget">Live Chat Widget</option>
                  <option value="api">API / Integrasi</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="contact-tags"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Label / Tags (pisahkan dengan koma)
                </label>
                <input
                  id="contact-tags"
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="VIP, Pelanggan, Verified"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-wa-teal-primary focus:outline-hidden"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="bg-wa-teal-primary hover:bg-wa-teal-dark text-white font-bold"
                >
                  Simpan Kontak
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail Kontak Saat Row Diklik */}
      {selectedContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 border border-slate-100 flex flex-col items-center text-center">
            <button
              type="button"
              onClick={() => setSelectedContact(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              ✕
            </button>
            <Avatar
              name={selectedContact.name}
              src={selectedContact.avatarUrl}
              channel={selectedContact.channel}
              size="xl"
              className="mb-3"
            />
            <h3 className="font-bold text-lg text-wa-text-primary">{selectedContact.name}</h3>
            {selectedContact.company && (
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                🏢 {selectedContact.company}
              </p>
            )}
            <div className="mt-4 w-full text-left space-y-2 text-xs border-t border-slate-100 pt-3">
              <div className="flex justify-between text-slate-600">
                <span className="font-semibold">Telepon:</span>
                <span className="font-mono">{selectedContact.phone || '-'}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="font-semibold">Email:</span>
                <span>{selectedContact.email || '-'}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="font-semibold">Saluran:</span>
                <span className="capitalize">{selectedContact.channel.replace('_', ' ')}</span>
              </div>
            </div>
            <div className="mt-6 flex w-full gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedContact(null)}
                className="flex-1"
              >
                Tutup
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const convId = selectedContact.conversationId || 'conv-1'
                  setSelectedContact(null)
                  if (onStartChat) onStartChat(convId)
                }}
                className="flex-1 bg-wa-teal-primary hover:bg-wa-teal-dark text-white font-bold"
              >
                💬 Buka Chat
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ContactsDashboard
