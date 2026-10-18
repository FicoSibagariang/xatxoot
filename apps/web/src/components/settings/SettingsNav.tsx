import { Lock, Radio, Sparkles } from 'lucide-react'

export interface SettingsNavProps {
  activeSection?: 'channels' | 'ai' | 'security'
}

export function SettingsNav({ activeSection }: SettingsNavProps) {
  let currentPath = '/settings/channels'
  if (typeof window !== 'undefined' && window.location) {
    currentPath = window.location.pathname
  }

  const active =
    activeSection ||
    (currentPath.includes('/settings/channels')
      ? 'channels'
      : currentPath.includes('/settings/security')
        ? 'security'
        : 'ai')

  const navItems = [
    {
      id: 'channels',
      label: 'Saluran Komunikasi',
      href: '/settings/channels',
      icon: Radio,
      testId: 'settings-nav-channels',
    },
    {
      id: 'ai',
      label: 'AI & Knowledge Base',
      href: '/settings/ai',
      icon: Sparkles,
      testId: 'settings-nav-ai',
    },
    {
      id: 'security',
      label: 'Keamanan & SSO',
      href: '/settings/security',
      icon: Lock,
      testId: 'settings-nav-security',
    },
  ]

  return (
    <nav
      data-testid="settings-nav"
      className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center shadow-2xs shrink-0"
    >
      <div className="max-w-6xl mx-auto w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-2">
            Pengaturan:
          </span>
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = active === item.id

            return (
              <a
                key={item.id}
                href={item.href}
                data-testid={item.testId}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-wa-teal-primary text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </a>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

export default SettingsNav
