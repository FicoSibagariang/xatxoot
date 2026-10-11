import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import {
  MAX_WIDGET_BUNDLE_GZIP_BYTES,
  WidgetSDK,
  createWidgetSDK,
  renderWidgetStaticMarkup,
} from './index'
import type { WidgetConfig, WidgetUser } from './types'

declare global {
  var $xatxoot: WidgetSDK | undefined
}

describe('Website Live Chat Widget Scaffold (Task 1.29 - packages/widget)', () => {
  beforeEach(() => {
    // Reset global $xatxoot before each test
    globalThis.$xatxoot = undefined
  })

  afterEach(() => {
    globalThis.$xatxoot = undefined
  })

  describe('Configuration & Initialization', () => {
    it('should throw an error if websiteToken is missing or empty', () => {
      expect(() => {
        new WidgetSDK({ websiteToken: '' })
      }).toThrow('websiteToken is required')

      expect(() => {
        new WidgetSDK({} as unknown as WidgetConfig)
      }).toThrow('websiteToken is required')
    })

    it('should apply default configuration options', () => {
      const sdk = new WidgetSDK({ websiteToken: 'web-tok-123' })
      const config = sdk.getConfig()

      expect(config.websiteToken).toBe('web-tok-123')
      expect(config.title).toBe('Live Chat')
      expect(config.primaryColor).toBe('#00a884')
      expect(config.position).toBe('right')
      expect(config.welcomeMessage).toContain('Ada yang bisa kami bantu?')
      expect(config.baseUrl).toBe('')
    })

    it('should allow overriding default options', () => {
      const customConfig: WidgetConfig = {
        websiteToken: 'custom-tok-456',
        baseUrl: 'https://support.xatxoot.com',
        title: 'Bantuan Pelanggan',
        primaryColor: '#2563eb',
        position: 'left',
        welcomeMessage: 'Selamat datang di layanan kami!',
      }

      const sdk = new WidgetSDK(customConfig)
      const config = sdk.getConfig()

      expect(config.title).toBe('Bantuan Pelanggan')
      expect(config.primaryColor).toBe('#2563eb')
      expect(config.position).toBe('left')
      expect(config.baseUrl).toBe('https://support.xatxoot.com')
      expect(config.welcomeMessage).toBe('Selamat datang di layanan kami!')
    })

    it('createWidgetSDK helper should attach instance to window.$xatxoot', () => {
      const sdk = createWidgetSDK({ websiteToken: 'tok-global-99' })

      expect(globalThis.$xatxoot).toBeDefined()
      expect(globalThis.$xatxoot?.isOpen()).toBe(false)
      expect(globalThis.$xatxoot?.getConfig().websiteToken).toBe('tok-global-99')
      expect(sdk).toBe(globalThis.$xatxoot)
    })
  })

  describe('SDK Lifecycle & State Controls', () => {
    it('should toggle, open, and close widget state', () => {
      const sdk = new WidgetSDK({ websiteToken: 'tok-123' })

      expect(sdk.isOpen()).toBe(false)

      sdk.open()
      expect(sdk.isOpen()).toBe(true)

      sdk.close()
      expect(sdk.isOpen()).toBe(false)

      sdk.toggle()
      expect(sdk.isOpen()).toBe(true)

      sdk.toggle()
      expect(sdk.isOpen()).toBe(false)
    })

    it('should dispatch open and close events to registered listeners', () => {
      const sdk = new WidgetSDK({ websiteToken: 'tok-123' })
      const onOpen = mock()
      const onClose = mock()

      const unregisterOpen = sdk.on('open', onOpen)
      const unregisterClose = sdk.on('close', onClose)

      sdk.open()
      expect(onOpen).toHaveBeenCalledTimes(1)
      expect(onClose).toHaveBeenCalledTimes(0)

      sdk.close()
      expect(onClose).toHaveBeenCalledTimes(1)

      // Test unsubscribe
      unregisterOpen()
      sdk.open()
      expect(onOpen).toHaveBeenCalledTimes(1) // Still 1 because unsubscribed
      unregisterClose()
    })

    it('should manage authenticated/identified user state', () => {
      const sdk = new WidgetSDK({ websiteToken: 'tok-123' })
      expect(sdk.getUser()).toBeNull()

      const user: WidgetUser = {
        name: 'Rian Pratama',
        email: 'rian@example.com',
        phone: '+62811223344',
      }

      sdk.setUser(user)
      expect(sdk.getUser()).toEqual(user)

      sdk.setCustomAttributes({ membership: 'gold', orders: 12 })
      expect(sdk.getCustomAttributes()).toEqual({ membership: 'gold', orders: 12 })

      sdk.reset()
      expect(sdk.getUser()).toBeNull()
      expect(sdk.getCustomAttributes()).toEqual({})
      expect(sdk.isOpen()).toBe(false)
    })
  })

  describe('Widget DOM Rendering & Components', () => {
    it('should render launcher button with primaryColor and position styles', () => {
      const sdk = new WidgetSDK({
        websiteToken: 'tok-123',
        primaryColor: '#10b981',
        position: 'right',
      })

      const html = renderWidgetStaticMarkup(sdk)

      expect(html).toContain('data-testid="widget-launcher-btn"')
      expect(html).toContain('data-position="right"')
      expect(html).toContain('background-color: #10b981')
      // Closed state: chat window should not be displayed
      expect(html).not.toContain('data-testid="widget-chat-window"')
    })

    it('should render open chat window container with title and welcome message when open', () => {
      const sdk = new WidgetSDK({
        websiteToken: 'tok-123',
        title: 'Bantuan Xatxoot',
        welcomeMessage: 'Halo sahabat! Ada pertanyaan seputar pemesanan?',
      })

      sdk.open()
      const html = renderWidgetStaticMarkup(sdk)

      expect(html).toContain('data-testid="widget-chat-window"')
      expect(html).toContain('Bantuan Xatxoot')
      expect(html).toContain('Halo sahabat! Ada pertanyaan seputar pemesanan?')
      expect(html).toContain('data-testid="widget-message-input"')
      expect(html).toContain('data-testid="widget-send-btn"')
    })

    it('should render unread badge on launcher when unreadCount > 0', () => {
      const sdk = new WidgetSDK({ websiteToken: 'tok-123' })
      sdk.setUnreadCount(3)

      const html = renderWidgetStaticMarkup(sdk)
      expect(html).toContain('data-testid="widget-unread-badge"')
      expect(html).toContain('>3<')
    })
  })

  describe('Widget Communication API Client (Task 1.30)', () => {
    it('should build proper widget SSE stream URL', () => {
      const sdk = new WidgetSDK({
        websiteToken: 'tok-web-88',
        baseUrl: 'https://api.xatxoot.com',
      })

      const streamUrl = sdk.buildStreamUrl('session-xyz')
      expect(streamUrl).toBe(
        'https://api.xatxoot.com/api/v1/widget/stream?website_token=tok-web-88&session_id=session-xyz',
      )
    })

    it('should send visitor message and emit message.sent event', async () => {
      const sdk = new WidgetSDK({
        websiteToken: 'tok-web-88',
        baseUrl: 'http://localhost:3000',
      })

      const onMessageSent = mock()
      sdk.on('message.sent', onMessageSent)

      // Mock global fetch
      const originalFetch = globalThis.fetch
      globalThis.fetch = mock(async () => {
        return new Response(
          JSON.stringify({
            success: true,
            session_id: 'session-xyz',
            conversation_id: 'conv-101',
            message: { id: 'msg-1', content: 'Halo kak' },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        )
      }) as unknown as typeof fetch

      const res = await sdk.sendMessage('Halo kak', 'session-xyz')
      expect(res.success).toBe(true)
      expect(res.conversation_id).toBe('conv-101')
      expect(onMessageSent).toHaveBeenCalledWith(res)

      globalThis.fetch = originalFetch
    })
  })

  describe('Bundle Constraints & Overhead Guard', () => {
    it('should enforce maximum bundle budget of 80 KB gzipped', () => {
      expect(MAX_WIDGET_BUNDLE_GZIP_BYTES).toBe(80 * 1024)
      expect(MAX_WIDGET_BUNDLE_GZIP_BYTES).toBe(81920)
    })
  })
})
