import type { BotFlowDefinition, WhatsAppTemplate } from '@xatxoot/shared'
import { useCallback, useEffect, useState } from 'react'
import type { ChannelWizardPayload } from '../components/channels'
import type { BaileysPairingState } from '../components/pairing'
import type { TeamWithMembers } from '../components/teams'
import {
  AVAILABLE_AGENTS,
  INITIAL_BOT_FLOW,
  INITIAL_TEAMS,
  INITIAL_TEMPLATES,
} from '../data/mockData'

export interface UseAppModalsOptions {
  onSendTemplateMessage?: (payload: {
    templateId: string
    templateName: string
    parameters: Record<string, string>
  }) => void
}

export function useAppModals({ onSendTemplateMessage }: UseAppModalsOptions = {}) {
  const [isPairingDialogOpen, setIsPairingDialogOpen] = useState(false)
  const [isBotFlowBuilderOpen, setIsBotFlowBuilderOpen] = useState(false)
  const [isTeamManagementOpen, setIsTeamManagementOpen] = useState(false)
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  const [isChannelWizardOpen, setIsChannelWizardOpen] = useState(false)
  const [isBusinessHoursOpen, setIsBusinessHoursOpen] = useState(false)

  const [teams, setTeams] = useState<TeamWithMembers[]>(INITIAL_TEAMS)
  const [templates] = useState<WhatsAppTemplate[]>(INITIAL_TEMPLATES)
  const [botFlow, setBotFlow] = useState<BotFlowDefinition>(INITIAL_BOT_FLOW)
  const [pairingState, setPairingState] = useState<BaileysPairingState>({
    status: 'connecting',
  })

  // Fetch live Baileys pairing QR code from backend API
  const fetchBaileysQr = useCallback(async () => {
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('auth_token') || 'valid-access-token'
          : 'valid-access-token'
      const res = await fetch('/api/v1/inboxes/default/channel/whatsapp-unofficial/qr', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (res.ok) {
        const data = (await res.json()) as {
          sessionId?: string
          connectionStatus?: string
          qrCode?: string | null
          phoneNumber?: string | null
        }
        if (data.connectionStatus === 'connected') {
          setPairingState({
            status: 'connected',
            sessionId: data.sessionId,
            phoneNumber: data.phoneNumber || '+6281234567890',
          })
        } else if (data.qrCode) {
          setPairingState({
            status: 'qr_ready',
            qrData: data.qrCode,
            sessionId: data.sessionId,
          })
        } else {
          setPairingState((prev) => ({
            ...prev,
            status: (data.connectionStatus as BaileysPairingState['status']) || 'connecting',
            sessionId: data.sessionId || prev.sessionId,
          }))
        }
      }
    } catch (err) {
      console.error('Failed to fetch Baileys live QR code:', err)
    }
  }, [])

  // Poll for Baileys pairing QR status while pairing dialog is open
  useEffect(() => {
    if (!isPairingDialogOpen) return

    fetchBaileysQr()
    const timer = setInterval(() => {
      fetchBaileysQr()
    }, 2500)

    return () => clearInterval(timer)
  }, [isPairingDialogOpen, fetchBaileysQr])

  const handleSaveTeam = useCallback((teamData: Partial<TeamWithMembers> & { name: string }) => {
    if (teamData.id) {
      setTeams((prev) =>
        prev.map((t) =>
          t.id === teamData.id
            ? {
                ...t,
                name: teamData.name,
                description: teamData.description,
                allowAutoAssign: teamData.allowAutoAssign,
                updatedAt: new Date().toISOString(),
              }
            : t,
        ),
      )
    } else {
      const newT: TeamWithMembers = {
        id: `team-${Date.now().toString(36)}`,
        name: teamData.name,
        description: teamData.description,
        allowAutoAssign: teamData.allowAutoAssign,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        members: [],
      }
      setTeams((prev) => [...prev, newT])
    }
  }, [])

  const handleDeleteTeam = useCallback((teamId: string) => {
    setTeams((prev) => prev.filter((t) => t.id !== teamId))
  }, [])

  const handleAddTeamMember = useCallback((teamId: string, agentId: string) => {
    const ag = AVAILABLE_AGENTS.find((a) => a.id === agentId)
    if (!ag) return
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? {
              ...t,
              members: [...(t.members || []), ag],
            }
          : t,
      ),
    )
  }, [])

  const handleRemoveTeamMember = useCallback((teamId: string, agentId: string) => {
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? {
              ...t,
              members: (t.members || []).filter((m) => m.id !== agentId),
            }
          : t,
      ),
    )
  }, [])

  const handleToggleRoundRobin = useCallback((teamId: string, activeVal: boolean) => {
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, allowAutoAssign: activeVal } : t)),
    )
  }, [])

  const handleSaveChannel = useCallback(async (payload: ChannelWizardPayload) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
      await fetch('/api/v1/inboxes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: payload.inboxName,
          channelType: payload.channelType,
          channelConfig:
            payload.emailConfig ||
            payload.telegramConfig ||
            payload.facebookConfig ||
            payload.instagramConfig ||
            payload.smsConfig,
        }),
      })
    } catch {
      // ignore network errors
    }
    setIsChannelWizardOpen(false)
  }, [])

  const handleSendTemplate = useCallback(
    (payload: {
      templateId: string
      templateName: string
      parameters: Record<string, string>
    }) => {
      if (onSendTemplateMessage) {
        onSendTemplateMessage(payload)
      }
      setIsTemplateDialogOpen(false)
    },
    [onSendTemplateMessage],
  )

  const handleRefreshPairingQr = useCallback(() => {
    setPairingState((prev) => ({
      ...prev,
      status: 'connecting',
    }))
    fetchBaileysQr()
  }, [fetchBaileysQr])

  return {
    // Dialog visibility states
    isPairingDialogOpen,
    setIsPairingDialogOpen,
    isBotFlowBuilderOpen,
    setIsBotFlowBuilderOpen,
    isTeamManagementOpen,
    setIsTeamManagementOpen,
    isTemplateDialogOpen,
    setIsTemplateDialogOpen,
    isChannelWizardOpen,
    setIsChannelWizardOpen,
    isBusinessHoursOpen,
    setIsBusinessHoursOpen,

    // Data states
    teams,
    templates,
    botFlow,
    setBotFlow,
    pairingState,
    availableAgents: AVAILABLE_AGENTS,

    // Handlers
    handleRefreshPairingQr,
    handleSaveTeam,
    handleDeleteTeam,
    handleAddTeamMember,
    handleRemoveTeamMember,
    handleToggleRoundRobin,
    handleSaveChannel,
    handleSendTemplate,
  }
}
