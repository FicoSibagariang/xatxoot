import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { WidgetSDK, renderWidgetStaticMarkup } from './index'

describe('Widget Customization according to Inbox Settings (Task 1.31 - packages/widget)', () => {
  beforeEach(() => {
    globalThis.$xatxoot = undefined
  })

  afterEach(() => {
    globalThis.$xatxoot = undefined
  })

  describe('Local Runtime Customization (applyConfig)', () => {
    it('should dynamically update widget primaryColor and title', () => {
      const sdk = new WidgetSDK({
        websiteToken: 'tok-custom-1',
        title: 'Customer Service',
        primaryColor: '#00a884',
      })

      const onConfigUpdated = mock()
      sdk.on('config.updated', onConfigUpdated)

      sdk.applyConfig({
        title: 'Bantuan CS VIP',
        primaryColor: '#9333ea', // Ungu
        welcomeMessage: 'Halo pelanggan setia! Ada yang bisa kami bantu hari ini?',
      })

      const config = sdk.getConfig()
      expect(config.title).toBe('Bantuan CS VIP')
      expect(config.primaryColor).toBe('#9333ea')
      expect(config.welcomeMessage).toBe('Halo pelanggan setia! Ada yang bisa kami bantu hari ini?')
      expect(onConfigUpdated).toHaveBeenCalledWith(config)
    })

    it('should reflect customized color and title in rendered markup', () => {
      const sdk = new WidgetSDK({
        websiteToken: 'tok-custom-1',
      })

      sdk.applyConfig({
        title: 'Dukungan Toko ABC',
        primaryColor: '#e11d48', // Merah mawar
      })
      sdk.open()

      const html = renderWidgetStaticMarkup(sdk)
      expect(html).toContain('Dukungan Toko ABC')
      expect(html).toContain('background-color: #e11d48')
    })
  })

  describe('Remote Inbox Configuration Sync (fetchRemoteConfig)', () => {
    it('should fetch inbox config from API and sync color and title', async () => {
      const sdk = new WidgetSDK({
        websiteToken: 'tok-inbox-live',
        baseUrl: 'https://api.xatxoot.com',
      })

      const onConfigUpdated = mock()
      sdk.on('config.updated', onConfigUpdated)

      // Mock remote endpoint /api/v1/widget/config
      const originalFetch = globalThis.fetch
      globalThis.fetch = mock(async (url: string | URL | Request) => {
        expect(url.toString()).toContain('/api/v1/widget/config?website_token=tok-inbox-live')
        return new Response(
          JSON.stringify({
            inboxId: 'inb-123',
            name: 'Pusat Bantuan WhatsApp & Web',
            widgetColor: '#2563eb', // Biru
            replyTime: 'in_a_few_minutes',
            greetingEnabled: true,
            greetingMessage: 'Selamat pagi! Ada yang bisa tim kami bantu?',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }) as unknown as typeof fetch

      const syncedConfig = await sdk.fetchRemoteConfig()

      expect(syncedConfig.title).toBe('Pusat Bantuan WhatsApp & Web')
      expect(syncedConfig.primaryColor).toBe('#2563eb')
      expect(syncedConfig.welcomeMessage).toBe('Selamat pagi! Ada yang bisa tim kami bantu?')
      expect(onConfigUpdated).toHaveBeenCalledWith(syncedConfig)

      globalThis.fetch = originalFetch
    })

    it('should throw an error if fetchRemoteConfig fails', async () => {
      const sdk = new WidgetSDK({
        websiteToken: 'invalid-tok',
        baseUrl: 'https://api.xatxoot.com',
      })

      const originalFetch = globalThis.fetch
      globalThis.fetch = mock(async () => {
        return new Response(JSON.stringify({ error: 'Inbox tidak ditemukan' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }) as unknown as typeof fetch

      expect(sdk.fetchRemoteConfig()).rejects.toThrow('Inbox tidak ditemukan')

      globalThis.fetch = originalFetch
    })
  })
})
