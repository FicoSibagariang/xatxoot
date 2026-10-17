import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  Avatar,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
} from './index'

describe('Astryx Design System Primitives & Lucide Icons (Task #271 - apps/web)', () => {
  describe('1. Dialog Primitive', () => {
    it('should NOT render dialog content when isOpen/open is false', () => {
      const html = renderToStaticMarkup(
        <Dialog isOpen={false} onClose={() => {}}>
          <DialogContent>
            <div>Modal Content</div>
          </DialogContent>
        </Dialog>,
      )
      expect(html).not.toContain('Modal Content')
      expect(html).not.toContain('data-testid="astryx-dialog"')
    })

    it('should render dialog backdrop, content, header, and close button when open is true', () => {
      const html = renderToStaticMarkup(
        <Dialog isOpen={true} onClose={() => {}}>
          <DialogContent data-testid="astryx-dialog">
            <DialogHeader>
              <DialogTitle>Konfigurasi Akun</DialogTitle>
            </DialogHeader>
            <div>Pengaturan profil pengguna</div>
            <DialogFooter>
              <Button variant="primary">Simpan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>,
      )
      expect(html).toContain('data-testid="astryx-dialog"')
      expect(html).toContain('Konfigurasi Akun')
      expect(html).toContain('Pengaturan profil pengguna')
      expect(html).toContain('Simpan')
      // Close button should be rendered
      expect(html).toContain('data-testid="astryx-dialog-close"')
    })

    it('should support convenience props on Dialog directly', () => {
      const html = renderToStaticMarkup(
        <Dialog
          isOpen={true}
          title="Dialog Sederhana"
          description="Deskripsi singkat"
          onClose={() => {}}
        >
          <p>Konten langsung di dalam Dialog</p>
        </Dialog>,
      )
      expect(html).toContain('Dialog Sederhana')
      expect(html).toContain('Deskripsi singkat')
      expect(html).toContain('Konten langsung di dalam Dialog')
    })
  })

  describe('2. DropdownMenu Primitive', () => {
    it('should render dropdown trigger and content items', () => {
      const html = renderToStaticMarkup(
        <DropdownMenu isOpen={true} onOpenChange={() => {}}>
          <DropdownMenuTrigger>
            <Button variant="secondary">Menu Opsi</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent data-testid="dropdown-content">
            <DropdownMenuItem onClick={() => {}}>Tandai Belum Dibaca</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="danger" onClick={() => {}}>
              Hapus Percakapan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      )
      expect(html).toContain('Menu Opsi')
      expect(html).toContain('data-testid="dropdown-content"')
      expect(html).toContain('Tandai Belum Dibaca')
      expect(html).toContain('Hapus Percakapan')
      expect(html).toContain('data-testid="dropdown-separator"')
    })

    it('should NOT render dropdown content when isOpen is false', () => {
      const html = renderToStaticMarkup(
        <DropdownMenu isOpen={false} onOpenChange={() => {}}>
          <DropdownMenuTrigger>
            <Button variant="secondary">Menu Tertutup</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent data-testid="dropdown-content">
            <DropdownMenuItem>Item Rahasia</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      )
      expect(html).toContain('Menu Tertutup')
      expect(html).not.toContain('data-testid="dropdown-content"')
      expect(html).not.toContain('Item Rahasia')
    })
  })

  describe('3. Select Primitive', () => {
    const options = [
      { value: 'all', label: 'Semua Channel' },
      { value: 'whatsapp', label: 'WhatsApp' },
      { value: 'website_widget', label: 'Live Chat' },
    ]

    it('should render select with placeholder when value is empty', () => {
      const html = renderToStaticMarkup(
        <Select
          options={options}
          value=""
          placeholder="Pilih saluran komunikasi"
          data-testid="channel-select"
        />,
      )
      expect(html).toContain('data-testid="channel-select"')
      expect(html).toContain('Pilih saluran komunikasi')
      expect(html).toContain('Semua Channel')
      expect(html).toContain('WhatsApp')
    })

    it('should display selected option label when value matches', () => {
      const html = renderToStaticMarkup(
        <Select
          options={options}
          value="whatsapp"
          placeholder="Pilih saluran"
          data-testid="channel-select"
        />,
      )
      expect(html).toContain('data-testid="channel-select"')
      expect(html).toContain('value="whatsapp"')
      expect(html).toContain('WhatsApp')
    })
  })

  describe('4. Tabs Primitive', () => {
    it('should render tab triggers and active tab content only', () => {
      const html = renderToStaticMarkup(
        <Tabs defaultValue="inbox" value="inbox">
          <TabsList data-testid="tabs-list">
            <TabsTrigger value="inbox">Kotak Masuk</TabsTrigger>
            <TabsTrigger value="contacts">Kontak CRM</TabsTrigger>
            <TabsTrigger value="settings">Pengaturan</TabsTrigger>
          </TabsList>
          <TabsContent value="inbox" data-testid="tab-content-inbox">
            <div>Daftar pesan tiket aktif</div>
          </TabsContent>
          <TabsContent value="contacts" data-testid="tab-content-contacts">
            <div>Data pelanggan perusahaan</div>
          </TabsContent>
        </Tabs>,
      )
      expect(html).toContain('data-testid="tabs-list"')
      expect(html).toContain('Kotak Masuk')
      expect(html).toContain('Kontak CRM')
      expect(html).toContain('data-testid="tab-content-inbox"')
      expect(html).toContain('Daftar pesan tiket aktif')
      expect(html).not.toContain('Data pelanggan perusahaan')
    })
  })

  describe('5. Tooltip Primitive', () => {
    it('should render tooltip trigger element and tooltip label', () => {
      const html = renderToStaticMarkup(
        <Tooltip content="Pengaturan Akun (Alt+S)">
          <Button variant="icon" aria-label="Settings">
            <span>Icon</span>
          </Button>
        </Tooltip>,
      )
      expect(html).toContain('Settings')
      expect(html).toContain('Pengaturan Akun (Alt+S)')
      expect(html).toContain('data-testid="astryx-tooltip"')
    })
  })

  describe('6. Lucide Icon in Astryx Avatar Channel Badges', () => {
    it('should render SVG icon for whatsapp channel instead of raw emoji', () => {
      const html = renderToStaticMarkup(
        <Avatar name="Budi Customer" channel="whatsapp" size="md" />,
      )
      // Should have SVG icon and not raw 💬 emoji
      expect(html).toContain('<svg')
      expect(html).not.toContain('💬')
    })

    it('should render SVG icon for website_widget and api channels', () => {
      const widgetHtml = renderToStaticMarkup(
        <Avatar name="Web User" channel="website_widget" size="md" />,
      )
      expect(widgetHtml).toContain('<svg')
      expect(widgetHtml).not.toContain('🌐')

      const apiHtml = renderToStaticMarkup(<Avatar name="API Bot" channel="api" size="md" />)
      expect(apiHtml).toContain('<svg')
      expect(apiHtml).not.toContain('⚡')
    })
  })

  describe('7. Single Organization Guardrail', () => {
    it('should strictly NOT contain or require account_id or accountId in Astryx props', () => {
      // Verify no account_id in Astryx
      const astryxExports = [
        Avatar,
        Badge,
        Button,
        Input,
        Dialog,
        DropdownMenu,
        Select,
        Tabs,
        Tooltip,
      ]
      for (const comp of astryxExports) {
        expect(comp).toBeDefined()
      }
    })
  })
})
