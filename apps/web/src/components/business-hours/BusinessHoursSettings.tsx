import type { DaySchedule } from '@xatxoot/shared'
import type React from 'react'
import { useState } from 'react'

export interface BusinessHoursUiConfig {
  inboxId?: string
  timezone: string
  enabled: boolean
  weeklySchedule: DaySchedule[]
  outOfOfficeMessage: string
}

export const STANDARD_WEEKLY_SCHEDULE: DaySchedule[] = [
  { dayOfWeek: 0, openTime: '00:00', closeTime: '00:00', isEnabled: false }, // Minggu
  { dayOfWeek: 1, openTime: '08:00', closeTime: '17:00', isEnabled: true }, // Senin
  { dayOfWeek: 2, openTime: '08:00', closeTime: '17:00', isEnabled: true }, // Selasa
  { dayOfWeek: 3, openTime: '08:00', closeTime: '17:00', isEnabled: true }, // Rabu
  { dayOfWeek: 4, openTime: '08:00', closeTime: '17:00', isEnabled: true }, // Kamis
  { dayOfWeek: 5, openTime: '08:00', closeTime: '17:00', isEnabled: true }, // Jumat
  { dayOfWeek: 6, openTime: '09:00', closeTime: '14:00', isEnabled: true }, // Sabtu
]

export const DAY_NAMES: { id: number; name: string; short: string }[] = [
  { id: 0, name: 'Minggu', short: 'Min' },
  { id: 1, name: 'Senin', short: 'Sen' },
  { id: 2, name: 'Selasa', short: 'Sel' },
  { id: 3, name: 'Rabu', short: 'Rab' },
  { id: 4, name: 'Kamis', short: 'Kam' },
  { id: 5, name: 'Jumat', short: 'Jum' },
  { id: 6, name: 'Sabtu', short: 'Sab' },
]

export function validateBusinessHoursConfig(config: BusinessHoursUiConfig): {
  success: boolean
  errors?: Record<string, string>
} {
  const errors: Record<string, string> = {}

  if (!config.outOfOfficeMessage || config.outOfOfficeMessage.trim() === '') {
    errors.outOfOfficeMessage = 'Pesan di luar jam kerja wajib diisi'
  }

  if (config.enabled && config.weeklySchedule) {
    for (const day of config.weeklySchedule) {
      if (day.isEnabled && !day.openAllDay) {
        if (!day.openTime || !day.closeTime) {
          errors[`day_${day.dayOfWeek}`] = 'Jam buka dan jam tutup wajib diisi'
        } else if (day.closeTime <= day.openTime) {
          errors[`day_${day.dayOfWeek}`] = 'Jam tutup harus lebih besar daripada jam buka'
        }
      }
    }
  }

  return {
    success: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  }
}

export interface BusinessHoursSettingsProps {
  inboxId?: string
  inboxName?: string
  initialConfig?: Partial<BusinessHoursUiConfig>
  onSave?: (config: BusinessHoursUiConfig) => void | Promise<void>
  onClose?: () => void
}

