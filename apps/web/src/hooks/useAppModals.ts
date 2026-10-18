import type { BotFlowDefinition, WhatsAppTemplate } from '@xatxoot/shared'
import { useCallback, useEffect, useState } from 'react'
import type { ChannelWizardPayload } from '../components/channels'
import type { WhatsAppChannelSummary } from '../components/layout/types'
import type { BaileysPairingState } from '../components/pairing'
import type { TeamWithMembers } from '../components/teams'
import {
  AVAILABLE_AGENTS,
  INITIAL_BOT_FLOW,
  INITIAL_TEAMS,
  INITIAL_TEMPLATES,
} from '../data/mockData'
import { api } from '../services/apiClient'

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
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false)

  const [teams, setTeams] = useState<TeamWithMembers[]>(INITIAL_TEAMS)
  const [templates] = useState<WhatsAppTemplate[]>(INITIAL_TEMPLATES)
  const [botFlow, setBotFlow] = useState<BotFlowDefinition>(INITIAL_BOT_FLOW)
  const [pairingState, setPairingState] = useState<BaileysPairingState>({
    status: 'connecting',
  })
  const [pairingInboxId, setPairingInboxId] = useState<string>('default')
  const [pairingInboxName, setPairingInboxName] = useState<string>('WhatsApp Layanan CS')
  const [whatsappChannels, setWhatsappChannels] = useState<WhatsAppChannelSummary[]>([])

  // Fetch all WhatsApp channels and their connection statuses
  const fetchWhatsAppChannels = useCallback(async () => {
    try {
      const inboxes = (await api.get('/api/v1/inboxes')) as Array<{
        id: string
        name: string
        channelType: string
      }>
      if (Array.isArray(inboxes)) {
        const waInboxes = inboxes.filter((ib) => ib.channelType === 'whatsapp_unofficial')
        const channelsData: WhatsAppChannelSummary[] = await Promise.all(
          waInboxes.map(async (ib) => {
            try {
              const ch = (await api.get(`/api/v1/inboxes/${ib.id}/channel`)) as {
                phoneNumber?: string | null
                connectionStatus?: string
              }
              return {
                id: ib.id,
                name: ib.name,
                phoneNumber: ch.phoneNumber || null,
                connectionStatus:
                  (ch.connectionStatus as WhatsAppChannelSummary['connectionStatus']) ||
                  'disconnected',
              }
            } catch {
              return {
                id: ib.id,
                name: ib.name,
                phoneNumber: null,
                connectionStatus: 'disconnected',
              }
            }
          }),
        )
        setWhatsappChannels(channelsData)
      }
    } catch {
      // In offline or testing mode, ignore
    }
  }, [])

  useEffect(() => {
    fetchWhatsAppChannels()
  }, [fetchWhatsAppChannels])

  // Fetch live Baileys pairing QR code from backend API
  const fetchBaileysQr = useCallback(async () => {
    try {
      const targetInboxId = pairingInboxId || 'default'
      const data = await api.get<{
        sessionId?: string
        connectionStatus?: string
        qrCode?: string | null
        phoneNumber?: string | null
      }>(`/api/v1/inboxes/${targetInboxId}/channel/whatsapp-unofficial/qr`)

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
    } catch (err) {
      console.error('Failed to fetch Baileys live QR code:', err)
    }
  }, [pairingInboxId])

  const openPairingDialog = useCallback(
    (inboxId = 'default', inboxName = 'WhatsApp Layanan CS') => {
      setPairingInboxId(inboxId)
      setPairingInboxName(inboxName)
      setPairingState({ status: 'connecting' })
      setIsPairingDialogOpen(true)
    },
    [],
  )

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
      const actualChannelType =
        payload.channelType === 'whatsapp_baileys' ? 'whatsapp_unofficial' : payload.channelType

      const res = await api.post<{
        inbox: { id: string; name: string }
        channel?: { id?: string; sessionId?: string }
      }>('/api/v1/inboxes', {
        name: payload.inboxName,
        channelType: actualChannelType,
        channelConfig:
          payload.emailConfig ||
          payload.telegramConfig ||
          payload.facebookConfig ||
          payload.instagramConfig ||
          payload.smsConfig,
      })

      setIsChannelWizardOpen(false)

      if (payload.channelType === 'whatsapp_baileys' && res?.inbox?.id) {
        setPairingInboxId(res.inbox.id)
        setPairingInboxName(res.inbox.name || payload.inboxName)
        setPairingState({
          status: 'connecting',
        })
        setIsPairingDialogOpen(true)
      }
    } catch (err) {
      console.error('Failed to save channel:', err)
      throw err
    }
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
    pairingInboxId,
    setPairingInboxId,
    pairingInboxName,
    setPairingInboxName,
    openPairingDialog,
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
    isUserManagementOpen,
    setIsUserManagementOpen,

    // Data states
    teams,
    templates,
    botFlow,
    setBotFlow,
    pairingState,
    whatsappChannels,
    setWhatsappChannels,
    availableAgents: AVAILABLE_AGENTS,

    // Handlers
    fetchWhatsAppChannels,
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
