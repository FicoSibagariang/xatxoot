import {
  CreateEmailChannelInputSchema,
  CreateFacebookChannelInputSchema,
  CreateInstagramChannelInputSchema,
  CreateSmsChannelInputSchema,
  CreateTelegramChannelInputSchema,
} from '@xatxoot/shared'
import type React from 'react'
import { useState } from 'react'

export type WizardChannelType = 'email' | 'telegram' | 'facebook' | 'instagram' | 'sms'

export interface ChannelWizardPayload {
  channelType: WizardChannelType
  inboxName: string
  emailConfig?: {
    imapHost: string
    imapPort?: number
    imapUsername: string
    imapPassword: string
    smtpHost: string
    smtpPort?: number
    smtpUsername: string
    smtpPassword: string
  }
  telegramConfig?: {
    botToken: string
    botUsername?: string
  }
  facebookConfig?: {
    pageId: string
    pageAccessToken: string
  }
  instagramConfig?: {
    igUserId: string
    igAccessToken: string
  }
  smsConfig?: {
    accountSid: string
    authToken: string
    fromPhoneNumber: string
    providerName?: string
  }
}

export function validateChannelPayload(payload: ChannelWizardPayload): {
  success: boolean
  errors?: Record<string, string>
} {
  const errors: Record<string, string> = {}

  if (!payload.inboxName || payload.inboxName.trim() === '') {
    errors.inboxName = 'Nama inbox wajib diisi'
  }

  if (payload.channelType === 'email') {
    const res = CreateEmailChannelInputSchema.safeParse(payload.emailConfig || {})
    if (!res.success) {
      for (const issue of res.error.issues) {
        const field = issue.path[0] as string
        if (field && !errors[field]) {
          errors[field] = issue.message
        }
      }
    }
  } else if (payload.channelType === 'telegram') {
    const res = CreateTelegramChannelInputSchema.safeParse(payload.telegramConfig || {})
    if (!res.success) {
      for (const issue of res.error.issues) {
        const field = issue.path[0] as string
        if (field && !errors[field]) {
          errors[field] = issue.message
        }
      }
    }
  } else if (payload.channelType === 'facebook') {
    const res = CreateFacebookChannelInputSchema.safeParse(payload.facebookConfig || {})
    if (!res.success) {
      for (const issue of res.error.issues) {
        const field = issue.path[0] as string
        if (field && !errors[field]) {
          errors[field] = issue.message
        }
      }
    }
  } else if (payload.channelType === 'instagram') {
    const res = CreateInstagramChannelInputSchema.safeParse(payload.instagramConfig || {})
    if (!res.success) {
      for (const issue of res.error.issues) {
        const field = issue.path[0] as string
        if (field && !errors[field]) {
          errors[field] = issue.message
        }
      }
    }
  } else if (payload.channelType === 'sms') {
    const res = CreateSmsChannelInputSchema.safeParse(payload.smsConfig || {})
    if (!res.success) {
      for (const issue of res.error.issues) {
        const field = issue.path[0] as string
        if (field && !errors[field]) {
          errors[field] = issue.message
        }
      }
    }
  }

  return {
    success: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  }
}

export interface ChannelWizardProps {
  initialStep?: 'select' | 'configure' | 'success'
  initialChannel?: WizardChannelType
  savedInboxName?: string
  onSaveChannel?: (payload: ChannelWizardPayload) => void | Promise<void>
  onClose?: () => void
}

