import { beforeEach, describe, expect, it } from 'bun:test'
import app from '../../index'
import { resetConversationStore } from '../conversations/conversations.service'
import { inboxService } from '../inboxes/inboxes.service'
import { resetMessageStore } from '../messages/message-store'

describe('WhatsApp Unofficial Webhook - WhatsApp Group Handling (TDD RED)', () => {
  let inboxId: string
  const groupJid = '120363209784423627@g.us'

  beforeEach(async () => {
    resetConversationStore()
    resetMessageStore()

    const { inbox } = await inboxService.createInbox({
      name: 'WA Unofficial Group Inbox',
      channelType: 'whatsapp_unofficial',
      channel: { sessionId: 'session_group_test_01' },
    })
    inboxId = inbox.id
  })

  it('should recognize 120363... group JID, preserve groupJid, and extract participant metadata', async () => {
    const payload = {
      sessionId: 'session_group_test_01',
      inboxId,
      senderNumber: '120363209784423627@g.us',
      senderName: 'Wardi',
      isGroup: true,
      groupJid,
      participant: '62811638688',
      participantName: 'Wardi',
      content: '!ping',
      externalMessageId: 'WA_GRP_MSG_001',
    }

    const res = await app.request('/api/v1/webhooks/whatsapp-unofficial/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      success: boolean
      conversationId: string
      contactId: string
    }
    expect(data.success).toBe(true)

    // Verify conversation detail via API
    const convRes = await app.request(`/api/v1/conversations/${data.conversationId}`, {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-access-token' },
    })
    expect(convRes.status).toBe(200)
    const convData = (await convRes.json()) as {
      conversation: { id: string; isGroup?: boolean; groupJid?: string }
      contact: { id: string; phoneNumber?: string; name?: string }
      messages: Array<{
        id: string
        content: string
        isGroup?: boolean
        participant?: string
        participantName?: string
      }>
    }

    expect(convData.conversation.isGroup).toBe(true)
    expect(convData.conversation.groupJid).toBe(groupJid)
    expect(convData.contact.phoneNumber).toBe(groupJid)

    const msg = convData.messages.find((m) => m.content === '!ping')
    expect(msg).toBeDefined()
    expect(msg?.isGroup).toBe(true)
    expect(msg?.participant).toBe('62811638688')
    expect(msg?.participantName).toBe('Wardi')
  })

  it('should auto-detect group when senderNumber has 18 digits starting with 120363 even without @g.us', async () => {
    const payload = {
      sessionId: 'session_group_test_01',
      inboxId,
      senderNumber: '120363209784423627', // bare number without @g.us
      senderName: 'Wardi',
      participant: '62811638688',
      participantName: 'Wardi',
      content: '!qstat',
      externalMessageId: 'WA_GRP_MSG_002',
    }

    const res = await app.request('/api/v1/webhooks/whatsapp-unofficial/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as { success: boolean; conversationId: string }
    expect(data.success).toBe(true)

    const convRes = await app.request(`/api/v1/conversations/${data.conversationId}`, {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-access-token' },
    })
    const convData = (await convRes.json()) as {
      conversation: { isGroup?: boolean; groupJid?: string }
    }

    expect(convData.conversation.isGroup).toBe(true)
    expect(convData.conversation.groupJid).toBe(groupJid)
  })

  it('should use groupName when provided in payload as contact name', async () => {
    const payload = {
      sessionId: 'session_group_test_01',
      inboxId,
      senderNumber: '120363209784423627@g.us',
      senderName: 'Wardi',
      isGroup: true,
      groupJid,
      groupName: 'NOC Alert & Monitoring',
      participant: '62811638688',
      participantName: 'Wardi',
      content: '!status',
      externalMessageId: 'WA_GRP_MSG_003',
    }

    const res = await app.request('/api/v1/webhooks/whatsapp-unofficial/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    expect(res.status).toBe(200)
    const data = (await res.json()) as { success: boolean; conversationId: string }
    expect(data.success).toBe(true)

    const convRes = await app.request(`/api/v1/conversations/${data.conversationId}`, {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-access-token' },
    })
    const convData = (await convRes.json()) as {
      contact: { name?: string }
    }

    expect(convData.contact.name).toBe('NOC Alert & Monitoring')
  })

  it('should update existing contact name from Grup WhatsApp to real groupName', async () => {
    // 1. Initial message without groupName (gets default 'Grup WhatsApp')
    const payload1 = {
      sessionId: 'session_group_test_01',
      inboxId,
      senderNumber: '120363209784423627@g.us',
      isGroup: true,
      groupJid,
      content: 'Pesan awal',
      externalMessageId: 'WA_GRP_MSG_004',
    }

    const res1 = await app.request('/api/v1/webhooks/whatsapp-unofficial/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload1),
    })
    expect(res1.status).toBe(200)
    const data1 = (await res1.json()) as { conversationId: string }

    const convRes1 = await app.request(`/api/v1/conversations/${data1.conversationId}`, {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-access-token' },
    })
    const convData1 = (await convRes1.json()) as { contact: { name?: string } }
    expect(convData1.contact.name).toBe('Grup WhatsApp')

    // 2. Second message arrives with groupName fetched from Baileys
    const payload2 = {
      sessionId: 'session_group_test_01',
      inboxId,
      senderNumber: '120363209784423627@g.us',
      isGroup: true,
      groupJid,
      groupName: 'Tim Infrastruktur Network',
      content: 'Pesan lanjutan',
      externalMessageId: 'WA_GRP_MSG_005',
    }

    const res2 = await app.request('/api/v1/webhooks/whatsapp-unofficial/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload2),
    })
    expect(res2.status).toBe(200)

    const convRes2 = await app.request(`/api/v1/conversations/${data1.conversationId}`, {
      method: 'GET',
      headers: { Authorization: 'Bearer valid-access-token' },
    })
    const convData2 = (await convRes2.json()) as { contact: { name?: string } }
    expect(convData2.contact.name).toBe('Tim Infrastruktur Network')
  })
})
