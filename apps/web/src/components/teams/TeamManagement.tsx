import type { Team } from '@xatxoot/shared'
import { useState } from 'react'
import { Avatar, Badge, Button } from '../astryx'

export interface AgentUser {
  id: string
  name: string
  email: string
  role?: string
  status?: 'online' | 'busy' | 'offline'
  avatarUrl?: string
}

export interface TeamWithMembers extends Team {
  members?: AgentUser[]
}

export interface TeamManagementProps {
  teams: TeamWithMembers[]
  availableAgents?: AgentUser[]
  selectedTeamId?: string | null
  isCreateOpen?: boolean
  isModal?: boolean
  onSaveTeam?: (teamData: {
    id?: string
    name: string
    description?: string
    allowAutoAssign: boolean
  }) => void
  onDeleteTeam?: (teamId: string) => void
  onAddMember?: (teamId: string, agentId: string) => void
  onRemoveMember?: (teamId: string, agentId: string) => void
  onToggleRoundRobin?: (teamId: string, active: boolean) => void
  onClose?: () => void
}

export function TeamManagement({
  teams: initialTeams,
  availableAgents = [],
  selectedTeamId: propSelectedTeamId = null,
  isCreateOpen: propIsCreateOpen = false,
  isModal = false,
  onSaveTeam,
  onDeleteTeam,
  onAddMember,
  onRemoveMember,
  onToggleRoundRobin,
  onClose,
}: TeamManagementProps) {
  const [teams, setTeams] = useState<TeamWithMembers[]>(initialTeams)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(
    propSelectedTeamId || initialTeams[0]?.id || null,
  )
  const [isFormOpen, setIsFormOpen] = useState(propIsCreateOpen)
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formAutoAssign, setFormAutoAssign] = useState(true)
  const [selectedAgentToAdd, setSelectedAgentToAdd] = useState<string>('')

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) || null

  // Non-member agents for selected team
  const availableAgentsForTeam = availableAgents.filter(
    (ag) => !selectedTeam?.members?.some((m) => m.id === ag.id),
  )

  const handleOpenCreate = () => {
    setEditingTeamId(null)
    setFormName('')
    setFormDescription('')
    setFormAutoAssign(true)
    setIsFormOpen(true)
  }

  const handleOpenEdit = (team: TeamWithMembers) => {
    setEditingTeamId(team.id)
    setFormName(team.name)
    setFormDescription(team.description || '')
    setFormAutoAssign(team.allowAutoAssign)
    setIsFormOpen(true)
  }

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) return

    if (editingTeamId) {
      setTeams((prev) =>
        prev.map((t) =>
          t.id === editingTeamId
            ? {
                ...t,
                name: formName,
                description: formDescription,
                allowAutoAssign: formAutoAssign,
                updatedAt: new Date().toISOString(),
              }
            : t,
        ),
      )
      onSaveTeam?.({
        id: editingTeamId,
        name: formName,
        description: formDescription,
        allowAutoAssign: formAutoAssign,
      })
    } else {
      const newTeam: TeamWithMembers = {
        id: `team-${Date.now().toString(36)}`,
        name: formName,
        description: formDescription,
        allowAutoAssign: formAutoAssign,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        members: [],
      }
      setTeams((prev) => [...prev, newTeam])
      setSelectedTeamId(newTeam.id)
      onSaveTeam?.({
        name: formName,
        description: formDescription,
        allowAutoAssign: formAutoAssign,
      })
    }

    setIsFormOpen(false)
  }

  const handleToggleAutoAssign = (teamId: string) => {
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, allowAutoAssign: !t.allowAutoAssign } : t)),
    )
    const targetTeam = teams.find((t) => t.id === teamId)
    if (targetTeam) {
      onToggleRoundRobin?.(teamId, !targetTeam.allowAutoAssign)
    }
  }

  const handleDelete = (teamId: string) => {
    setTeams((prev) => prev.filter((t) => t.id !== teamId))
    if (selectedTeamId === teamId) {
      setSelectedTeamId(teams.find((t) => t.id !== teamId)?.id || null)
    }
    onDeleteTeam?.(teamId)
  }

  const handleAddAgentToTeam = () => {
    if (!selectedTeamId || !selectedAgentToAdd) return
    const agent = availableAgents.find((a) => a.id === selectedAgentToAdd)
    if (!agent) return

    setTeams((prev) =>
      prev.map((t) =>
        t.id === selectedTeamId
          ? {
              ...t,
              members: [...(t.members || []), agent],
            }
          : t,
      ),
    )
    onAddMember?.(selectedTeamId, selectedAgentToAdd)
    setSelectedAgentToAdd('')
  }

  const handleRemoveAgentFromTeam = (agentId: string) => {
    if (!selectedTeamId) return
    setTeams((prev) =>
      prev.map((t) =>
        t.id === selectedTeamId
          ? {
              ...t,
              members: (t.members || []).filter((m) => m.id !== agentId),
            }
          : t,
      ),
    )
    onRemoveMember?.(selectedTeamId, agentId)
  }

  const content = (
    <div
      data-testid="team-management-panel"
      className="flex flex-col h-full w-full bg-white text-[#111b21] select-none overflow-hidden"
    >
      {/* Header Bar */}
      <header className="h-16 bg-[#f0f2f5] px-6 flex items-center justify-between border-b border-[#e9edef] shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">👥</span>
          <div>
            <h2 className="text-base font-bold text-[#111b21]">Manajemen Tim &amp; Round-Robin</h2>
            <p className="text-xs text-[#667781]">
              Kelola pembagian agen dan distribusi penugasan tiket bergilir
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            data-testid="btn-open-create-team"
            variant="teal"
            size="sm"
            onClick={handleOpenCreate}
          >
            + Tambah Tim Baru
          </Button>

          {isModal && onClose && (
            <Button
              data-testid="btn-close-team-modal"
              variant="secondary"
              size="sm"
              onClick={onClose}
            >
              ✕ Tutup
            </Button>
          )}
        </div>
      </header>

      {/* Main Body: Teams List (Left) + Selected Team Details & Members (Right) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Teams List */}
        <section className="w-1/2 md:w-5/12 border-r border-[#e9edef] flex flex-col overflow-y-auto divide-y divide-slate-100">
          {teams.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Belum ada tim yang dibuat. Klik tombol di atas untuk membuat tim pertama Anda.
            </div>
          ) : (
            teams.map((team) => {
              const isSelected = selectedTeamId === team.id
              const memberCount = team.members?.length || 0

              return (
                <div
                  key={team.id}
                  data-testid={`team-item-${team.id}`}
                  className={`p-4 flex flex-col gap-2 transition-colors ${
                    isSelected
                      ? 'bg-emerald-50/60 border-l-4 border-wa-teal-primary'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedTeamId(team.id)}
                    className="w-full text-left flex items-start justify-between gap-2 focus:outline-none cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-sm text-[#111b21] truncate">{team.name}</h4>
                      {team.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                          {team.description}
                        </p>
                      )}
                    </div>

                    {team.allowAutoAssign ? (
                      <Badge
                        variant="success"
                        data-testid={`round-robin-badge-${team.id}`}
                        size="sm"
                      >
                        ⚡ Round-Robin Aktif
                      </Badge>
                    ) : (
                      <Badge
                        variant="default"
                        data-testid={`round-robin-badge-${team.id}`}
                        size="sm"
                      >
                        Auto-Assign Nonaktif
                      </Badge>
                    )}
                  </button>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100/80">
                    <span className="text-slate-500 font-medium">{memberCount} Anggota</span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleAutoAssign(team.id)
                        }}
                        className="text-[11px] font-semibold text-emerald-700 hover:underline cursor-pointer"
                      >
                        {team.allowAutoAssign ? 'Matikan Auto-Assign' : 'Aktifkan Auto-Assign'}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenEdit(team)
                        }}
                        className="text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(team.id)
                        }}
                        className="text-[11px] text-rose-500 hover:text-rose-700 cursor-pointer"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </section>

        {/* Right: Team Detail Drawer / Member Management / Form Modal */}
        <section className="flex-1 flex flex-col bg-slate-50 overflow-y-auto p-6">
          {/* Create / Edit Form Card */}
          {isFormOpen && (
            <div
              data-testid="team-form"
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-6"
            >
              <h3 className="font-bold text-sm text-[#111b21] mb-3">
                {editingTeamId ? 'Perbarui Tim' : 'Tambah Tim Baru'}
              </h3>

              <form onSubmit={handleSaveForm} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Tim
                    <input
                      data-testid="input-team-name"
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Misal: Tim Sales, Tim Billing..."
                      className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-normal focus:outline-none focus:border-wa-teal-primary"
                      required
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Deskripsi Tim
                    <textarea
                      data-testid="input-team-description"
                      rows={2}
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Penjelasan fungsi tim..."
                      className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-normal focus:outline-none focus:border-wa-teal-primary resize-none"
                    />
                  </label>
                </div>

                <div className="pt-1">
                  <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      data-testid="input-team-auto-assign"
                      type="checkbox"
                      checked={formAutoAssign}
                      onChange={(e) => setFormAutoAssign(e.target.checked)}
                      className="accent-wa-teal-primary w-4 h-4 rounded cursor-pointer"
                    />
                    <span>Aktifkan Penugasan Otomatis Round-Robin ke Agen Online</span>
                  </label>
                  <p className="text-[11px] text-slate-500 ml-6 mt-0.5">
                    Tiket baru yang ditujukan ke tim ini akan dialokasikan secara bergilir merata ke
                    agen anggota yang berstatus online.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button
                    data-testid="btn-cancel-team"
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsFormOpen(false)}
                  >
                    Batal
                  </Button>
                  <Button data-testid="btn-save-team" variant="teal" size="sm" type="submit">
                    Simpan Tim
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Members Management Section */}
          {selectedTeam ? (
            <div
              data-testid="team-members-section"
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col flex-1"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h3 className="font-bold text-sm text-[#111b21] flex items-center gap-2">
                    <span>Anggota {selectedTeam.name}</span>
                    <Badge variant="ticket-open" size="sm">
                      {selectedTeam.members?.length || 0} Agen
                    </Badge>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Agen dalam tim yang berstatus online akan menerima tiket round-robin
                  </p>
                </div>

                {/* Add Member Dropdown & Button */}
                <div className="flex items-center gap-2">
                  <select
                    data-testid="select-add-member"
                    value={selectedAgentToAdd}
                    onChange={(e) => setSelectedAgentToAdd(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-wa-teal-primary"
                  >
                    <option value="">Pilih agen untuk ditambahkan...</option>
                    {availableAgentsForTeam.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name} ({agent.email})
                      </option>
                    ))}
                  </select>

                  <Button
                    data-testid="btn-add-member"
                    variant="teal"
                    size="sm"
                    onClick={handleAddAgentToTeam}
                    disabled={!selectedAgentToAdd}
                  >
                    + Tambah Anggota
                  </Button>
                </div>
              </div>

              {/* Members List */}
              <div
                data-testid="team-member-list"
                className="flex-1 overflow-y-auto divide-y divide-slate-100"
              >
                {!selectedTeam.members || selectedTeam.members.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Belum ada anggota di tim ini. Tambahkan agen dari menu dropdown di atas.
                  </div>
                ) : (
                  selectedTeam.members.map((member) => (
                    <div key={member.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={member.name}
                          src={member.avatarUrl}
                          size="sm"
                          presence={member.status}
                        />
                        <div>
                          <div className="font-semibold text-xs text-slate-800 flex items-center gap-2">
                            <span>{member.name}</span>
                            <span
                              className={`text-[10px] font-medium capitalize px-1.5 py-0.2 rounded ${
                                member.status === 'online'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : member.status === 'busy'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {member.status || 'offline'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">{member.email}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        data-testid={`btn-remove-member-${member.id}`}
                        onClick={() => handleRemoveAgentFromTeam(member.id)}
                        className="text-xs text-slate-400 hover:text-rose-600 font-medium transition-colors cursor-pointer"
                      >
                        Keluarkan
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
              Pilih salah satu tim di bilah kiri untuk mengelola anggotanya.
            </div>
          )}
        </section>
      </div>
    </div>
  )

  if (isModal) {
    return (
      <div
        data-testid="team-management-modal"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 md:p-8"
      >
        <div className="w-full max-w-5xl h-[85vh] rounded-2xl overflow-hidden shadow-2xl border border-slate-300 bg-white flex flex-col">
          {content}
        </div>
      </div>
    )
  }

  return content
}
