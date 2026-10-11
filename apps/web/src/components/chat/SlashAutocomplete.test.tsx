import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ConversationThread } from '../layout/WhatsAppLayout'
import type { ConversationItem } from '../layout/types'
import {
  type AutocompleteEntry,
  type CannedItem,
  type CommandItem,
  SlashAutocompletePopup,
  applyAutocompleteSelection,
  detectSlashQuery,
  filterAutocompleteEntries,
} from './SlashAutocomplete'

describe('Slash Autocomplete Popup Component (Task 2.17 - apps/web)', () => {
  const mockCannedResponses: CannedItem[] = [
    {
      id: 'canned-1',
      shortCode: 'halo',
      content: 'Halo kak! Selamat datang di layanan kami. Ada yang bisa kami bantu hari ini?',
      title: 'Salam Pembuka',
    },
    {
      id: 'canned-2',
      shortCode: 'ongkir',
      content: 'Estimasi ongkir dapat dicek setelah menginformasikan kecamatan dan kota tujuan.',
      title: 'Cek Ongkos Kirim',
    },
    {
      id: 'canned-3',
      shortCode: 'terimakasih',
      content: 'Terima kasih telah menghubungi kami. Semoga harimu menyenangkan!',
      title: 'Ucapan Penutup',
    },
  ]

  const mockSlashCommands: CommandItem[] = [
    {
      id: 'cmd-1',
      name: 'cekresi',
      description: 'Lacak pengiriman kurir ekspedisi secara real-time',
      endpointUrl: 'https://api.external.com/courier/track',
    },
    {
      id: 'cmd-2',
      name: 'statusorder',
      description: 'Cek rincian status transaksi e-commerce',
      endpointUrl: 'https://api.external.com/orders/status',
    },
    {
      id: 'cmd-3',
      name: 'refund',
      description: 'Ajukan klaim refund dana pelanggan',
      endpointUrl: 'https://api.external.com/orders/refund',
    },
  ]

  describe('detectSlashQuery Helper', () => {
    it('should return isActive false for empty string or normal text without slash', () => {
      expect(detectSlashQuery('')).toEqual({ isActive: false, query: '', startIndex: -1 })
      expect(detectSlashQuery('Halo selamat pagi')).toEqual({
        isActive: false,
        query: '',
        startIndex: -1,
      })
      expect(detectSlashQuery('https://website.com/link')).toEqual({
        isActive: false,
        query: '',
        startIndex: -1,
      })
    })

    it('should detect leading slash as active query', () => {
      expect(detectSlashQuery('/')).toEqual({ isActive: true, query: '', startIndex: 0 })
      expect(detectSlashQuery('/halo')).toEqual({ isActive: true, query: 'halo', startIndex: 0 })
      expect(detectSlashQuery('/cekresi')).toEqual({
        isActive: true,
        query: 'cekresi',
        startIndex: 0,
      })
    })

    it('should detect slash command following space in sentence', () => {
      const result = detectSlashQuery('Halo kak, silakan ketik /ong')
      expect(result).toEqual({ isActive: true, query: 'ong', startIndex: 24 })
    })
  })

  describe('filterAutocompleteEntries Helper', () => {
    it('should return all canned responses and commands when query is empty', () => {
      const entries = filterAutocompleteEntries(mockCannedResponses, mockSlashCommands, '')
      expect(entries.length).toBe(mockCannedResponses.length + mockSlashCommands.length)
      expect(entries.some((e) => e.type === 'canned' && e.shortCode === 'halo')).toBe(true)
      expect(entries.some((e) => e.type === 'command' && e.name === 'cekresi')).toBe(true)
    })

    it('should filter entries matching canned shortCode or content', () => {
      const entries = filterAutocompleteEntries(mockCannedResponses, mockSlashCommands, 'ongkir')
      expect(entries.length).toBe(1)
      expect(entries[0].type).toBe('canned')
      if (entries[0].type === 'canned') {
        expect(entries[0].shortCode).toBe('ongkir')
      }
    })

    it('should filter entries matching command name or description', () => {
      const entries = filterAutocompleteEntries(mockCannedResponses, mockSlashCommands, 'resi')
      expect(entries.length).toBe(1)
      expect(entries[0].type).toBe('command')
      if (entries[0].type === 'command') {
        expect(entries[0].name).toBe('cekresi')
      }
    })

    it('should return empty array if no match is found', () => {
      const entries = filterAutocompleteEntries(mockCannedResponses, mockSlashCommands, 'zzzzzxyz')
      expect(entries).toEqual([])
    })
  })

  describe('applyAutocompleteSelection Helper', () => {
    it('should replace slash token with canned response content', () => {
      const cannedEntry: AutocompleteEntry = {
        type: 'canned',
        id: 'canned-1',
        shortCode: 'halo',
        content: 'Halo kak! Selamat datang di layanan kami.',
      }

      const replacedLeading = applyAutocompleteSelection('/ha', 0, cannedEntry)
      expect(replacedLeading).toBe('Halo kak! Selamat datang di layanan kami.')

      const replacedInline = applyAutocompleteSelection('Budi, /ha', 6, cannedEntry)
      expect(replacedInline).toBe('Budi, Halo kak! Selamat datang di layanan kami.')
    })

    it('should replace slash token with slash command name followed by a space', () => {
      const commandEntry: AutocompleteEntry = {
        type: 'command',
        id: 'cmd-1',
        name: 'cekresi',
        description: 'Lacak pengiriman',
      }

      const replacedLeading = applyAutocompleteSelection('/cek', 0, commandEntry)
      expect(replacedLeading).toBe('/cekresi ')

      const replacedInline = applyAutocompleteSelection('Coba jalankan /cek', 14, commandEntry)
      expect(replacedInline).toBe('Coba jalankan /cekresi ')
    })
  })

  describe('SlashAutocompletePopup Component Rendering', () => {
    it('should not render anything when isOpen is false', () => {
      const entries: AutocompleteEntry[] = [
        {
          type: 'canned',
          id: 'canned-1',
          shortCode: 'halo',
          content: 'Halo kak!',
        },
      ]

      const html = renderToStaticMarkup(
        <SlashAutocompletePopup
          isOpen={false}
          query="ha"
          entries={entries}
          selectedIndex={0}
          onSelect={() => {}}
        />,
      )

      expect(html).not.toContain('data-testid="slash-autocomplete-popup"')
    })

    it('should render floating popup with canned and command badges when isOpen is true', () => {
      const entries: AutocompleteEntry[] = [
        {
          type: 'canned',
          id: 'canned-1',
          shortCode: 'halo',
          content: 'Halo kak! Selamat datang di layanan kami.',
          title: 'Salam Pembuka',
        },
        {
          type: 'command',
          id: 'cmd-1',
          name: 'cekresi',
          description: 'Lacak resi kurir',
        },
      ]

      const html = renderToStaticMarkup(
        <SlashAutocompletePopup
          isOpen={true}
          query=""
          entries={entries}
          selectedIndex={1}
          onSelect={() => {}}
        />,
      )

      expect(html).toContain('data-testid="slash-autocomplete-popup"')
      expect(html).toContain('data-testid="autocomplete-list"')
      expect(html).toContain('data-testid="autocomplete-item-canned-1"')
      expect(html).toContain('data-testid="autocomplete-item-cmd-1"')

      // Monospace shortcuts
      expect(html).toContain('/halo')
      expect(html).toContain('/cekresi')

      // Badges
      expect(html).toContain('Balasan Cepat')
      expect(html).toContain('Slash Command')

      // Selected indicator on index 1
      expect(html).toContain('data-selected="true"')
    })

    it('should render empty state when entries is empty', () => {
      const html = renderToStaticMarkup(
        <SlashAutocompletePopup
          isOpen={true}
          query="xyztidakada"
          entries={[]}
          selectedIndex={0}
          onSelect={() => {}}
        />,
      )

      expect(html).toContain('data-testid="slash-autocomplete-popup"')
      expect(html).toContain('data-testid="autocomplete-empty-state"')
      expect(html).toContain('xyztidakada')
    })
  })

  describe('Integration with ConversationThread', () => {
    const mockConversation: ConversationItem = {
      id: 'conv-1',
      contactName: 'Budi Santoso',
      contactPhone: '+6281234567890',
      channel: 'whatsapp',
      lastMessage: 'Halo',
      lastMessageTimestamp: '10:00',
      ticket: {
        id: 't-1',
        ticketNumber: 'T-101',
        status: 'open',
        priority: 'high',
      },
    }

    it('should accept cannedResponses and slashCommands props in ConversationThread', () => {
      const html = renderToStaticMarkup(
        <ConversationThread
          conversation={mockConversation}
          isDrawerOpen={false}
          cannedResponses={mockCannedResponses}
          slashCommands={mockSlashCommands}
          onToggleDrawer={() => {}}
          onSendMessage={() => {}}
          onAssignTicket={() => {}}
          onResolveTicket={() => {}}
        />,
      )

      expect(html).toContain('data-testid="conversation-thread"')
      expect(html).toContain('data-testid="thread-input-bar"')
      // Composer input element present with placeholder
      expect(html).toContain('placeholder="Ketik pesan atau ketik / untuk balasan cepat..."')
    })
  })
})
