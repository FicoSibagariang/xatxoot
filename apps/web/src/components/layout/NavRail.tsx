import {
  BarChart3,
  Globe,
  LogOut,
  MessageSquare,
  Plus,
  QrCode,
  Settings,
  Users,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '../astryx'
import type { LayoutChannelFilter, LayoutNavTab, LayoutUser, PresenceStatus } from './types'

// ==========================================
// Kolom 1: NavRail (60px fixed width)
// ==========================================
export interface NavRailProps {
  currentUser: LayoutUser
  activeTab: LayoutNavTab
  activeChannelFilter: LayoutChannelFilter
  onTabChange: (tab: LayoutNavTab) => void
  onChannelFilterChange: (channel: LayoutChannelFilter) => void
  onPresenceChange: (status: PresenceStatus) => void
  onOpenSettings?: () => void
  onLogout?: () => void
  onAddChannel?: () => void
  onOpenWhatsAppPairing?: () => void
  whatsappConnectionStatus?: 'connected' | 'qr_ready' | 'connecting' | 'disconnected'
}

export function NavRail({
  currentUser,
  activeTab,
  activeChannelFilter,
  onTabChange,
  onChannelFilterChange,
  onPresenceChange,
  onOpenSettings,
  onLogout,
  onAddChannel,
  onOpenWhatsAppPairing,
  whatsappConnectionStatus = 'disconnected',
}: NavRailProps) {
  const [showPresenceMenu, setShowPresenceMenu] = useState(false)

  return (
    <aside
      data-testid="nav-rail"
      className="w-[60px] h-full bg-wa-rail-bg text-slate-300 flex flex-col items-center py-3.5 justify-between shrink-0 select-none z-20 border-r border-slate-800"
    >
      {/* Top Section: User Avatar & Main Navigation Tabs */}
      <div className="flex flex-col items-center gap-4 w-full">
        {/* User Avatar with Presence Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPresenceMenu(!showPresenceMenu)}
            className="rounded-full focus:outline-none focus:ring-2 focus:ring-wa-teal-primary cursor-pointer transition-transform hover:scale-105"
            title={`${currentUser.name} (${currentUser.status})`}
          >
            <Avatar
              name={currentUser.name}
              src={currentUser.avatarUrl}
              size="md"
              presence={currentUser.status}
            />
          </button>

          {showPresenceMenu && (
            <div className="absolute left-14 top-0 bg-wa-surface-dark text-white text-xs rounded-xl shadow-xl border border-slate-700 py-1.5 w-32 z-50">
              <div className="px-3 py-1 font-semibold text-slate-400 border-b border-slate-700/60 mb-1">
                Ubah Status
              </div>
              {(['online', 'busy', 'offline'] as PresenceStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    onPresenceChange(st)
                    setShowPresenceMenu(false)
                  }}
                  className={`w-full text-left px-3 py-1.5 hover:bg-slate-700/60 flex items-center gap-2 capitalize ${
                    currentUser.status === st ? 'text-wa-teal-primary font-bold' : 'text-slate-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      st === 'online'
                        ? 'bg-emerald-500'
                        : st === 'busy'
                          ? 'bg-amber-500'
                          : 'bg-slate-400'
                    }`}
                  />
                  {st}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-8 h-[1px] bg-slate-800 my-1" />

        {/* Main Navigation Tabs */}
        <div className="flex flex-col items-center gap-2.5 w-full">
          <button
            type="button"
            data-testid="nav-tab-inbox"
            data-active={activeTab === 'inbox'}
            onClick={() => onTabChange('inbox')}
            title="Inbox Percakapan"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'inbox'
                ? 'bg-wa-surface-dark text-wa-teal-primary font-bold shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          <button
            type="button"
            data-testid="nav-tab-contacts"
            data-active={activeTab === 'contacts'}
            onClick={() => onTabChange('contacts')}
            title="Kontak & CRM"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'contacts'
                ? 'bg-wa-surface-dark text-wa-teal-primary font-bold shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Users className="w-5 h-5" />
          </button>

          <button
            type="button"
            data-testid="nav-tab-reports"
            data-active={activeTab === 'reports'}
            onClick={() => onTabChange('reports')}
            title="Laporan & Metrik"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-wa-surface-dark text-wa-teal-primary font-bold shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
          </button>

          <button
            type="button"
            data-testid="nav-tab-settings"
            data-active={activeTab === 'settings'}
            onClick={() => {
              onTabChange('settings')
              if (onOpenSettings) onOpenSettings()
            }}
            title="Pengaturan Instance"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-wa-surface-dark text-wa-teal-primary font-bold shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Settings className="w-5 h-5" />
          </button>

          {onLogout && (
            <button
              type="button"
              data-testid="nav-tab-logout"
              onClick={onLogout}
              title="Keluar (Logout)"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Bottom Section: Quick Channel Filters */}
      <div
        data-testid="channel-section"
        className="flex flex-col items-center gap-1.5 w-full pt-2.5 border-t border-slate-800"
      >
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">CH</div>

        {/* Action Buttons: Add Channel & QR Pairing */}
        {(onAddChannel || onOpenWhatsAppPairing) && (
          <div className="flex items-center gap-1 p-1 bg-slate-900/60 rounded-lg border border-slate-800/80 mb-0.5">
            {onAddChannel && (
              <button
                type="button"
                data-testid="channel-add-button"
                onClick={onAddChannel}
                title="Tambah / Kelola Saluran (Channels)"
                className="w-5 h-5 rounded text-[11px] flex items-center justify-center bg-slate-800 text-slate-300 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}

            {onOpenWhatsAppPairing && (
              <button
                type="button"
                data-testid="channel-whatsapp-qr-button"
                onClick={onOpenWhatsAppPairing}
                title="Tautkan WhatsApp Web / Scan QR Baileys"
                className="relative w-5 h-5 rounded text-[11px] flex items-center justify-center bg-slate-800 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer font-bold"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span
                  className={`absolute -top-1 -right-1 w-2 h-2 rounded-full border border-wa-rail-bg ${
                    whatsappConnectionStatus === 'connected'
                      ? 'bg-emerald-500'
                      : whatsappConnectionStatus === 'qr_ready'
                        ? 'bg-amber-400 animate-pulse'
                        : 'bg-rose-500'
                  }`}
                />
              </button>
            )}
          </div>
        )}

        {/* Quick Channel Filters (Pill Group) */}
        <div className="flex flex-col items-center gap-1 p-1 bg-slate-900/40 rounded-xl border border-slate-800/60">
          <button
            type="button"
            data-testid="channel-filter-all"
            data-active={activeChannelFilter === 'all'}
            onClick={() => onChannelFilterChange('all')}
            title="Semua Saluran (Klik untuk reset)"
            className={`w-8 h-7 rounded-lg text-[10px] font-bold flex items-center justify-center transition-all cursor-pointer ${
              activeChannelFilter === 'all'
                ? 'bg-wa-teal-primary text-white shadow-xs'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            ALL
          </button>

          <button
            type="button"
            data-testid="channel-filter-whatsapp"
            data-active={activeChannelFilter === 'whatsapp'}
            onClick={() =>
              onChannelFilterChange(activeChannelFilter === 'whatsapp' ? 'all' : 'whatsapp')
            }
            title="Filter WhatsApp (Klik lagi untuk batal)"
            className={`w-8 h-7 rounded-lg text-[11px] font-extrabold flex items-center justify-center transition-all cursor-pointer ${
              activeChannelFilter === 'whatsapp'
                ? 'bg-wa-badge-unread text-white shadow-xs'
                : 'text-emerald-400 hover:bg-slate-800 hover:text-emerald-300'
            }`}
          >
            WA
          </button>

          <button
            type="button"
            data-testid="channel-filter-widget"
            data-active={activeChannelFilter === 'widget'}
            onClick={() =>
              onChannelFilterChange(activeChannelFilter === 'widget' ? 'all' : 'widget')
            }
            title="Filter Live Chat Widget (Klik lagi untuk batal)"
            className={`w-8 h-7 rounded-lg text-xs flex items-center justify-center transition-all cursor-pointer ${
              activeChannelFilter === 'widget'
                ? 'bg-sky-500 text-white font-bold shadow-xs'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            data-testid="channel-filter-api"
            data-active={activeChannelFilter === 'api'}
            onClick={() => onChannelFilterChange(activeChannelFilter === 'api' ? 'all' : 'api')}
            title="Filter API Channel (Klik lagi untuk batal)"
            className={`w-8 h-7 rounded-lg text-xs flex items-center justify-center transition-all cursor-pointer ${
              activeChannelFilter === 'api'
                ? 'bg-amber-500 text-white font-bold shadow-xs'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}

export default NavRail
