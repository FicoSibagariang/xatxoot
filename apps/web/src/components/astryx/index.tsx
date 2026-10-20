import { Globe, MessageSquare, Zap } from 'lucide-react'
import type React from 'react'

// --- Export new Astryx Primitives ---
export * from './Dialog'
export * from './DropdownMenu'
export * from './Select'
export * from './Tabs'
export * from './Tooltip'

// --- Avatar Primitive ---
export interface AvatarProps {
  src?: string
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  presence?: 'online' | 'busy' | 'offline'
  channel?: 'whatsapp' | 'website_widget' | 'api'
  className?: string
}

export function Avatar({ src, name, size = 'md', presence, channel, className = '' }: AvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  }

  const initial = name ? name.trim().charAt(0).toUpperCase() : '?'

  const presenceColor = {
    online: 'bg-emerald-500 border-white',
    busy: 'bg-amber-500 border-white',
    offline: 'bg-slate-400 border-white',
  }

  const channelBgColor: Record<string, string> = {
    whatsapp: 'bg-wa-badge-unread',
    whatsapp_cloud: 'bg-wa-badge-unread',
    whatsapp_unofficial: 'bg-wa-badge-unread',
    website_widget: 'bg-blue-600',
    web_widget: 'bg-blue-600',
    api: 'bg-purple-600',
  }

  const channelIcons: Record<string, React.ReactNode> = {
    whatsapp: <MessageSquare className="w-2.5 h-2.5 text-white" />,
    whatsapp_cloud: <MessageSquare className="w-2.5 h-2.5 text-white" />,
    whatsapp_unofficial: <MessageSquare className="w-2.5 h-2.5 text-white" />,
    website_widget: <Globe className="w-2.5 h-2.5 text-white" />,
    web_widget: <Globe className="w-2.5 h-2.5 text-white" />,
    api: <Zap className="w-2.5 h-2.5 text-white" />,
  }

  return (
    <div className={`relative inline-flex shrink-0 ${sizeClasses[size]} ${className}`}>
      {src ? (
        <img src={src} alt={name} className="w-full h-full rounded-full object-cover shadow-xs" />
      ) : (
        <div className="w-full h-full rounded-full bg-slate-200 text-slate-700 font-semibold flex items-center justify-center shadow-xs">
          {initial}
        </div>
      )}

      {/* Presence Dot Indicator */}
      {presence && (
        <span
          data-testid="presence-indicator"
          title={`Status: ${presence}`}
          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 ${presenceColor[presence]}`}
        />
      )}

      {/* Channel Mini Badge */}
      {channel && (
        <span
          data-testid="channel-avatar-badge"
          title={`Channel: ${channel}`}
          className={`absolute -top-1 -right-1 w-4 h-4 rounded-full ${channelBgColor[channel] || 'bg-slate-500'} text-white flex items-center justify-center shadow-xs`}
        >
          {channelIcons[channel] || <MessageSquare className="w-2.5 h-2.5 text-white" />}
        </span>
      )}
    </div>
  )
}

// --- ChannelBadge Primitive ---
export interface ChannelBadgeProps {
  channel: 'whatsapp' | 'website_widget' | 'api' | string
  className?: string
  showLabel?: boolean
}

export function ChannelBadge({ channel, className = '', showLabel = false }: ChannelBadgeProps) {
  const channelColors: Record<string, string> = {
    whatsapp: 'bg-wa-badge-unread text-white',
    whatsapp_cloud: 'bg-wa-badge-unread text-white',
    whatsapp_unofficial: 'bg-wa-badge-unread text-white',
    website_widget: 'bg-blue-600 text-white',
    web_widget: 'bg-blue-600 text-white',
    api: 'bg-purple-600 text-white',
  }

  const channelIcons: Record<string, React.ReactNode> = {
    whatsapp: <MessageSquare className="w-2.5 h-2.5" />,
    whatsapp_cloud: <MessageSquare className="w-2.5 h-2.5" />,
    whatsapp_unofficial: <MessageSquare className="w-2.5 h-2.5" />,
    website_widget: <Globe className="w-2.5 h-2.5" />,
    web_widget: <Globe className="w-2.5 h-2.5" />,
    api: <Zap className="w-2.5 h-2.5" />,
  }

  const channelLabels: Record<string, string> = {
    whatsapp: 'WhatsApp',
    whatsapp_cloud: 'WhatsApp',
    whatsapp_unofficial: 'WhatsApp',
    website_widget: 'Web Widget',
    web_widget: 'Web Widget',
    api: 'API',
  }

  const colorClass = channelColors[channel] || 'bg-slate-500 text-white'
  const icon = channelIcons[channel] || <MessageSquare className="w-2.5 h-2.5" />
  const label = channelLabels[channel] || channel

  return (
    <span
      data-testid="channel-badge"
      title={`Channel: ${label}`}
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none shadow-2xs ${colorClass} ${className}`}
    >
      {icon}
      {showLabel && <span>{label}</span>}
    </span>
  )
}

