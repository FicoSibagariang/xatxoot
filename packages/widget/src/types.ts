export type WidgetPosition = 'left' | 'right'

export interface WidgetConfig {
  websiteToken: string
  baseUrl?: string
  title?: string
  primaryColor?: string
  position?: WidgetPosition
  welcomeMessage?: string
}

export interface ResolvedWidgetConfig {
  websiteToken: string
  baseUrl: string
  title: string
  primaryColor: string
  position: WidgetPosition
  welcomeMessage: string
}

export interface WidgetUser {
  name?: string
  email?: string
  phone?: string
  avatarUrl?: string
  identifierHash?: string
}

export type WidgetEventType = 'open' | 'close' | 'unread' | 'message.sent' | 'message.received'
export type WidgetEventHandler = (data?: unknown) => void
