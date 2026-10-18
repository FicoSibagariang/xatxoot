import { CheckCircle2, Inbox, Key, Mail, Search, Shield, UserPlus, X, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../../services/apiClient'
import { Avatar, Badge, Button } from '../astryx'

export interface UserItem {
  id: string
  displayName: string
  email: string
  role: string
  availability?: string
  active: boolean
  inboxes?: Array<{
    id: string
    name: string
    channelType: string
  }>
}

export interface InboxOption {
  id: string
  name: string
  channelType: string
}

export interface UserManagementModalProps {
  isOpen: boolean
  onClose: () => void
  initialUsers?: UserItem[]
  availableInboxes?: InboxOption[]
  defaultCreateOpen?: boolean
}

export function UserManagementModal({
  isOpen,
  onClose,
  initialUsers = [],
  availableInboxes = [],
  defaultCreateOpen = false,
}: UserManagementModalProps) {
  const [users, setUsers] = useState<UserItem[]>(initialUsers)
  const [inboxes, setInboxes] = useState<InboxOption[]>(availableInboxes)
  const [isCreateOpen, setIsCreateOpen] = useState(defaultCreateOpen)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'administrator' | 'agent'>('all')

  // Form states
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formRole, setFormRole] = useState<'agent' | 'administrator'>('agent')
  const [formPassword, setFormPassword] = useState('')
  const [selectedInboxIds, setSelectedInboxIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Sub-modal state for Reset Password
  const [selectedPasswordUser, setSelectedPasswordUser] = useState<UserItem | null>(null)
  const [resetPasswordInput, setResetPasswordInput] = useState('')

  useEffect(() => {
    if (initialUsers.length > 0) {
      setUsers(initialUsers)
    }
  }, [initialUsers])

  useEffect(() => {
    if (availableInboxes.length > 0) {
      setInboxes(availableInboxes)
    }
  }, [availableInboxes])

  useEffect(() => {
    if (!isOpen) return

    // Load users from backend if available
    api
      .get<{ success?: boolean; data?: UserItem[] }>('/api/v1/users')
      .then((res) => {
        if (res?.data && Array.isArray(res.data)) {
          setUsers(res.data)
        }
      })
      .catch(() => {
        // Fallback to initial
      })

    // Load inboxes from backend if available
    api
      .get<{ inboxes?: InboxOption[] }>('/api/v1/inboxes')
      .then((res) => {
        if (res?.inboxes && Array.isArray(res.inboxes)) {
          setInboxes(res.inboxes)
        }
      })
      .catch(() => {
        // Fallback
      })
  }, [isOpen])

  if (!isOpen) return null

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  const handleToggleInbox = (inboxId: string) => {
    setSelectedInboxIds((prev) =>
      prev.includes(inboxId) ? prev.filter((id) => id !== inboxId) : [...prev, inboxId],
    )
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim() || !formEmail.trim()) {
      setErrorMessage('Nama dan email Google wajib diisi')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const payload: {
        displayName: string
        email: string
        role: 'agent' | 'administrator'
        inboxIds: string[]
        password?: string
      } = {
        displayName: formName.trim(),
        email: formEmail.trim().toLowerCase(),
        role: formRole,
        inboxIds: selectedInboxIds,
      }
      if (formPassword.trim()) {
        payload.password = formPassword.trim()
      }

      const res = await api.post<{ success?: boolean; data: UserItem }>('/api/v1/users', payload)
      if (res?.data) {
        setUsers((prev) => [...prev, res.data])
      } else {
        // Local state fallback
        const mockNew: UserItem = {
          id: `usr-${Date.now()}`,
          displayName: formName.trim(),
          email: formEmail.trim().toLowerCase(),
          role: formRole,
          availability: 'online',
          active: true,
          inboxes: inboxes.filter((i) => selectedInboxIds.includes(i.id)),
        }
        setUsers((prev) => [...prev, mockNew])
      }

      setSuccessMessage(`Staf ${formName} berhasil didaftarkan!`)
      setFormName('')
      setFormEmail('')
      setFormPassword('')
      setSelectedInboxIds([])
      setIsCreateOpen(false)
    } catch (err) {
      setErrorMessage((err as Error).message || 'Gagal menambahkan staf baru')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPasswordUser) return
    if (!resetPasswordInput.trim() || resetPasswordInput.trim().length < 8) {
      setErrorMessage('Password minimal 8 karakter')
      return
    }

    try {
      await api.patch(`/api/v1/users/${selectedPasswordUser.id}`, {
        password: resetPasswordInput.trim(),
      })
      setSuccessMessage(`Password untuk ${selectedPasswordUser.displayName} berhasil diperbarui!`)
      setSelectedPasswordUser(null)
      setResetPasswordInput('')
    } catch (err) {
      setErrorMessage((err as Error).message || 'Gagal mengubah password')
    }
  }

  const handleToggleUserStatus = async (user: UserItem) => {
    const updatedStatus = !user.active
    try {
      await api.patch(`/api/v1/users/${user.id}`, { active: updatedStatus })
    } catch {
      // Local fallback
    }

    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, active: updatedStatus } : u)))
  }

  return (
    <div
      data-testid="user-management-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-600" />
              Manajemen Staf &amp; Agent
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola hak akses dan peran staf. Staf masuk menggunakan Google Workspace SSO.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notices */}
        {errorMessage && (
          <div className="mx-6 mt-3 p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mx-6 mt-3 p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Toolbar & Filters */}
        <div className="px-6 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari nama atau email Google..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs">
              {(['all', 'administrator', 'agent'] as const).map((rf) => (
                <button
                  key={rf}
                  type="button"
                  onClick={() => setRoleFilter(rf)}
                  className={`px-2.5 py-1 rounded-md capitalize transition-colors cursor-pointer ${
                    roleFilter === rf
                      ? 'bg-white font-semibold text-slate-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {rf === 'all' ? 'Semua' : rf === 'administrator' ? 'Admin' : 'Agent'}
                </button>
              ))}
            </div>

            <Button
              data-testid="btn-open-create-user"
              variant="teal"
              size="sm"
              onClick={() => setIsCreateOpen(!isCreateOpen)}
              className="flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isCreateOpen ? 'Tutup Form' : 'Tambah Staf'}</span>
            </Button>
          </div>
        </div>

        {/* Create Form Drawer / Inline Panel */}
        {isCreateOpen && (
          <form
            data-testid="form-create-user"
            onSubmit={handleCreateSubmit}
            className="p-5 bg-emerald-50/50 border-b border-emerald-100 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-emerald-600" />
                Daftarkan Staf Baru (Pre-Registration Google SSO)
              </h3>
              <span className="text-[11px] text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full font-medium">
                Login via Google Workspace SSO
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label
                  htmlFor="user-full-name"
                  className="block text-[11px] font-semibold text-slate-700 mb-1"
                >
                  Nama Lengkap
                </label>
                <input
                  id="user-full-name"
                  type="text"
                  data-testid="input-user-name"
                  placeholder="Misal: Budi Santoso"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="user-email"
                  className="block text-[11px] font-semibold text-slate-700 mb-1"
                >
                  Email Akun / Google
                </label>
                <input
                  id="user-email"
                  type="email"
                  data-testid="input-user-email"
                  placeholder="budi@perusahaan.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="user-role"
                  className="block text-[11px] font-semibold text-slate-700 mb-1"
                >
                  Peran (Role)
                </label>
                <select
                  id="user-role"
                  data-testid="select-user-role"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as 'agent' | 'administrator')}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 cursor-pointer"
                >
                  <option value="agent">Agent (CS)</option>
                  <option value="administrator">Administrator</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="user-password"
                  className="block text-[11px] font-semibold text-slate-700 mb-1"
                >
                  Password (Opsional)
                </label>
                <input
                  id="user-password"
                  type="password"
                  data-testid="input-user-password"
                  placeholder="Min. 8 kar (opsional)"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            {/* Inboxes Checkboxes */}
            {inboxes.length > 0 && (
              <div>
                <span className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Inbox className="w-3.5 h-3.5 text-slate-500" />
                  Akses Saluran / Inbox yang Boleh Ditangani:
                </span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {inboxes.map((ib) => {
                    const isChecked = selectedInboxIds.includes(ib.id)
                    return (
                      <button
                        key={ib.id}
                        type="button"
                        data-testid={`checkbox-inbox-${ib.id}`}
                        onClick={() => handleToggleInbox(ib.id)}
                        className={`text-xs px-3 py-1.5 rounded-lg border flex items-center gap-2 cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-emerald-600 text-white border-emerald-600 font-medium'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        <span className="w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] bg-white text-emerald-700 font-bold">
                          {isChecked ? '✓' : ''}
                        </span>
                        <span>{ib.name}</span>
                        <span className="text-[10px] opacity-75 capitalize">
                          ({ib.channelType})
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-emerald-100">
              <p className="text-[11px] text-slate-500 italic">
                * Staf dapat login via Google Workspace SSO. Jika password diisi, staf juga dapat
                login via form email &amp; password biasa.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  data-testid="btn-save-user"
                  variant="teal"
                  size="sm"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Menyimpan...' : 'Daftarkan Staf'}
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              Tidak ada staf yang cocok dengan kriteria pencarian.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Nama Staf</th>
                    <th className="py-2.5 px-4">Email Google SSO</th>
                    <th className="py-2.5 px-4">Peran (Role)</th>
                    <th className="py-2.5 px-4">Saluran Ditugaskan</th>
                    <th className="py-2.5 px-4">Status Akun</th>
                    <th className="py-2.5 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.displayName} size="sm" />
                          <div>
                            <div className="font-semibold text-slate-800">{u.displayName}</div>
                            <div className="text-[11px] text-slate-400 capitalize">
                              {u.availability || 'online'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{u.email}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            u.role === 'owner'
                              ? 'teal'
                              : u.role === 'administrator'
                                ? 'primary'
                                : 'secondary'
                          }
                          className="capitalize text-[10px]"
                        >
                          {u.role === 'owner'
                            ? 'Owner'
                            : u.role === 'administrator'
                              ? 'Admin'
                              : 'Agent'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {u.inboxes && u.inboxes.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {u.inboxes.map((ib) => (
                              <span
                                key={ib.id}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200"
                              >
                                {ib.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Semua Saluran</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            u.active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.active ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          {u.active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            data-testid={`btn-set-password-${u.id}`}
                            onClick={() => {
                              setSelectedPasswordUser(u)
                              setResetPasswordInput('')
                              setErrorMessage(null)
                            }}
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors"
                            title="Atur / Reset Password Staf"
                          >
                            <Key className="w-3.5 h-3.5 text-slate-500" />
                            <span className="hidden sm:inline text-[11px] text-slate-600">
                              Password
                            </span>
                          </button>
                          {u.role !== 'owner' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleToggleUserStatus(u)}
                              className="text-[11px] py-1 px-2.5"
                            >
                              {u.active ? 'Nonaktifkan' : 'Aktifkan'}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div>
            Total Staf Terdaftar:{' '}
            <span className="font-semibold text-slate-800">{users.length}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Tutup
          </Button>
        </div>

        {/* Sub-Modal: Set/Reset Password */}
        {selectedPasswordUser && (
          <div
            data-testid="dialog-set-password"
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4"
          >
            <form
              onSubmit={handleSaveResetPassword}
              className="bg-white rounded-xl shadow-2xl border border-slate-200 p-5 w-full max-w-sm flex flex-col gap-3"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-emerald-600" />
                  Atur Password Staf
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedPasswordUser(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-slate-600">
                Atur password baru untuk{' '}
                <span className="font-semibold text-slate-800">
                  {selectedPasswordUser.displayName}
                </span>{' '}
                ({selectedPasswordUser.email}).
              </div>

              <div>
                <label
                  htmlFor="input-new-password"
                  className="block text-[11px] font-semibold text-slate-700 mb-1"
                >
                  Password Baru (Min. 8 karakter)
                </label>
                <input
                  id="input-new-password"
                  type="password"
                  data-testid="input-new-password"
                  placeholder="Masukkan password baru"
                  value={resetPasswordInput}
                  onChange={(e) => setResetPasswordInput(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600"
                  required
                  minLength={8}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setSelectedPasswordUser(null)}
                >
                  Batal
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  data-testid="btn-save-new-password"
                >
                  Simpan Password
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