export function ChannelWizard({
  initialStep = 'select',
  initialChannel = 'email',
  savedInboxName = '',
  onSaveChannel,
  onClose,
}: ChannelWizardProps) {
  const [step, setStep] = useState<'select' | 'configure' | 'success'>(initialStep)
  const [selectedChannel, setSelectedChannel] = useState<WizardChannelType>(initialChannel)
  const [inboxName, setInboxName] = useState(savedInboxName || '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Sub-tab for Meta Social: 'facebook' | 'instagram'
  const [metaSocialMode, setMetaSocialMode] = useState<'facebook' | 'instagram'>('facebook')

  // Form states
  const [emailForm, setEmailForm] = useState({
    imapHost: '',
    imapPort: 993,
    imapUsername: '',
    imapPassword: '',
    smtpHost: '',
    smtpPort: 587,
    smtpUsername: '',
    smtpPassword: '',
  })

  const [telegramForm, setTelegramForm] = useState({
    botToken: '',
    botUsername: '',
  })

  const [facebookForm, setFacebookForm] = useState({
    pageId: '',
    pageAccessToken: '',
  })

  const [instagramForm, setInstagramForm] = useState({
    igUserId: '',
    igAccessToken: '',
  })

  const [smsForm, setSmsForm] = useState({
    accountSid: '',
    authToken: '',
    fromPhoneNumber: '',
    providerName: 'twilio',
  })

  const handleSelectChannel = (channel: WizardChannelType) => {
    setSelectedChannel(channel)
    setStep('configure')
    setErrors({})
    if (!inboxName) {
      const defaultNames: Record<WizardChannelType, string> = {
        email: 'Support Email',
        telegram: 'Telegram Bot Support',
        facebook: 'Facebook Messenger',
        instagram: 'Instagram Direct',
        sms: 'Twilio SMS Helpline',
      }
      setInboxName(defaultNames[channel])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const activeType =
      selectedChannel === 'facebook' && metaSocialMode === 'instagram'
        ? 'instagram'
        : selectedChannel

    const payload: ChannelWizardPayload = {
      channelType: activeType,
      inboxName,
      emailConfig: activeType === 'email' ? emailForm : undefined,
      telegramConfig: activeType === 'telegram' ? telegramForm : undefined,
      facebookConfig: activeType === 'facebook' ? facebookForm : undefined,
      instagramConfig: activeType === 'instagram' ? instagramForm : undefined,
      smsConfig: activeType === 'sms' ? smsForm : undefined,
    }

    const validation = validateChannelPayload(payload)
    if (!validation.success && validation.errors) {
      setErrors(validation.errors)
      return
    }

    setIsSubmitting(true)
    try {
      if (onSaveChannel) {
        await onSaveChannel(payload)
      }
      setStep('success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan konfigurasi channel'
      setErrors({ global: msg })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getWebhookUrl = (channel: WizardChannelType) => {
    switch (channel) {
      case 'telegram':
        return '/api/v1/telegram/webhook'
      case 'facebook':
      case 'instagram':
        return '/api/v1/meta-social/webhook'
      case 'sms':
        return '/api/v1/sms/webhook'
      default:
        return 'IMAP Polling Service Aktif (Pengecekan Inbound Otomatis)'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10 text-xl text-emerald-600">
              🔌
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Tambah Channel Komunikasi</h2>
              <p className="text-xs text-slate-500">
                Hubungkan inbox dengan berbagai saluran omnichannel
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

        {/* Stepper Progress */}
        <div className="flex items-center justify-between border-b border-slate-100 px-8 py-3 bg-slate-50/20 text-xs font-semibold">
          <div
            className={`flex items-center gap-2 ${step === 'select' ? 'text-emerald-700' : 'text-slate-400'}`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                step === 'select' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              1
            </span>
            Pilih Channel
          </div>
          <span className="text-slate-300">───</span>
          <div
            className={`flex items-center gap-2 ${step === 'configure' ? 'text-emerald-700' : 'text-slate-400'}`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                step === 'configure' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              2
            </span>
            Konfigurasi Akun
          </div>
          <span className="text-slate-300">───</span>
          <div
            className={`flex items-center gap-2 ${step === 'success' ? 'text-emerald-700' : 'text-slate-400'}`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                step === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}
            >
              3
            </span>
            Selesai
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {errors.global && (
            <div className="mb-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
              {errors.global}
            </div>
          )}

          {/* STEP 1: SELECT CHANNEL */}
          {step === 'select' && (
            <div>
              <p className="mb-4 text-sm text-slate-600">
                Pilih saluran komunikasi yang ingin Anda hubungkan dengan sistem Xatxoot:
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* 1. Email */}
                <button
                  type="button"
                  onClick={() => handleSelectChannel('email')}
                  className="flex flex-col text-left rounded-xl border border-slate-200 p-4 transition-all hover:border-emerald-500 hover:shadow-md bg-white hover:bg-emerald-50/10 cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">✉️</span>
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                      IMAP / SMTP
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-800">Email</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Kirim dan terima email tiket melalui server mail (Gmail, Outlook, atau custom
                    IMAP/SMTP).
                  </p>
                </button>

                {/* 2. Telegram */}
                <button
                  type="button"
                  onClick={() => handleSelectChannel('telegram')}
                  className="flex flex-col text-left rounded-xl border border-slate-200 p-4 transition-all hover:border-sky-500 hover:shadow-md bg-white hover:bg-sky-50/10 cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">🤖</span>
                    <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 border border-sky-200">
                      Telegram API
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-800">Telegram Bot</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Hubungkan bot resmi Telegram dengan BotFather untuk obrolan langsung dari
                    pelanggan.
                  </p>
                </button>

                {/* 3. Meta Social */}
                <button
                  type="button"
                  onClick={() => handleSelectChannel('facebook')}
                  className="flex flex-col text-left rounded-xl border border-slate-200 p-4 transition-all hover:border-blue-500 hover:shadow-md bg-white hover:bg-blue-50/10 cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">💬</span>
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">
                      Meta Graph API
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-800">Facebook &amp; Instagram</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Kelola pesan dari Facebook Page Messenger &amp; Instagram Direct dalam 1 inbox
                    terpadu.
                  </p>
                </button>

                {/* 4. SMS Twilio */}
                <button
                  type="button"
                  onClick={() => handleSelectChannel('sms')}
                  className="flex flex-col text-left rounded-xl border border-slate-200 p-4 transition-all hover:border-purple-500 hover:shadow-md bg-white hover:bg-purple-50/10 cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">📱</span>
                    <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700 border border-purple-200">
                      Twilio SMS
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-800">SMS Twilio</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Kirim dan terima SMS global melalui Twilio Programmable Messaging API.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: CONFIGURE FORM */}
          {step === 'configure' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">
                  {selectedChannel === 'email' && 'Konfigurasi Channel Email'}
                  {selectedChannel === 'telegram' && 'Konfigurasi Telegram Bot'}
                  {(selectedChannel === 'facebook' || selectedChannel === 'instagram') &&
                    'Konfigurasi Meta Social'}
                  {selectedChannel === 'sms' && 'Konfigurasi SMS (Twilio)'}
                </h3>
                <button
                  type="button"
                  onClick={() => setStep('select')}
                  className="text-xs text-emerald-600 hover:underline"
                >
                  ← Ganti Saluran
                </button>
              </div>

              {/* General: Inbox Name */}
              <div>
                <label
                  htmlFor="wizard-inbox-name"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Nama Inbox
                </label>
                <input
                  id="wizard-inbox-name"
                  type="text"
                  value={inboxName}
                  onChange={(e) => setInboxName(e.target.value)}
                  placeholder="Contoh: CS Email Resmi"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden"
                />
                {errors.inboxName && (
                  <p className="mt-1 text-[11px] text-rose-600">{errors.inboxName}</p>
                )}
              </div>

              {/* 1. EMAIL FORM */}
              {selectedChannel === 'email' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/30">
                    <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                      📥 Server Masuk (IMAP)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label
                          htmlFor="wizard-imap-host"
                          className="block text-[11px] font-semibold text-slate-600 mb-1"
                        >
                          IMAP Host
                        </label>
                        <input
                          id="wizard-imap-host"
                          type="text"
                          value={emailForm.imapHost}
                          onChange={(e) => setEmailForm({ ...emailForm, imapHost: e.target.value })}
                          placeholder="imap.mail.example.com"
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-hidden bg-white"
                        />
                        {errors.imapHost && (
                          <p className="mt-1 text-[10px] text-rose-600">{errors.imapHost}</p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="wizard-imap-port"
                          className="block text-[11px] font-semibold text-slate-600 mb-1"
                        >
                          IMAP Port
                        </label>
                        <input
                          id="wizard-imap-port"
                          type="number"
                          value={emailForm.imapPort}
                          onChange={(e) =>
                            setEmailForm({ ...emailForm, imapPort: Number(e.target.value) })
                          }
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-hidden bg-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                      <div>
                        <label
                          htmlFor="wizard-imap-username"
                          className="block text-[11px] font-semibold text-slate-600 mb-1"
                        >
                          IMAP Username
                        </label>
                        <input
                          id="wizard-imap-username"
                          type="text"
                          value={emailForm.imapUsername}
                          onChange={(e) =>
                            setEmailForm({ ...emailForm, imapUsername: e.target.value })
                          }
                          placeholder="support@example.com"
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-hidden bg-white"
                        />
                        {errors.imapUsername && (
                          <p className="mt-1 text-[10px] text-rose-600">{errors.imapUsername}</p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="wizard-imap-password"
                          className="block text-[11px] font-semibold text-slate-600 mb-1"
                        >
                          IMAP Password
                        </label>
                        <input
                          id="wizard-imap-password"
                          type="password"
                          value={emailForm.imapPassword}
                          onChange={(e) =>
                            setEmailForm({ ...emailForm, imapPassword: e.target.value })
                          }
                          placeholder="••••••••"
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-hidden bg-white"
                        />
                        {errors.imapPassword && (
                          <p className="mt-1 text-[10px] text-rose-600">{errors.imapPassword}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/30">
                    <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                      📤 Server Keluar (SMTP)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label
                          htmlFor="wizard-smtp-host"
                          className="block text-[11px] font-semibold text-slate-600 mb-1"
                        >
                          SMTP Host
                        </label>
                        <input
                          id="wizard-smtp-host"
                          type="text"
                          value={emailForm.smtpHost}
                          onChange={(e) => setEmailForm({ ...emailForm, smtpHost: e.target.value })}
                          placeholder="smtp.mail.example.com"
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-hidden bg-white"
                        />
                        {errors.smtpHost && (
                          <p className="mt-1 text-[10px] text-rose-600">{errors.smtpHost}</p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="wizard-smtp-port"
                          className="block text-[11px] font-semibold text-slate-600 mb-1"
                        >
                          SMTP Port
                        </label>
                        <input
                          id="wizard-smtp-port"
                          type="number"
                          value={emailForm.smtpPort}
                          onChange={(e) =>
                            setEmailForm({ ...emailForm, smtpPort: Number(e.target.value) })
                          }
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-hidden bg-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                      <div>
                        <label
                          htmlFor="wizard-smtp-username"
                          className="block text-[11px] font-semibold text-slate-600 mb-1"
                        >
                          SMTP Username
                        </label>
                        <input
                          id="wizard-smtp-username"
                          type="text"
                          value={emailForm.smtpUsername}
                          onChange={(e) =>
                            setEmailForm({ ...emailForm, smtpUsername: e.target.value })
                          }
                          placeholder="support@example.com"
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-hidden bg-white"
                        />
                        {errors.smtpUsername && (
                          <p className="mt-1 text-[10px] text-rose-600">{errors.smtpUsername}</p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="wizard-smtp-password"
                          className="block text-[11px] font-semibold text-slate-600 mb-1"
                        >
                          SMTP Password
                        </label>
                        <input
                          id="wizard-smtp-password"
                          type="password"
                          value={emailForm.smtpPassword}
                          onChange={(e) =>
                            setEmailForm({ ...emailForm, smtpPassword: e.target.value })
                          }
                          placeholder="••••••••"
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-hidden bg-white"
                        />
                        {errors.smtpPassword && (
                          <p className="mt-1 text-[10px] text-rose-600">{errors.smtpPassword}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. TELEGRAM FORM */}
              {selectedChannel === 'telegram' && (
                <div className="space-y-4">
                  <div className="rounded-xl bg-sky-50 p-3.5 border border-sky-100 text-xs text-sky-800">
                    <p className="font-semibold mb-1">Panduan Membuat Bot Telegram:</p>
                    <ol className="list-decimal pl-4 space-y-0.5 text-[11px]">
                      <li>
                        Buka aplikasi Telegram dan cari <strong>@BotFather</strong>.
                      </li>
                      <li>
                        Kirimkan perintah{' '}
                        <code className="bg-white px-1 py-0.5 rounded">/newbot</code> dan ikuti
                        instruksi nama.
                      </li>
                      <li>Salin API Token yang diberikan ke kolom di bawah.</li>
                    </ol>
                  </div>

                  <div>
                    <label
                      htmlFor="wizard-telegram-token"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Bot Token
                    </label>
                    <input
                      id="wizard-telegram-token"
                      type="text"
                      value={telegramForm.botToken}
                      onChange={(e) =>
                        setTelegramForm({ ...telegramForm, botToken: e.target.value })
                      }
                      placeholder="123456789:ABCdefGhIJKlmNoPQRstuVWXyz"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-hidden"
                    />
                    {errors.botToken && (
                      <p className="mt-1 text-[11px] text-rose-600">{errors.botToken}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="wizard-telegram-username"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Username Bot
                    </label>
                    <input
                      id="wizard-telegram-username"
                      type="text"
                      value={telegramForm.botUsername}
                      onChange={(e) =>
                        setTelegramForm({ ...telegramForm, botUsername: e.target.value })
                      }
                      placeholder="xatxoot_support_bot"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              )}

              {/* 3. META SOCIAL (FB & IG) FORM */}
              {(selectedChannel === 'facebook' || selectedChannel === 'instagram') && (
                <div className="space-y-4">
                  <div className="flex border-b border-slate-200">
                    <button
                      type="button"
                      onClick={() => setMetaSocialMode('facebook')}
                      className={`pb-2 px-4 text-xs font-bold border-b-2 transition-colors ${
                        metaSocialMode === 'facebook'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Facebook Page
                    </button>
                    <button
                      type="button"
                      onClick={() => setMetaSocialMode('instagram')}
                      className={`pb-2 px-4 text-xs font-bold border-b-2 transition-colors ${
                        metaSocialMode === 'instagram'
                          ? 'border-pink-600 text-pink-600'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Instagram Direct
                    </button>
                  </div>

                  {metaSocialMode === 'facebook' ? (
                    <div className="space-y-3">
                      <div>
                        <label
                          htmlFor="wizard-facebook-page-id"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Page ID
                        </label>
                        <input
                          id="wizard-facebook-page-id"
                          type="text"
                          value={facebookForm.pageId}
                          onChange={(e) =>
                            setFacebookForm({ ...facebookForm, pageId: e.target.value })
                          }
                          placeholder="page_123456789"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-hidden"
                        />
                        {errors.pageId && (
                          <p className="mt-1 text-[11px] text-rose-600">{errors.pageId}</p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="wizard-facebook-token"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          Page Access Token
                        </label>
                        <input
                          id="wizard-facebook-token"
                          type="password"
                          value={facebookForm.pageAccessToken}
                          onChange={(e) =>
                            setFacebookForm({ ...facebookForm, pageAccessToken: e.target.value })
                          }
                          placeholder="EAAXxX..."
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-hidden"
                        />
                        {errors.pageAccessToken && (
                          <p className="mt-1 text-[11px] text-rose-600">{errors.pageAccessToken}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label
                          htmlFor="wizard-instagram-user-id"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          IG User ID
                        </label>
                        <input
                          id="wizard-instagram-user-id"
                          type="text"
                          value={instagramForm.igUserId}
                          onChange={(e) =>
                            setInstagramForm({ ...instagramForm, igUserId: e.target.value })
                          }
                          placeholder="ig_987654321"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-pink-500 focus:outline-hidden"
                        />
                        {errors.igUserId && (
                          <p className="mt-1 text-[11px] text-rose-600">{errors.igUserId}</p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="wizard-instagram-token"
                          className="block text-xs font-semibold text-slate-700 mb-1"
                        >
                          IG Access Token
                        </label>
                        <input
                          id="wizard-instagram-token"
                          type="password"
                          value={instagramForm.igAccessToken}
                          onChange={(e) =>
                            setInstagramForm({ ...instagramForm, igAccessToken: e.target.value })
                          }
                          placeholder="EAAXxX_IG..."
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-pink-500 focus:outline-hidden"
                        />
                        {errors.igAccessToken && (
                          <p className="mt-1 text-[11px] text-rose-600">{errors.igAccessToken}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 4. SMS TWILIO FORM */}
              {selectedChannel === 'sms' && (
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="wizard-sms-account-sid"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Account SID
                    </label>
                    <input
                      id="wizard-sms-account-sid"
                      type="text"
                      value={smsForm.accountSid}
                      onChange={(e) => setSmsForm({ ...smsForm, accountSid: e.target.value })}
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-hidden"
                    />
                    {errors.accountSid && (
                      <p className="mt-1 text-[11px] text-rose-600">{errors.accountSid}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="wizard-sms-auth-token"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Auth Token
                    </label>
                    <input
                      id="wizard-sms-auth-token"
                      type="password"
                      value={smsForm.authToken}
                      onChange={(e) => setSmsForm({ ...smsForm, authToken: e.target.value })}
                      placeholder="••••••••••••••••••••••••••••••••"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-hidden"
                    />
                    {errors.authToken && (
                      <p className="mt-1 text-[11px] text-rose-600">{errors.authToken}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="wizard-sms-from-phone"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Nomor Pengirim (From Phone Number)
                    </label>
                    <input
                      id="wizard-sms-from-phone"
                      type="text"
                      value={smsForm.fromPhoneNumber}
                      onChange={(e) => setSmsForm({ ...smsForm, fromPhoneNumber: e.target.value })}
                      placeholder="+1234567890"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-hidden"
                    />
                    {errors.fromPhoneNumber && (
                      <p className="mt-1 text-[11px] text-rose-600">{errors.fromPhoneNumber}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setStep('select')}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Hubungkan Channel'}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: SUCCESS CONFIRMATION */}
          {step === 'success' && (
            <div className="py-4 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600 mb-3">
                ✓
              </span>
              <h3 className="text-base font-bold text-slate-800">Channel Berhasil Ditambahkan!</h3>
              <p className="mt-1 text-xs text-slate-500">
                Inbox <strong>{inboxName || savedInboxName}</strong> telah siap digunakan untuk
                menerima pesan pelanggan.
              </p>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
                <span className="block text-[11px] font-bold text-slate-700 mb-1">
                  Webhook URL / Endpoint Callback:
                </span>
                <div className="flex items-center justify-between rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs font-mono text-slate-800">
                  <span>{getWebhookUrl(selectedChannel)}</span>
                  <span className="text-[10px] text-emerald-600 font-sans font-semibold">
                    Siap Digunakan
                  </span>
                </div>
                <p className="mt-2 text-[10px] text-slate-400">
                  Pasang URL webhook di atas pada konsol developer provider Anda agar webhook
                  receiver Xatxoot dapat menangkap pesan inbound secara real-time.
                </p>
              </div>

              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep('select')
                    setInboxName('')
                  }}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Tambah Saluran Lain
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