export function BusinessHoursSettings({
  inboxId,
  inboxName = 'Inbox Utama',
  initialConfig,
  onSave,
  onClose,
}: BusinessHoursSettingsProps) {
  const [enabled, setEnabled] = useState(
    initialConfig?.enabled !== undefined ? initialConfig.enabled : true,
  )
  const [timezone, setTimezone] = useState(initialConfig?.timezone || 'Asia/Jakarta')
  const [schedule, setSchedule] = useState<DaySchedule[]>(
    initialConfig?.weeklySchedule && initialConfig.weeklySchedule.length === 7
      ? initialConfig.weeklySchedule
      : STANDARD_WEEKLY_SCHEDULE,
  )
  const [outOfOfficeMessage, setOutOfOfficeMessage] = useState(
    initialConfig?.outOfOfficeMessage ||
      'Halo, terima kasih telah menghubungi kami. Saat ini kami sedang di luar jam operasional kerja.',
  )

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const handleDayToggle = (dayOfWeek: number) => {
    setSchedule((prev) =>
      prev.map((item) =>
        item.dayOfWeek === dayOfWeek ? { ...item, isEnabled: !item.isEnabled } : item,
      ),
    )
  }

  const handleAllDayToggle = (dayOfWeek: number) => {
    setSchedule((prev) =>
      prev.map((item) =>
        item.dayOfWeek === dayOfWeek ? { ...item, openAllDay: !item.openAllDay } : item,
      ),
    )
  }

  const handleTimeChange = (dayOfWeek: number, field: 'openTime' | 'closeTime', value: string) => {
    setSchedule((prev) =>
      prev.map((item) => (item.dayOfWeek === dayOfWeek ? { ...item, [field]: value } : item)),
    )
  }

  const handleApplyPreset = () => {
    setSchedule(STANDARD_WEEKLY_SCHEDULE)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setSaveSuccess(false)

    const payload: BusinessHoursUiConfig = {
      inboxId,
      timezone,
      enabled,
      weeklySchedule: schedule,
      outOfOfficeMessage,
    }

    const validation = validateBusinessHoursConfig(payload)
    if (!validation.success && validation.errors) {
      setErrors(validation.errors)
      return
    }

    setIsSaving(true)
    try {
      if (onSave) {
        await onSave(payload)
      }
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan pengaturan jam kerja'
      setErrors({ global: msg })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10 text-xl text-emerald-600">
              🕒
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Pengaturan Jam Kerja (Business Hours)
              </h2>
              <p className="text-xs text-slate-500">
                Atur jadwal operasional dan auto-reply untuk <strong>{inboxName}</strong>
              </p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        {/* Content Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errors.global && (
            <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
              {errors.global}
            </div>
          )}

          {saveSuccess && (
            <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700 border border-emerald-200 flex items-center gap-2">
              <span>✓</span> Pengaturan jam kerja berhasil disimpan!
            </div>
          )}

          {/* Master Enable/Disable Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4 bg-slate-50/40">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Aktifkan Jam Kerja</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Batasi penerimaan pesan di luar jam kerja dengan pesan balasan otomatis
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600" />
            </label>
          </div>

          {!enabled ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800">
              <p className="font-semibold mb-1">Jam kerja dinonaktifkan</p>
              <p>
                Inbox ini akan melayani pesan 24 jam sehari (24/7) tanpa memicu balasan otomatis di
                luar jam kerja.
              </p>
            </div>
          ) : (
            <>
              {/* Timezone Selector & Preset Shortcut */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <label
                    htmlFor="bhours-timezone"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Zona Waktu (Timezone)
                  </label>
                  <select
                    id="bhours-timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-hidden bg-white text-slate-800 font-medium"
                  >
                    <option value="Asia/Jakarta">Asia/Jakarta (WIB, UTC+7)</option>
                    <option value="Asia/Makassar">Asia/Makassar (WITA, UTC+8)</option>
                    <option value="Asia/Jayapura">Asia/Jayapura (WIT, UTC+9)</option>
                    <option value="UTC">UTC (GMT+0)</option>
                    <option value="America/New_York">America/New_York (EST/EDT)</option>
                  </select>
                </div>

                <div className="flex justify-start sm:justify-end items-end h-full pt-4">
                  <button
                    type="button"
                    onClick={handleApplyPreset}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
                  >
                    <span>⚡</span> Terapkan Jadwal Standar
                  </button>
                </div>
              </div>

              {/* Weekly Schedule Table / Grid */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50/70 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Hari &amp; Jam Operasional</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    Format 24 Jam (HH:mm)
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {DAY_NAMES.map((day) => {
                    const dayConfig = schedule.find((s) => s.dayOfWeek === day.id) || {
                      dayOfWeek: day.id,
                      openTime: '08:00',
                      closeTime: '17:00',
                      isEnabled: false,
                    }
                    const dayError = errors[`day_${day.id}`]

                    return (
                      <div
                        key={day.id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2 transition-colors ${
                          dayConfig.isEnabled ? 'bg-white' : 'bg-slate-50/40 opacity-75'
                        }`}
                      >
                        {/* Day label & Enable Checkbox */}
                        <div className="flex items-center gap-3 min-w-[120px]">
                          <input
                            type="checkbox"
                            id={`day-toggle-${day.id}`}
                            checked={dayConfig.isEnabled}
                            onChange={() => handleDayToggle(day.id)}
                            className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                          />
                          <label
                            htmlFor={`day-toggle-${day.id}`}
                            className="text-xs font-semibold text-slate-800 cursor-pointer select-none"
                          >
                            {day.name}
                          </label>
                        </div>

                        {/* Schedule Controls */}
                        {dayConfig.isEnabled ? (
                          <div className="flex flex-wrap items-center gap-3">
                            {/* 24-Hour Option */}
                            <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!dayConfig.openAllDay}
                                onChange={() => handleAllDayToggle(day.id)}
                                className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                              />
                              Buka 24 Jam
                            </label>

                            {!dayConfig.openAllDay && (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="time"
                                  value={dayConfig.openTime}
                                  onChange={(e) =>
                                    handleTimeChange(day.id, 'openTime', e.target.value)
                                  }
                                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-800 bg-white focus:border-emerald-500 focus:outline-hidden"
                                />
                                <span className="text-xs text-slate-400">s/d</span>
                                <input
                                  type="time"
                                  value={dayConfig.closeTime}
                                  onChange={(e) =>
                                    handleTimeChange(day.id, 'closeTime', e.target.value)
                                  }
                                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-800 bg-white focus:border-emerald-500 focus:outline-hidden"
                                />
                              </div>
                            )}

                            {dayError && (
                              <span className="text-[10px] text-rose-600 font-medium">
                                {dayError}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Libur (Tutup)</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Out-of-Office Message Textarea */}
              <div className="space-y-1.5">
                <label
                  htmlFor="out-of-office-msg"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Pesan Otomatis di Luar Jam Kerja (Out-of-Office Auto-Reply)
                </label>
                <textarea
                  id="out-of-office-msg"
                  rows={3}
                  value={outOfOfficeMessage}
                  onChange={(e) => setOutOfOfficeMessage(e.target.value)}
                  placeholder="Ketik pesan yang akan dikirim secara otomatis..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 focus:border-emerald-500 focus:outline-hidden bg-white shadow-2xs"
                />
                {errors.outOfOfficeMessage && (
                  <p className="text-[11px] text-rose-600 font-medium">
                    {errors.outOfOfficeMessage}
                  </p>
                )}
                <p className="text-[11px] text-slate-400">
                  🛡️ Pembatasan Anti-Spam: Pesan ini hanya dikirimkan 1 kali dalam rentang 24 jam per
                  percakapan.
                </p>
              </div>
            </>
          )}

          {/* Form Actions Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Tutup
              </button>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan Jam Kerja'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default BusinessHoursSettings
