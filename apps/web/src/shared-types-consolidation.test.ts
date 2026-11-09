import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Contact, Conversation, Inbox, Message, Ticket, User } from '@xatxoot/shared'
import type {
  CampaignContactOption,
  CampaignInboxOption,
} from './components/campaigns/CampaignWizard'
import type { ChannelItem } from './components/channels/ChannelManagement'
import type { TimelineMessage } from './components/chat/types'
import type { ContactItem } from './components/contacts/ContactsDashboard'
import type {
  ActiveTicketData,
  ContactDrawerData,
  TicketHistoryItem,
} from './components/drawer/types'
import type { ConversationItem, LayoutUser, TicketSummary } from './components/layout/types'
import type { AgentUser } from './components/teams/TeamManagement'
import type { InboxOption, UserItem } from './components/users/UserManagementModal'

describe('Web Types Consolidation with @xatxoot/shared (Issue #312 - TDD RED)', () => {
  it('ContactsDashboard.tsx must NOT contain inline DEFAULT_SEED_CONTACTS mock array', () => {
    const filePath = join(__dirname, 'components/contacts/ContactsDashboard.tsx')
    const content = readFileSync(filePath, 'utf8')
    expect(content.includes('DEFAULT_SEED_CONTACTS')).toBe(false)
  })

  it('ContactsDashboard.tsx must import Contact schema from @xatxoot/shared', () => {
    const filePath = join(__dirname, 'components/contacts/ContactsDashboard.tsx')
    const content = readFileSync(filePath, 'utf8')
    expect(content).toMatch(/import\s+type\s+.*Contact.*from\s+['"]@xatxoot\/shared['"]/)
  })

  it('UserManagementModal.tsx must import User and/or Inbox schemas from @xatxoot/shared', () => {
    const filePath = join(__dirname, 'components/users/UserManagementModal.tsx')
    const content = readFileSync(filePath, 'utf8')
    expect(content).toMatch(/import\s+type\s+.*User.*from\s+['"]@xatxoot\/shared['"]/)
  })

  it('TeamManagement.tsx must import User from @xatxoot/shared and bind AgentUser to User', () => {
    const filePath = join(__dirname, 'components/teams/TeamManagement.tsx')
    const content = readFileSync(filePath, 'utf8')
    expect(content).toMatch(/import\s+type\s+.*User.*from\s+['"]@xatxoot\/shared['"]/)
  })

  it('CampaignWizard.tsx must import Contact and Inbox from @xatxoot/shared', () => {
    const filePath = join(__dirname, 'components/campaigns/CampaignWizard.tsx')
    const content = readFileSync(filePath, 'utf8')
    expect(content).toMatch(/import\s+type\s+.*(Contact|Inbox).*from\s+['"]@xatxoot\/shared['"]/)
  })

  it('ChannelManagement.tsx must import Inbox from @xatxoot/shared', () => {
    const filePath = join(__dirname, 'components/channels/ChannelManagement.tsx')
    const content = readFileSync(filePath, 'utf8')
    expect(content).toMatch(/import\s+type\s+.*Inbox.*from\s+['"]@xatxoot\/shared['"]/)
  })

  it('layout/types.ts must import domain models from @xatxoot/shared', () => {
    const filePath = join(__dirname, 'components/layout/types.ts')
    const content = readFileSync(filePath, 'utf8')
    expect(content).toMatch(
      /import\s+type\s+.*(User|Ticket|Conversation).*from\s+['"]@xatxoot\/shared['"]/,
    )
  })

  it('chat/types.ts must import Message from @xatxoot/shared', () => {
    const filePath = join(__dirname, 'components/chat/types.ts')
    const content = readFileSync(filePath, 'utf8')
    expect(content).toMatch(/import\s+type\s+.*Message.*from\s+['"]@xatxoot\/shared['"]/)
  })

  it('drawer/types.ts must import domain models from @xatxoot/shared', () => {
    const filePath = join(__dirname, 'components/drawer/types.ts')
    const content = readFileSync(filePath, 'utf8')
    expect(content).toMatch(/import\s+type\s+.*(Contact|Ticket).*from\s+['"]@xatxoot\/shared['"]/)
  })

  it('TypeScript compile-time type compatibility check for View Models vs Domain Models', () => {
    // Contact compatibility
    const sampleContact: Contact = {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Test Customer',
      phoneNumber: '+6281234567890',
      email: 'customer@example.com',
      avatarUrl: null,
      identifier: null,
      contactType: 'customer',
      customAttributes: {},
      additionalAttributes: {},
      blocked: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const sampleContactItem: ContactItem = {
      id: sampleContact.id,
      name: sampleContact.name || '',
      phone: sampleContact.phoneNumber || '',
      email: sampleContact.email || '',
      channel: 'whatsapp',
    }
    expect(sampleContactItem.id).toBe(sampleContact.id)

    // User compatibility
    const sampleUser: User = {
      id: '00000000-0000-0000-0000-000000000002',
      displayName: 'Agent X',
      email: 'agent@example.com',
      role: 'agent',
      availability: 'online',
      active: true,
      createdAt: new Date().toISOString(),
    }
    const sampleUserItem: UserItem = {
      id: sampleUser.id,
      displayName: sampleUser.displayName,
      email: sampleUser.email,
      role: sampleUser.role,
      active: sampleUser.active,
    }
    expect(sampleUserItem.id).toBe(sampleUser.id)

    const sampleAgentUser: AgentUser = {
      id: sampleUser.id,
      name: sampleUser.displayName,
      email: sampleUser.email,
    }
    expect(sampleAgentUser.id).toBe(sampleUser.id)

    // LayoutUser compatibility
    const sampleLayoutUser: LayoutUser = {
      id: sampleUser.id,
      name: sampleUser.displayName,
      email: sampleUser.email,
      role: sampleUser.role,
      status: 'online',
    }
    expect(sampleLayoutUser.id).toBe(sampleUser.id)

    // Message compatibility
    const sampleMessage: Message = {
      id: '00000000-0000-0000-0000-000000000003',
      conversationId: '00000000-0000-0000-0000-000000000004',
      ticketId: null,
      senderType: 'user',
      senderId: sampleUser.id,
      senderName: sampleUser.displayName,
      messageType: 'outgoing',
      contentType: 'text',
      content: 'Halo pelanggan',
      status: 'sent',
      externalSourceId: null,
      contentAttributes: {},
      attachments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const sampleTimelineMessage: TimelineMessage = {
      id: sampleMessage.id,
      conversationId: sampleMessage.conversationId,
      messageType: 'outgoing',
      contentType: 'text',
      content: sampleMessage.content || '',
      timestamp: sampleMessage.createdAt as string,
    }
    expect(sampleTimelineMessage.id).toBe(sampleMessage.id)

    // Ticket compatibility
    const sampleTicket: Ticket = {
      id: '00000000-0000-0000-0000-000000000005',
      displayId: 101,
      conversationId: '00000000-0000-0000-0000-000000000004',
      assigneeId: sampleUser.id,
      status: 'open',
      priority: 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const sampleTicketSummary: TicketSummary = {
      id: sampleTicket.id,
      ticketNumber: `#${sampleTicket.displayId}`,
      status: sampleTicket.status,
    }
    expect(sampleTicketSummary.id).toBe(sampleTicket.id)

    const sampleActiveTicket: ActiveTicketData = {
      id: sampleTicket.id,
      ticketNumber: `#${sampleTicket.displayId}`,
      status: sampleTicket.status,
    }
    expect(sampleActiveTicket.id).toBe(sampleTicket.id)

    const sampleTicketHistoryItem: TicketHistoryItem = {
      id: sampleTicket.id,
      ticketNumber: `#${sampleTicket.displayId}`,
      status: sampleTicket.status,
      createdAt: sampleTicket.createdAt as string,
    }
    expect(sampleTicketHistoryItem.id).toBe(sampleTicket.id)

    // Channel compatibility
    const sampleInbox: Inbox = {
      id: '00000000-0000-0000-0000-000000000006',
      name: 'WhatsApp Official',
      channelType: 'whatsapp_cloud',
      channelId: '00000000-0000-0000-0000-000000000007',
      enableAutoAssign: true,
      greetingEnabled: false,
      workingHoursEnabled: false,
      workingHours: {},
      lockToSingleConv: false,
      senderNameType: 'friendly',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const sampleChannelItem: ChannelItem = {
      id: sampleInbox.id,
      name: sampleInbox.name,
      channelType: sampleInbox.channelType,
    }
    expect(sampleChannelItem.id).toBe(sampleInbox.id)

    const sampleCampaignInbox: CampaignInboxOption = {
      id: sampleInbox.id,
      name: sampleInbox.name,
      channel: sampleInbox.channelType,
    }
    expect(sampleCampaignInbox.id).toBe(sampleInbox.id)

    const sampleCampaignContact: CampaignContactOption = {
      id: sampleContact.id,
      name: sampleContact.name || '',
      phone: sampleContact.phoneNumber || '',
    }
    expect(sampleCampaignContact.id).toBe(sampleContact.id)

    const sampleInboxOption: InboxOption = {
      id: sampleInbox.id,
      name: sampleInbox.name,
      channelType: sampleInbox.channelType,
    }
    expect(sampleInboxOption.id).toBe(sampleInbox.id)

    // ConversationItem compatibility
    const sampleConversation: Conversation = {
      id: '00000000-0000-0000-0000-000000000004',
      inboxId: sampleInbox.id,
      contactId: sampleContact.id,
      unreadCount: 0,
      lastMessageAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const sampleConvItem: ConversationItem = {
      id: sampleConversation.id,
      contactName: sampleContact.name || '',
      channel: 'whatsapp',
    }
    expect(sampleConvItem.id).toBe(sampleConversation.id)

    // ContactDrawerData compatibility
    const sampleDrawerData: ContactDrawerData = {
      contactId: sampleContact.id,
      contactName: sampleContact.name || '',
      channel: 'whatsapp',
    }
    expect(sampleDrawerData.contactId).toBe(sampleContact.id)
  })
})
