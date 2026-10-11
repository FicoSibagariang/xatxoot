import { SendWhatsAppTemplateMessageInputSchema } from '@xatxoot/shared'
import type { Context } from 'hono'
import { whatsAppTemplateService } from './whatsapp-templates.service'

export async function handleListTemplates(c: Context) {
  try {
    const status = c.req.query('status')
    const category = c.req.query('category')
    const language = c.req.query('language')
    const search = c.req.query('search')

    const templates = await whatsAppTemplateService.listTemplates({
      status,
      category,
      language,
      search,
    })

    return c.json({ templates }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return c.json({ error: message }, 500)
  }
}

export async function handleGetTemplate(c: Context) {
  try {
    const id = c.req.param('id')
    const template = await whatsAppTemplateService.getTemplateById(id)
    if (!template) {
      return c.json({ error: 'WhatsApp template not found' }, 404)
    }
    return c.json({ template }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return c.json({ error: message }, 500)
  }
}

export async function handleSyncTemplates(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}))
    const result = await whatsAppTemplateService.syncTemplates(body)
    return c.json(result, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return c.json({ error: message }, 500)
  }
}

export async function handleSendTemplateMessage(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}))
    const parsed = SendWhatsAppTemplateMessageInputSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'Invalid input', issues: parsed.error.issues }, 400)
    }

    const result = await whatsAppTemplateService.sendTemplateMessage(parsed.data)
    return c.json(result, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    if (message.includes('tidak disetujui') || message.includes('REJECTED')) {
      return c.json({ error: message }, 400)
    }
    if (message.includes('not found') || message.includes('tidak ditemukan')) {
      return c.json({ error: message }, 404)
    }
    return c.json({ error: message }, 500)
  }
}
