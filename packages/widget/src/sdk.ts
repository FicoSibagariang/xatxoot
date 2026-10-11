import type {
  ResolvedWidgetConfig,
  WidgetConfig,
  WidgetEventHandler,
  WidgetEventType,
  WidgetMessageResponse,
  WidgetUser,
} from './types'

export const MAX_WIDGET_BUNDLE_GZIP_BYTES = 80 * 1024 // 80 KB gzipped budget

export const DEFAULT_WIDGET_CONFIG: Omit<ResolvedWidgetConfig, 'websiteToken'> = {
  baseUrl: '',
  title: 'Live Chat',
  primaryColor: '#00a884',
  position: 'right',
  welcomeMessage: 'Halo! Ada yang bisa kami bantu?',
}

export class WidgetSDK {
  private config: ResolvedWidgetConfig
  private opened = false
  private unreadCount = 0
  private user: WidgetUser | null = null
  private customAttributes: Record<string, unknown> = {}
  private listeners = new Map<string, Set<WidgetEventHandler>>()

  constructor(config: WidgetConfig) {
    if (
      !config?.websiteToken ||
      typeof config.websiteToken !== 'string' ||
      !config.websiteToken.trim()
    ) {
      throw new Error('websiteToken is required')
    }

    this.config = {
      websiteToken: config.websiteToken.trim(),
      baseUrl: config.baseUrl?.trim() || DEFAULT_WIDGET_CONFIG.baseUrl,
      title: config.title?.trim() || DEFAULT_WIDGET_CONFIG.title,
      primaryColor: config.primaryColor?.trim() || DEFAULT_WIDGET_CONFIG.primaryColor,
      position: config.position || DEFAULT_WIDGET_CONFIG.position,
      welcomeMessage: config.welcomeMessage?.trim() || DEFAULT_WIDGET_CONFIG.welcomeMessage,
    }
  }

  getConfig(): ResolvedWidgetConfig {
    return { ...this.config }
  }

  isOpen(): boolean {
    return this.opened
  }

  open(): void {
    if (!this.opened) {
      this.opened = true
      this.emit('open')
    }
  }

  close(): void {
    if (this.opened) {
      this.opened = false
      this.emit('close')
    }
  }

  toggle(): void {
    if (this.opened) {
      this.close()
    } else {
      this.open()
    }
  }

  getUser(): WidgetUser | null {
    return this.user ? { ...this.user } : null
  }

  setUser(user: WidgetUser): void {
    this.user = { ...user }
  }

  getCustomAttributes(): Record<string, unknown> {
    return { ...this.customAttributes }
  }

  setCustomAttributes(attributes: Record<string, unknown>): void {
    this.customAttributes = { ...this.customAttributes, ...attributes }
  }

  getUnreadCount(): number {
    return this.unreadCount
  }

  setUnreadCount(count: number): void {
    this.unreadCount = Math.max(0, count)
    this.emit('unread', this.unreadCount)
  }

  reset(): void {
    this.opened = false
    this.unreadCount = 0
    this.user = null
    this.customAttributes = {}
  }

  on(event: WidgetEventType | string, handler: WidgetEventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)?.add(handler)

    return () => {
      this.off(event, handler)
    }
  }

  off(event: WidgetEventType | string, handler: WidgetEventHandler): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.listeners.delete(event)
      }
    }
  }

  buildStreamUrl(sessionId: string): string {
    const cleanBase = this.config.baseUrl ? this.config.baseUrl.replace(/\/+$/, '') : ''
    const path = '/api/v1/widget/stream'
    const fullPath = cleanBase ? `${cleanBase}${path}` : path
    const params = new URLSearchParams({
      website_token: this.config.websiteToken,
      session_id: sessionId,
    })
    return `${fullPath}?${params.toString()}`
  }

  async sendMessage(content: string, sessionId?: string): Promise<WidgetMessageResponse> {
    const cleanBase = this.config.baseUrl ? this.config.baseUrl.replace(/\/+$/, '') : ''
    const path = '/api/v1/widget/messages'
    const fullPath = cleanBase ? `${cleanBase}${path}` : path

    const effectiveSessionId = sessionId || `visitor_${Date.now()}`
    const payload = {
      website_token: this.config.websiteToken,
      session_id: effectiveSessionId,
      content,
      contact: this.user || undefined,
    }

    const response = await fetch(fullPath, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Gagal mengirim pesan' }))
      throw new Error((err as { error?: string }).error || 'Gagal mengirim pesan')
    }

    const result = (await response.json()) as WidgetMessageResponse
    this.emit('message.sent', result)
    return result
  }

  private emit(event: string, data?: unknown): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      for (const handler of handlers) {
        handler(data)
      }
    }
  }
}

export function createWidgetSDK(config: WidgetConfig): WidgetSDK {
  const sdk = new WidgetSDK(config)
  ;(globalThis as { $xatxoot?: WidgetSDK }).$xatxoot = sdk
  return sdk
}
