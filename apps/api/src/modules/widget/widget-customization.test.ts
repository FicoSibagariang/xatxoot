import { beforeEach, describe, expect, it } from 'bun:test'
import app from '../../index'
import { inboxService, resetInboxStore } from '../inboxes/inboxes.service'

const AUTH_HEADER = {
  Authorization: 'Bearer valid-access-token',
}

describe('Widget Inbox Customization Synchronization (Task 1.31 - apps/api)', () => {
  let websiteToken: string
  let inboxId: string

  beforeEach(async () => {
    resetInboxStore()

    websiteToken = 'wt_custom_sync_99'
    const created = await inboxService.createInbox({
      name: 'Inbox Web Awal',
      channelType: 'web_widget',
      channel: {
        websiteToken,
        widgetColor: '#00a884',
        replyTime: 'in_a_few_minutes',
      },
      greetingEnabled: true,
      greetingMessage: 'Pesan awal',
    })
    inboxId = created.inbox.id
  })

  it('should reflect updated inbox name and channel widgetColor in /api/v1/widget/config', async () => {
    // 1. Update inbox name & channel widget color
    const updateRes = await app.request(`/api/v1/inboxes/${inboxId}`, {
      method: 'PATCH',
      headers: {
        ...AUTH_HEADER,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Live Chat Kustom Premium',
        greetingMessage: 'Selamat datang di layanan prioritas!',
        channel: {
          widgetColor: '#7c3aed', // Ungu
          replyTime: 'in_a_few_hours',
        },
      }),
    })

    expect(updateRes.status).toBe(200)

    // 2. Fetch public widget config by website_token
    const configRes = await app.request(`/api/v1/widget/config?website_token=${websiteToken}`)
    expect(configRes.status).toBe(200)
    const configData = await configRes.json()

    expect(configData.name).toBe('Live Chat Kustom Premium')
    expect(configData.widgetColor).toBe('#7c3aed')
    expect(configData.greetingMessage).toBe('Selamat datang di layanan prioritas!')
    expect(configData.replyTime).toBe('in_a_few_hours')
  })
})
