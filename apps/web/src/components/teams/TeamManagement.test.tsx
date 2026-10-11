import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { type AgentUser, TeamManagement, type TeamWithMembers } from './TeamManagement'

describe('Team Management & Round-Robin Configuration Component (Task 2.20 - apps/web)', () => {
  const mockAgents: AgentUser[] = [
    {
      id: 'agent-1',
      name: 'Sarah CS',
      email: 'sarah@xatxoot.local',
      role: 'agent',
      status: 'online',
    },
    {
      id: 'agent-2',
      name: 'Budi Support',
      email: 'budi@xatxoot.local',
      role: 'agent',
      status: 'busy',
    },
    {
      id: 'agent-3',
      name: 'Dewi Billing',
      email: 'dewi@xatxoot.local',
      role: 'agent',
      status: 'offline',
    },
  ]

  const mockTeams: TeamWithMembers[] = [
    {
      id: 'team-1',
      name: 'Tim Billing & Tagihan',
      description: 'Menangani konfirmasi transfer dan komplain pembayaran',
      allowAutoAssign: true,
      createdAt: '2026-10-10T10:00:00Z',
      updatedAt: '2026-10-10T10:00:00Z',
      members: [mockAgents[0], mockAgents[2]],
    },
    {
      id: 'team-2',
      name: 'Tim Technical Support',
      description: 'Menangani kendala teknis dan bug sistem',
      allowAutoAssign: false,
      createdAt: '2026-10-10T11:00:00Z',
      updatedAt: '2026-10-10T11:00:00Z',
      members: [mockAgents[1]],
    },
  ]

  describe('Team List Rendering & Round-Robin Badges', () => {
    it('should render teams list with descriptions and member counts', () => {
      const html = renderToStaticMarkup(
        <TeamManagement
          teams={mockTeams}
          availableAgents={mockAgents}
          onSaveTeam={() => {}}
          onDeleteTeam={() => {}}
          onAddMember={() => {}}
          onRemoveMember={() => {}}
          onToggleRoundRobin={() => {}}
        />,
      )

      expect(html).toContain('data-testid="team-management-panel"')
      expect(html).toContain('Tim Billing &amp; Tagihan')
      expect(html).toContain('Tim Technical Support')
      expect(html).toContain('Menangani konfirmasi transfer')
      expect(html).toContain('2 Anggota')
      expect(html).toContain('1 Anggota')
    })

    it('should render active round-robin badge when allowAutoAssign is true', () => {
      const html = renderToStaticMarkup(
        <TeamManagement teams={mockTeams} availableAgents={mockAgents} />,
      )

      expect(html).toContain('data-testid="round-robin-badge-team-1"')
      expect(html).toContain('Round-Robin Aktif')
      expect(html).toContain('data-testid="round-robin-badge-team-2"')
      expect(html).toContain('Auto-Assign Nonaktif')
    })
  })

  describe('Create / Edit Team Form', () => {
    it('should render create team button and form inputs', () => {
      const html = renderToStaticMarkup(
        <TeamManagement teams={mockTeams} availableAgents={mockAgents} isCreateOpen={true} />,
      )

      expect(html).toContain('data-testid="btn-open-create-team"')
      expect(html).toContain('data-testid="team-form"')
      expect(html).toContain('data-testid="input-team-name"')
      expect(html).toContain('data-testid="input-team-description"')
      expect(html).toContain('data-testid="input-team-auto-assign"')
      expect(html).toContain('data-testid="btn-save-team"')
    })
  })

  describe('Team Members Management', () => {
    it('should render members drawer when a team is selected', () => {
      const html = renderToStaticMarkup(
        <TeamManagement teams={mockTeams} availableAgents={mockAgents} selectedTeamId="team-1" />,
      )

      expect(html).toContain('data-testid="team-members-section"')
      expect(html).toContain('Sarah CS')
      expect(html).toContain('Dewi Billing')
      expect(html).toContain('data-testid="select-add-member"')
      expect(html).toContain('data-testid="btn-add-member"')
      expect(html).toContain('data-testid="btn-remove-member-agent-1"')
    })
  })

  describe('Modal Lifecycle Support', () => {
    it('should support rendering inside a dialog modal with close button', () => {
      const html = renderToStaticMarkup(
        <TeamManagement
          teams={mockTeams}
          availableAgents={mockAgents}
          isModal={true}
          onClose={() => {}}
        />,
      )

      expect(html).toContain('data-testid="team-management-modal"')
      expect(html).toContain('data-testid="btn-close-team-modal"')
    })
  })
})
