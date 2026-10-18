import type { BotFlowDefinition, WhatsAppTemplate } from '@xatxoot/shared'
import { BusinessHoursSettings } from '../business-hours'
import { ChannelWizard, type ChannelWizardPayload } from '../channels'
import { VisualFlowBuilder } from '../flow-builder'
import { BaileysPairingDialog, type BaileysPairingState } from '../pairing'
import { type AgentUser, TeamManagement, type TeamWithMembers } from '../teams'
import { WhatsAppTemplateDialog } from '../templates'
import { UserManagementModal } from '../users'

export interface AppModalsProps {
  // Baileys Pairing Dialog
  isPairingDialogOpen: boolean
  pairingState: BaileysPairingState
  pairingInboxName?: string
  onClosePairingDialog: () => void
  onRefreshPairingQr: () => void
  onRetryPairing: () => void

  // Bot Flow Builder
  isBotFlowBuilderOpen: boolean
  botFlow: BotFlowDefinition
  onSaveBotFlow: (flow: BotFlowDefinition) => void
  onCloseBotFlowBuilder: () => void

  // Team Management
  isTeamManagementOpen: boolean
  teams: TeamWithMembers[]
  availableAgents: AgentUser[]
  onSaveTeam: (teamData: Partial<TeamWithMembers> & { name: string }) => void
  onDeleteTeam: (teamId: string) => void
  onAddTeamMember: (teamId: string, agentId: string) => void
  onRemoveTeamMember: (teamId: string, agentId: string) => void
  onToggleRoundRobin: (teamId: string, active: boolean) => void
  onCloseTeamManagement: () => void

  // Template Dialog
  isTemplateDialogOpen: boolean
  selectedConversationId: string | null
  templates: WhatsAppTemplate[]
  onCloseTemplateDialog: () => void
  onSendTemplate: (payload: {
    templateId: string
    templateName: string
    parameters: Record<string, string>
  }) => void

  // Channel Wizard
  isChannelWizardOpen: boolean
  onCloseChannelWizard: () => void
  onOpenWhatsAppPairingFromWizard: () => void
  onSaveChannel: (payload: ChannelWizardPayload) => Promise<void> | void

  // Business Hours Settings
  isBusinessHoursOpen: boolean
  onCloseBusinessHours: () => void
  onSaveBusinessHours?: (config: unknown) => void

  // User Management
  isUserManagementOpen?: boolean
  onCloseUserManagement?: () => void
}

export function AppModals({
  isPairingDialogOpen,
  pairingState,
  pairingInboxName,
  onClosePairingDialog,
  onRefreshPairingQr,
  onRetryPairing,
  isBotFlowBuilderOpen,
  botFlow,
  onSaveBotFlow,
  onCloseBotFlowBuilder,
  isTeamManagementOpen,
  teams,
  availableAgents,
  onSaveTeam,
  onDeleteTeam,
  onAddTeamMember,
  onRemoveTeamMember,
  onToggleRoundRobin,
  onCloseTeamManagement,
  isTemplateDialogOpen,
  selectedConversationId,
  templates,
  onCloseTemplateDialog,
  onSendTemplate,
  isChannelWizardOpen,
  onCloseChannelWizard,
  onOpenWhatsAppPairingFromWizard,
  onSaveChannel,
  isBusinessHoursOpen,
  onCloseBusinessHours,
  onSaveBusinessHours,
  isUserManagementOpen = false,
  onCloseUserManagement,
}: AppModalsProps) {
  return (
    <>
      <BaileysPairingDialog
        isOpen={isPairingDialogOpen}
        inboxName={pairingInboxName || 'WhatsApp Layanan CS'}
        state={pairingState}
        onClose={onClosePairingDialog}
        onRefreshQr={onRefreshPairingQr}
        onRetry={onRetryPairing}
      />

      {isBotFlowBuilderOpen && (
        <div
          data-testid="bot-flow-builder-modal"
          className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-xs p-4 md:p-8"
        >
          <div className="flex-1 rounded-2xl overflow-hidden shadow-2xl border border-slate-300 bg-white flex flex-col">
            <VisualFlowBuilder
              initialFlow={botFlow}
              onSave={onSaveBotFlow}
              onCancel={onCloseBotFlowBuilder}
            />
          </div>
        </div>
      )}

      {isTeamManagementOpen && (
        <TeamManagement
          teams={teams}
          availableAgents={availableAgents}
          isModal={true}
          onSaveTeam={onSaveTeam}
          onDeleteTeam={onDeleteTeam}
          onAddMember={onAddTeamMember}
          onRemoveMember={onRemoveTeamMember}
          onToggleRoundRobin={onToggleRoundRobin}
          onClose={onCloseTeamManagement}
        />
      )}

      {isTemplateDialogOpen && (
        <WhatsAppTemplateDialog
          isOpen={isTemplateDialogOpen}
          conversationId={selectedConversationId || 'conv-1'}
          templates={templates}
          onClose={onCloseTemplateDialog}
          onSendTemplate={onSendTemplate}
        />
      )}

      {isChannelWizardOpen && (
        <ChannelWizard
          onClose={onCloseChannelWizard}
          onOpenWhatsAppPairing={onOpenWhatsAppPairingFromWizard}
          onSaveChannel={onSaveChannel}
        />
      )}

      {isBusinessHoursOpen && (
        <BusinessHoursSettings
          inboxName="WhatsApp Layanan CS"
          onClose={onCloseBusinessHours}
          onSave={(_config) => {
            if (onSaveBusinessHours) onSaveBusinessHours(_config)
            onCloseBusinessHours()
          }}
        />
      )}

      {isUserManagementOpen && (
        <UserManagementModal
          isOpen={isUserManagementOpen}
          onClose={onCloseUserManagement || (() => {})}
        />
      )}
    </>
  )
}

export default AppModals