// --- Badge Primitive ---
export interface BadgeProps {
  variant?:
    | 'default'
    | 'success'
    | 'warning'
    | 'error'
    | 'wa-unread'
    | 'ticket-open'
    | 'ticket-pending'
    | 'ticket-resolved'
    | 'ticket-snoozed'
  size?: 'sm' | 'md'
  children: React.ReactNode
  className?: string
  'data-testid'?: string
}

export function Badge({
  variant = 'default',
  size = 'sm',
  children,
  className = '',
  'data-testid': testId,
}: BadgeProps) {
  const variantClasses = {
    default: 'bg-slate-100 text-slate-700 border border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    error: 'bg-rose-50 text-rose-700 border border-rose-200',
    'wa-unread': 'bg-wa-badge-unread text-white font-bold rounded-full min-w-[20px] px-1.5',
    'ticket-open': 'bg-emerald-100 text-emerald-800 border border-emerald-200 font-medium',
    'ticket-pending': 'bg-amber-100 text-amber-800 border border-amber-200 font-medium',
    'ticket-resolved': 'bg-slate-200 text-slate-700 border border-slate-300 font-medium',
    'ticket-snoozed': 'bg-purple-100 text-purple-800 border border-purple-200 font-medium',
  }

  const sizeClasses = {
    sm: 'text-[11px] py-0.5 px-2 rounded-md',
    md: 'text-xs py-1 px-2.5 rounded-lg',
  }

  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center justify-center leading-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </span>
  )
}

// --- Button Primitive ---
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon' | 'teal'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  children?: React.ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  children,
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  const variantClasses = {
    primary: 'bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs',
    teal: 'bg-wa-teal-primary hover:bg-wa-teal-dark text-white font-medium shadow-xs',
    secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium',
    ghost: 'hover:bg-slate-100 text-slate-600 hover:text-slate-900',
    icon: 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-full',
  }

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1.5 rounded-md',
    md: 'text-sm px-3.5 py-2 rounded-lg',
    lg: 'text-base px-5 py-2.5 rounded-xl',
    icon: 'w-9 h-9 p-0 flex items-center justify-center rounded-full',
  }

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

// --- Input Primitive ---
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode
  shortcutHint?: string
}

export function Input({ icon, shortcutHint, className = '', ...props }: InputProps) {
  return (
    <div className="relative flex items-center w-full">
      {icon && (
        <span className="absolute left-3 text-slate-400 pointer-events-none flex items-center">
          {icon}
        </span>
      )}
      <input
        className={`w-full bg-white text-sm text-slate-800 placeholder-slate-400 rounded-lg border border-slate-200 focus:outline-none focus:border-wa-teal-primary focus:ring-1 focus:ring-wa-teal-primary py-2 ${
          icon ? 'pl-9' : 'pl-3'
        } ${shortcutHint ? 'pr-8' : 'pr-3'} ${className}`}
        {...props}
      />
      {shortcutHint && (
        <span className="absolute right-2.5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded pointer-events-none">
          {shortcutHint}
        </span>
      )}
    </div>
  )
}
