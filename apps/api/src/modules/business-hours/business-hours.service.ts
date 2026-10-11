import type { BusinessHours, CreateBusinessHoursInput, DaySchedule } from '@xatxoot/shared'

export interface BusinessHoursConfig {
  inboxId?: string
  timezone?: string
  weeklySchedule?: DaySchedule[]
  outOfOfficeMessage?: string
  enabled?: boolean
}

export interface EvaluateOutOfOfficeParams {
  config: BusinessHoursConfig
  conversationId: string
  incomingMessageDate?: Date | string
}

export interface OutOfOfficeEvaluationResult {
  isWithinBusinessHours: boolean
  shouldSendOoo: boolean
  oooMessage?: string
  reason?: 'ALREADY_SENT_WITHIN_24_HOURS' | 'WITHIN_BUSINESS_HOURS' | 'DISABLED'
}

const DAY_NAME_TO_INT: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
}

/**
 * Menentukan apakah sebuah timestamp berada dalam jam kerja yang dikonfigurasi.
 */
export function isWithinBusinessHours(
  config: BusinessHoursConfig,
  targetDate: Date = new Date(),
): boolean {
  // Jika pengaturan business hours dinonaktifkan, inbox dianggap aktif 24/7
  if (config.enabled === false) {
    return true
  }

  // Jika weekly schedule kosong, tidak ada pembatasan operasional
  if (!config.weeklySchedule || config.weeklySchedule.length === 0) {
    return true
  }

  const timezone = config.timezone || 'Asia/Jakarta'

  // Format tanggal ke timezone lokal yang ditentukan
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(targetDate)
  let weekdayStr = ''
  let hourStr = '00'
  let minuteStr = '00'

  for (const part of parts) {
    if (part.type === 'weekday') {
      weekdayStr = part.value.toLowerCase()
    } else if (part.type === 'hour') {
      hourStr = part.value
    } else if (part.type === 'minute') {
      minuteStr = part.value
    }
  }

  // Hono/Node Intl terkadang menghasilkan jam '24' untuk midnight
  if (hourStr === '24') {
    hourStr = '00'
  }

  const currentDayInt = DAY_NAME_TO_INT[weekdayStr] ?? 0
  const currentTime = `${hourStr.padStart(2, '0')}:${minuteStr.padStart(2, '0')}`

  // Cari jadwal hari di weeklySchedule
  const daySchedule = config.weeklySchedule.find((item) => {
    let itemDay: number
    if (typeof item.dayOfWeek === 'number') {
      itemDay = item.dayOfWeek
    } else {
      itemDay = DAY_NAME_TO_INT[String(item.dayOfWeek).toLowerCase()] ?? -1
    }
    return itemDay === currentDayInt
  })

  // Jika tidak ditemukan jadwal untuk hari ini, anggap tutup
  if (!daySchedule) {
    return false
  }

  // Jika hari kerja dinonaktifkan (misal Minggu libur)
  if (!daySchedule.isEnabled) {
    return false
  }

  // Jika buka seharian 24 jam
  if (daySchedule.openAllDay) {
    return true
  }

  // Evaluasi rentang jam buka & tutup
  const openTime = daySchedule.openTime
  const closeTime = daySchedule.closeTime

  return currentTime >= openTime && currentTime < closeTime
}

/**
 * Engine evaluasi pesan di luar jam kerja (OOO)
 * Menerapkan batas kirim 24 jam sekali per percakapan (anti-spam cooldown)
 */
export class BusinessHoursEngine {
  private lastOooSentMap: Map<string, number> = new Map()

  async evaluateOutOfOffice(
    params: EvaluateOutOfOfficeParams,
  ): Promise<OutOfOfficeEvaluationResult> {
    const targetDate = params.incomingMessageDate
      ? new Date(params.incomingMessageDate)
      : new Date()

    const inside = isWithinBusinessHours(params.config, targetDate)

    if (inside) {
      return {
        isWithinBusinessHours: true,
        shouldSendOoo: false,
        reason: 'WITHIN_BUSINESS_HOURS',
      }
    }

    const now = targetDate.getTime()
    const lastSent = this.lastOooSentMap.get(params.conversationId)
    const COOLDOWN_24H_MS = 24 * 60 * 60 * 1000

    if (lastSent && now - lastSent < COOLDOWN_24H_MS) {
      return {
        isWithinBusinessHours: false,
        shouldSendOoo: false,
        reason: 'ALREADY_SENT_WITHIN_24_HOURS',
      }
    }

    // Catat waktu pengiriman OOO
    this.lastOooSentMap.set(params.conversationId, now)

    return {
      isWithinBusinessHours: false,
      shouldSendOoo: true,
      oooMessage:
        params.config.outOfOfficeMessage ||
        'Halo, terima kasih telah menghubungi kami. Saat ini kami sedang di luar jam operasional kerja.',
    }
  }

  resetCooldowns(): void {
    this.lastOooSentMap.clear()
  }
}

/**
 * BusinessHours Service untuk penyimpanan dan orkestrasi
 */
export class BusinessHoursService {
  private engine: BusinessHoursEngine
  private configs: Map<string, BusinessHoursConfig> = new Map()

  constructor(engine?: BusinessHoursEngine) {
    this.engine = engine || new BusinessHoursEngine()
  }

  async getBusinessHours(inboxId: string): Promise<BusinessHoursConfig | null> {
    return this.configs.get(inboxId) || null
  }

  async upsertBusinessHours(config: BusinessHoursConfig): Promise<BusinessHoursConfig> {
    const inboxId = config.inboxId || 'default'
    const storedConfig: BusinessHoursConfig = {
      ...config,
      inboxId,
      timezone: config.timezone || 'Asia/Jakarta',
      weeklySchedule: config.weeklySchedule || [],
      outOfOfficeMessage:
        config.outOfOfficeMessage ||
        'Halo, terima kasih telah menghubungi kami. Saat ini kami sedang di luar jam operasional kerja.',
      enabled: config.enabled !== undefined ? config.enabled : true,
    }

    this.configs.set(inboxId, storedConfig)
    return storedConfig
  }

  async evaluateOutOfOffice(
    params: EvaluateOutOfOfficeParams,
  ): Promise<OutOfOfficeEvaluationResult> {
    return this.engine.evaluateOutOfOffice(params)
  }
}
