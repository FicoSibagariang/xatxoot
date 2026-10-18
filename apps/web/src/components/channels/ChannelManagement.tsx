import { Edit2, Globe, MessageSquare, Phone, Plus, QrCode, RefreshCw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../../services/apiClient'
import { Badge, Button, Input } from '../astryx'

export interface ChannelItem {
  id: string
  name: string
  channelType: 'whatsapp_unofficial' | 'whatsapp_cloud' | 'web_widget' | 'api' | string
  phoneNumber?: string | null
  connectionStatus?: 'connected' | 'disconnected' | 'connecting' | 'qr_ready' | string
  conversationCount?: number
  createdAt?: string
}

export interface ChannelManagementProps {
  inboxes?: ChannelItem[]
  onAddNewChannel?: () => void
  onUpdateChannelName?: (inboxId: string, newName: string) => Promise<void> | void
  onRefresh?: () => void
  onOpenQrPairing?: (inboxId: string, inboxName: string) => void
}

export function ChannelManagement({
  inboxes: initialInboxes,
  onAddNewChannel,
  onUpdateChannelName,
  onRefresh,
  onOpenQrPairing,
}: ChannelManagementProps) {
  const [channels, setChannels] = useState<ChannelItem[]>(initialInboxes || [])
  const [loading, setLoading] = useState(false)
  const [editingChannel, setEditingChannel] = useState<ChannelItem | null>(null)
  const [editName, setEditName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Sync if prop changes
  useEffect(() => {
    if (initialInboxes) {
      setChannels(initialInboxes)
    }
  }, [initialInboxes])

  // Fetch from API if no initial inboxes provided
  useEffect(() => {
    if (initialInboxes !== undefined) return

    let isMounted = true
    const fetchInboxes = async () => {
      setLoading(true)
      try {
        const inboxesData = (await api.get('/api/v1/inboxes')) as Array<{
          id: string
          name: string
          channelType: string
          channelId?: string
        }>

        // For each inbox, fetch channel details if unofficial whatsapp
        const enriched = await Promise.all(
          inboxesData.map(async (inbox) => {
            let phoneNumber: string | null = null
            let connectionStatus = 'disconnected'

            try {
              const ch = (await api.get(`/api/v1/inboxes/${inbox.id}/channel`)) as {
                phoneNumber?: string | null
                connectionStatus?: string
              }
              if (ch) {
                phoneNumber = ch.phoneNumber || null
                connectionStatus = ch.connectionStatus || 'disconnected'
              }
            } catch {
              // ignore
            }

            return {
              id: inbox.id,
              name: inbox.name,
              channelType: inbox.channelType,
              phoneNumber,
              connectionStatus,
            }
          }),
        )

        if (isMounted) {
          setChannels(enriched)
        }
      } catch (err) {
        if (isMounted) {
          setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat saluran')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchInboxes()
    return () => {
      isMounted = false
    }
  }, [initialInboxes])

  const handleOpenEdit = (channel: ChannelItem) => {
    setEditingChannel(channel)
    setEditName(channel.name)
    setErrorMsg(null)
    setSuccessMsg(null)
  }

  const handleSaveRename = async () => {
    if (!editingChannel) return
    const trimmed = editName.trim()
    if (!trimmed) {
      setErrorMsg('Nama saluran tidak boleh kosong')
      return
    }

    setIsSaving(true)
    setErrorMsg(null)

    try {
      if (onUpdateChannelName) {
        await onUpdateChannelName(editingChannel.id, trimmed)
      } else {
        await api.patch(`/api/v1/inboxes/${editingChannel.id}`, { name: trimmed })
      }

      setChannels((prev) =>
        prev.map((ch) => (ch.id === editingChannel.id ? { ...ch, name: trimmed } : ch)),
      )
      setSuccessMsg(`Nama saluran berhasil diubah menjadi "${trimmed}"`)
      setEditingChannel(null)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memperbarui nama saluran')
    } finally {
      setIsSaving(false)
    }
  }

  const formatChannelType = (type: string) => {
    switch (type) {
      case 'whatsapp_unofficial':
        return 'WhatsApp Multi-Device (Baileys)'
      case 'whatsapp_cloud':
        return 'WhatsApp Cloud API'
      case 'web_widget':
        return 'Website Live Chat Widget'
      case 'api':
        return 'Custom API Integration'
      default:
        return type.replace(/_/g, ' ')
    }
  }

  return (
    <div
      data-testid="channel-management"
      className="flex-1 h-full bg-wa-header-bg overflow-y-auto flex flex-col font-sans select-none p-6"
    >
      {/* Top Banner / Breadcrumb */}
      <div className="max-w-4xl mx-auto w-full">
        <header className="bg-white rounded-2xl border border-wa-border p-6 shadow-xs flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-wa-teal-primary/10 text-2xl text-wa-teal-primary">
              📡
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-wa-text-primary">
                  Kelola Saluran Komunikasi
                </h1>
                <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {channels.length} Saluran Terpasang
                </span>
              </div>
              <p className="text-sm text-wa-text-secondary mt-0.5">
                Konfigurasi inbox omnichannel, ganti nama saluran, dan pantau status koneksi
                WhatsApp.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                className="flex items-center gap-1.5 cursor-pointer text-slate-600 border-slate-300 hover:bg-slate-50"
              >
                <RefreshCw className="w-4 h-4" />
                Segarkan
              </Button>
            )}
            {onAddNewChannel && (
              <Button
                data-testid="add-new-channel-btn"
                variant="primary"
                size="sm"
                onClick={onAddNewChannel}
                className="flex items-center gap-1.5 font-bold cursor-pointer bg-wa-teal-primary hover:bg-wa-teal-dark text-white"
              >
                <Plus className="w-4 h-4" />+ Tambah Saluran Baru
              </Button>
            )}
          </div>
        </header>

        {/* Global Feedback Alert */}
        {successMsg && (
          <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>✅</span>
              <span>{successMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMsg(null)}
              className="text-emerald-600 hover:text-emerald-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {errorMsg && !editingChannel && (
          <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-rose-600 hover:text-rose-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Channels List Cards */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-wa-border p-12 text-center text-wa-text-secondary">
            Memuat daftar saluran komunikasi...
          </div>
        ) : channels.length === 0 ? (
          <div className="bg-white rounded-2xl border border-wa-border p-12 text-center text-wa-text-secondary">
            <p className="text-base font-semibold text-slate-700 mb-2">
              Belum ada saluran terpasang
            </p>
            <p className="text-sm text-slate-500 mb-4">
              Mulai hubungkan WhatsApp, Web Widget, atau API untuk menerima percakapan pelanggan.
            </p>
            {onAddNewChannel && (
              <Button
                variant="primary"
                size="sm"
                onClick={onAddNewChannel}
                className="bg-wa-teal-primary hover:bg-wa-teal-dark text-white"
              >
                + Tambah Saluran Sekarang
              </Button>
            )}
          </div>
        ) : (
          <div data-testid="channel-list" className="grid gap-4">
            {channels.map((ch) => {
              const isWhatsApp = ch.channelType.includes('whatsapp')
              const isConnected = ch.connectionStatus === 'connected'

              return (
                <div
                  key={ch.id}
                  data-testid={`channel-item-${ch.id}`}
                  className="bg-white rounded-2xl border border-wa-border p-5 shadow-xs flex items-center justify-between transition-all hover:border-slate-300"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                        isWhatsApp
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          : ch.channelType === 'web_widget'
                            ? 'bg-sky-50 text-sky-600 border border-sky-100'
                            : 'bg-purple-50 text-purple-600 border border-purple-100'
                      }`}
                    >
                      {isWhatsApp ? (
                        <MessageSquare className="w-6 h-6" />
                      ) : ch.channelType === 'web_widget' ? (
                        <Globe className="w-6 h-6" />
                      ) : (
                        <Phone className="w-6 h-6" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="font-bold text-base text-slate-900">{ch.name}</h3>
                        <Badge
                          variant={isConnected ? 'success' : 'neutral'}
                          className="text-[11px] font-semibold"
                        >
                          {isConnected ? '🟢 Terhubung' : 'Terputus'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-wa-text-secondary mt-1">
                        <span className="font-medium text-slate-600">
                          {formatChannelType(ch.channelType)}
                        </span>
                        {ch.phoneNumber && (
                          <>
                            <span>&bull;</span>
                            <span className="font-mono text-slate-700 font-semibold">
                              {ch.phoneNumber}
                            </span>
                          </>
                        )}
                        {ch.conversationCount !== undefined && ch.conversationCount > 0 && (
                          <>
                            <span>&bull;</span>
                            <span>{ch.conversationCount} Percakapan</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    {onOpenQrPairing && isWhatsApp && !isConnected && (
                      <Button
                        data-testid={`pairing-channel-btn-${ch.id}`}
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenQrPairing(ch.id, ch.name)}
                        className="flex items-center gap-1.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 cursor-pointer font-semibold"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        Scan QR
                      </Button>
                    )}

                    <Button
                      data-testid={`edit-channel-btn-${ch.id}`}
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(ch)}
                      className="flex items-center gap-1.5 text-xs text-slate-700 border-slate-300 hover:bg-slate-100 cursor-pointer font-semibold"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                      Ubah Nama
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Rename Channel Modal */}
      {editingChannel && (
        <div
          data-testid="rename-channel-modal"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-wa-teal-primary/10 text-wa-teal-primary">
                  <Edit2 className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Ubah Nama Saluran</h3>
                  <p className="text-xs text-slate-500">
                    Edit identitas saluran untuk tim support.
                  </p>
                </div>
              </div>
              <button
                type="button"
                data-testid="cancel-rename-x-btn"
                onClick={() => setEditingChannel(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {errorMsg && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                  {errorMsg}
                </div>
              )}

              <div>
                <label
                  htmlFor="rename-channel-input"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  Nama Saluran / Inbox
                </label>
                <Input
                  id="rename-channel-input"
                  data-testid="rename-channel-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Contoh: WhatsApp Support, Sales Line, CS Nia"
                  autoFocus
                  className="w-full text-sm"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Nama ini digunakan sebagai label inbox omnichannel di aplikasi dashboard staf.
                </p>
              </div>

              {editingChannel.phoneNumber && (
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Nomor WhatsApp Terhubung:</span>{' '}
                  <span className="font-mono text-emerald-700 font-bold">
                    {editingChannel.phoneNumber}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                data-testid="cancel-rename-btn"
                variant="outline"
                size="sm"
                onClick={() => setEditingChannel(null)}
                disabled={isSaving}
                className="cursor-pointer text-slate-600"
              >
                Batal
              </Button>
              <Button
                data-testid="save-rename-btn"
                variant="primary"
                size="sm"
                onClick={handleSaveRename}
                disabled={isSaving || !editName.trim()}
                className="cursor-pointer bg-wa-teal-primary hover:bg-wa-teal-dark text-white font-bold"
              >
                {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChannelManagement
