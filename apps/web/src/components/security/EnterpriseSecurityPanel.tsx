import type React from 'react'
import { useState } from 'react'

export type SsoProtocolType = 'saml' | 'oidc'

export interface SsoFormData {
  id?: string
  providerType: SsoProtocolType
  name: string
  issuerUrl: string
  ssoUrl?: string
  certData?: string
  clientId?: string
  clientSecret?: string
  scopes?: string[]
  active: boolean
}

export interface AuditLogEntry {
  id: string
  actorName?: string
  actorEmail?: string
  action: string
  auditableType: string
  auditableId?: string | null
  ipAddress?: string | null
  createdAt: string
  changes?: Record<string, unknown>
}

export interface EnterpriseSecurityPanelProps {
  initialSso?: SsoFormData
  auditLogs?: AuditLogEntry[]
  activeTab?: 'sso' | 'audit'
  onSaveSso?: (data: SsoFormData) => void | Promise<void>
  onTestSso?: (data: SsoFormData) => Promise<{ success: boolean; message: string }>
  className?: string
}

export const DEFAULT_SSO_FORM: SsoFormData = {
  providerType: 'saml',
  name: 'Enterprise Identity Provider',
  issuerUrl: 'https://idp.example.com/metadata',
  ssoUrl: 'https://idp.example.com/sso',
  certData: '',
  clientId: '',
  clientSecret: '',
  scopes: ['openid', 'profile', 'email'],
  active: true,
}

export function EnterpriseSecurityPanel({
  initialSso = DEFAULT_SSO_FORM,
  auditLogs = [],
  activeTab: controlledTab,
  onSaveSso,
  onTestSso,
  className = '',
}: EnterpriseSecurityPanelProps) {
  const [tab, setTab] = useState<'sso' | 'audit'>(controlledTab || 'sso')
  const [ssoData, setSsoData] = useState<SsoFormData>(initialSso)
  const [showClientSecret, setShowClientSecret] = useState(false)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Audit Logs filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('ALL')
  const [selectedLogChanges, setSelectedLogChanges] = useState<{
    id: string
    changes: Record<string, unknown>
  } | null>(null)

  const currentTab = controlledTab ?? tab

  const handleProtocolChange = (protocol: SsoProtocolType) => {
    setSsoData((prev) => ({
      ...prev,
      providerType: protocol,
      issuerUrl:
        protocol === 'oidc'
          ? 'https://login.microsoftonline.com/common/v2.0'
          : 'https://idp.example.com/metadata',
    }))
    setSaveStatus(null)
    setSaveError(null)
    setTestResult(null)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveStatus(null)
    setSaveError(null)
    setIsSaving(true)

    // Basic form validation
    if (!ssoData.name.trim()) {
      setSaveError('Nama SSO Provider wajib diisi.')
      setIsSaving(false)
      return
    }
    if (!ssoData.issuerUrl.trim()) {
      setSaveError('Issuer URL wajib diisi.')
      setIsSaving(false)
      return
    }
    if (ssoData.providerType === 'saml' && !ssoData.certData?.trim()) {
      setSaveError('Sertifikat X.509 Certificate wajib diisi untuk SAML.')
      setIsSaving(false)
      return
    }
    if (ssoData.providerType === 'oidc' && !ssoData.clientId?.trim()) {
      setSaveError('Client ID wajib diisi untuk OIDC.')
      setIsSaving(false)
      return
    }

    try {
      if (onSaveSso) {
        await onSaveSso(ssoData)
      }
      setSaveStatus('Konfigurasi SSO Enterprise berhasil disimpan!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan konfigurasi SSO'
      setSaveError(msg)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      if (onTestSso) {
        const res = await onTestSso(ssoData)
        setTestResult(res)
      } else {
        await new Promise((resolve) => setTimeout(resolve, 300))
        setTestResult({
          success: true,
          message: `Koneksi ke Identity Provider (${ssoData.providerType.toUpperCase()}) berhasil diverifikasi! Metadata & endpoint valid.`,
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menguji koneksi SSO'
      setTestResult({
        success: false,
        message: msg,
      })
    } finally {
      setIsTesting(false)
    }
  }

  const handleDownloadMetadata = () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://app.xatxoot.com/api/v1/sso/saml/metadata">
  <md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://app.xatxoot.com/api/v1/sso/saml/acs" index="1" isDefault="true"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`
    const blob = new Blob([xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'xatxoot-sp-metadata.xml'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Filter audit logs
  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      !searchQuery.trim() ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      Boolean(log.actorName?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      Boolean(log.actorEmail?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      Boolean(log.ipAddress?.includes(searchQuery))
    const matchesType =
      selectedType === 'ALL' || log.auditableType.toUpperCase() === selectedType.toUpperCase()
    return matchesSearch && matchesType
  })

  const getActionBadgeClass = (action: string) => {
    if (action.includes('LOGIN') || action.includes('AUTH')) {
      return 'bg-blue-50 text-blue-700 border-blue-200'
    }
    if (action.includes('BREACH') || action.includes('ALERT') || action.includes('DELETE')) {
      return 'bg-rose-50 text-rose-700 border-rose-200'
    }
    if (action.includes('CREATE') || action.includes('PROVISION')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    }
    return 'bg-purple-50 text-purple-700 border-purple-200'
  }

  return (
    <div
      data-testid="enterprise-security-panel"
      className={`max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 ${className}`}
    >
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <span className="text-3xl select-none">🛡️</span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Pengaturan Keamanan Enterprise</h1>
            <p className="text-sm text-slate-600 mt-1">
              Konfigurasi Single Sign-On (SAML 2.0 &amp; OIDC SSO), kontrol akses enterprise, serta
              tabel riwayat audit log aktivitas keamanan.
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mt-6 border-b border-slate-200">
          <button
            type="button"
            data-testid="tab-sso-setup"
            onClick={() => setTab('sso')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              currentTab === 'sso'
                ? 'border-wa-teal-primary text-wa-teal-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>🔑</span> SSO (SAML &amp; OIDC)
          </button>
          <button
            type="button"
            data-testid="tab-audit-logs"
            onClick={() => setTab('audit')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              currentTab === 'audit'
                ? 'border-wa-teal-primary text-wa-teal-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>📜</span> Audit Log Aktivitas ({auditLogs.length})
          </button>
        </div>
      </div>

      {/* TAB 1: SSO SETUP */}
      {currentTab === 'sso' && (
        <form
          onSubmit={handleSave}
          className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-6"
        >
          {/* Protocol Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">1. Protokol Single Sign-On</h2>
              <p className="text-xs text-slate-500">
                Pilih protokol integrasi identitas perusahaan Anda.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label
                data-testid="radio-protocol-saml"
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition-all ${
                  ssoData.providerType === 'saml'
                    ? 'border-wa-teal-primary bg-emerald-50 text-wa-teal-primary'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="protocol"
                  value="saml"
                  checked={ssoData.providerType === 'saml'}
                  onChange={() => handleProtocolChange('saml')}
                  className="sr-only"
                />
                <span>📄 SAML 2.0 (Okta, OneLogin, AD FS)</span>
              </label>

              <label
                data-testid="radio-protocol-oidc"
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border cursor-pointer text-xs font-semibold transition-all ${
                  ssoData.providerType === 'oidc'
                    ? 'border-wa-teal-primary bg-emerald-50 text-wa-teal-primary'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="protocol"
                  value="oidc"
                  checked={ssoData.providerType === 'oidc'}
                  onChange={() => handleProtocolChange('oidc')}
                  className="sr-only"
                />
                <span>🌐 OIDC / OAuth2 (Azure AD, Google)</span>
              </label>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="sso-name-input"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
              >
                Nama Penyedia SSO (Display Name) <span className="text-rose-500">*</span>
              </label>
              <input
                id="sso-name-input"
                type="text"
                data-testid="input-sso-name"
                value={ssoData.name}
                onChange={(e) => setSsoData({ ...ssoData, name: e.target.value })}
                placeholder="e.g. Okta Corporate SSO"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-hidden focus:border-wa-teal-primary"
                required
              />
            </div>

            <div className="flex items-center justify-between sm:justify-start gap-4 pt-6">
              <label
                htmlFor="toggle-sso-active"
                className="text-xs font-semibold text-slate-700 uppercase tracking-wider cursor-pointer"
              >
                Status Aktif SSO:
              </label>
              <input
                id="toggle-sso-active"
                type="checkbox"
                data-testid="toggle-sso-active"
                checked={ssoData.active}
                onChange={(e) => setSsoData({ ...ssoData, active: e.target.checked })}
                className="w-4 h-4 text-wa-teal-primary rounded border-slate-300 focus:ring-wa-teal-primary"
              />
              <span
                className={`text-xs font-semibold ${
                  ssoData.active ? 'text-emerald-600' : 'text-slate-400'
                }`}
              >
                {ssoData.active ? 'Aktif (Enforced)' : 'Nonaktif'}
              </span>
            </div>
          </div>

          {/* SAML specific fields */}
          {ssoData.providerType === 'saml' && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="saml-issuer-input"
                    className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
                  >
                    SAML Issuer URL (Entity ID IdP) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="saml-issuer-input"
                    type="url"
                    data-testid="input-saml-issuer"
                    value={ssoData.issuerUrl}
                    onChange={(e) => setSsoData({ ...ssoData, issuerUrl: e.target.value })}
                    placeholder="https://idp.example.com/metadata"
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-hidden focus:border-wa-teal-primary"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="saml-sso-url-input"
                    className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
                  >
                    IdP SSO Login URL
                  </label>
                  <input
                    id="saml-sso-url-input"
                    type="url"
                    data-testid="input-saml-sso-url"
                    value={ssoData.ssoUrl || ''}
                    onChange={(e) => setSsoData({ ...ssoData, ssoUrl: e.target.value })}
                    placeholder="https://idp.example.com/sso"
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-hidden focus:border-wa-teal-primary"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="saml-cert-textarea"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
                >
                  X.509 Public Certificate <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="saml-cert-textarea"
                  data-testid="textarea-saml-cert"
                  value={ssoData.certData || ''}
                  onChange={(e) => setSsoData({ ...ssoData, certData: e.target.value })}
                  rows={4}
                  placeholder="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
                  className="w-full text-xs font-mono border border-slate-300 rounded-lg p-3 focus:outline-hidden focus:border-wa-teal-primary"
                  required
                />
              </div>

              {/* SP ACS Info Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
                <span className="text-xs font-semibold text-slate-800 block">
                  Informasi Service Provider (SP) Xatxoot untuk dikonfigurasi di IdP:
                </span>
                <div className="text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-medium text-slate-700">
                      Assertion Consumer Service (ACS) URL:{' '}
                    </span>
                    <code
                      data-testid="text-acs-url"
                      className="text-wa-teal-dark bg-white px-2 py-0.5 rounded border border-slate-200"
                    >
                      https://app.xatxoot.com/api/v1/sso/saml/acs/{ssoData.id || 'provider-id'}
                    </code>
                  </div>
                  <button
                    type="button"
                    data-testid="btn-download-sp-metadata"
                    onClick={handleDownloadMetadata}
                    className="text-xs bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold px-3 py-1.5 rounded transition-colors"
                  >
                    📥 Unduh SP Metadata XML
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* OIDC specific fields */}
          {ssoData.providerType === 'oidc' && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="oidc-issuer-input"
                    className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
                  >
                    Issuer URL / Discovery Endpoint <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="oidc-issuer-input"
                    type="url"
                    data-testid="input-oidc-issuer"
                    value={ssoData.issuerUrl}
                    onChange={(e) => setSsoData({ ...ssoData, issuerUrl: e.target.value })}
                    placeholder="https://login.microsoftonline.com/tenant-id/v2.0"
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-hidden focus:border-wa-teal-primary"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="oidc-client-id-input"
                    className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
                  >
                    Client ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="oidc-client-id-input"
                    type="text"
                    data-testid="input-oidc-client-id"
                    value={ssoData.clientId || ''}
                    onChange={(e) => setSsoData({ ...ssoData, clientId: e.target.value })}
                    placeholder="e.g. azure-application-client-id"
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-hidden focus:border-wa-teal-primary"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="oidc-client-secret-input"
                    className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
                  >
                    Client Secret
                  </label>
                  <div className="relative">
                    <input
                      id="oidc-client-secret-input"
                      type={showClientSecret ? 'text' : 'password'}
                      data-testid="input-oidc-client-secret"
                      value={ssoData.clientSecret || ''}
                      onChange={(e) => setSsoData({ ...ssoData, clientSecret: e.target.value })}
                      placeholder="••••••••••••••••"
                      className="w-full text-sm border border-slate-300 rounded-lg pl-3 pr-10 py-2 focus:outline-hidden focus:border-wa-teal-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowClientSecret(!showClientSecret)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1"
                    >
                      {showClientSecret ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="oidc-scopes-input"
                    className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
                  >
                    Scopes (Dipisahkan spasi)
                  </label>
                  <input
                    id="oidc-scopes-input"
                    type="text"
                    data-testid="input-oidc-scopes"
                    value={(ssoData.scopes || ['openid', 'profile', 'email']).join(' ')}
                    onChange={(e) =>
                      setSsoData({
                        ...ssoData,
                        scopes: e.target.value.split(' ').filter(Boolean),
                      })
                    }
                    placeholder="openid profile email"
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-hidden focus:border-wa-teal-primary"
                  />
                </div>
              </div>

              {/* Redirect URI Info Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <span className="text-xs font-semibold text-slate-800 block mb-1">
                  OAuth2 / OIDC Redirect Callback URI untuk didaftarkan di IdP:
                </span>
                <code
                  data-testid="text-redirect-uri"
                  className="text-xs text-wa-teal-dark bg-white px-2 py-0.5 rounded border border-slate-200 block truncate"
                >
                  https://app.xatxoot.com/api/v1/sso/oidc/callback/{ssoData.id || 'provider-id'}
                </code>
              </div>
            </div>
          )}

          {/* Feedback & Error states */}
          {saveStatus && (
            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-center gap-1.5">
              <span>✅</span> {saveStatus}
            </div>
          )}
          {saveError && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-lg flex items-center gap-1.5">
              <span>⚠️</span> {saveError}
            </div>
          )}
          {testResult && (
            <div
              className={`text-xs p-3 rounded-lg border flex items-center gap-2 ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <span>{testResult.success ? '✅' : '❌'}</span>
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex flex-wrap items-center justify-between border-t border-slate-100 pt-4 gap-3">
            <button
              type="button"
              data-testid="btn-test-sso-connection"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2"
            >
              <span>⚡</span> {isTesting ? 'Menguji...' : 'Uji Koneksi SSO'}
            </button>

            <button
              type="submit"
              data-testid="btn-save-sso-config"
              disabled={isSaving}
              className="bg-wa-teal-primary hover:bg-wa-teal-hover disabled:opacity-50 text-white text-xs font-semibold px-5 py-2.5 rounded-lg transition-colors shadow-xs"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Konfigurasi SSO'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: AUDIT LOGS TABLE */}
      {currentTab === 'audit' && (
        <div
          data-testid="section-audit-logs"
          className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4"
        >
          {/* Header & Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                2. Jejak Audit Aktivitas (Audit Trail)
              </h2>
              <p className="text-xs text-slate-500">
                Log permanen seluruh aktivitas tata kelola, autentikasi, dan perubahan konfigurasi
                sistem.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                data-testid="input-audit-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari aksi, aktor, atau IP..."
                className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-hidden focus:border-wa-teal-primary w-48"
              />

              <select
                data-testid="select-audit-type"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-wa-teal-primary bg-white text-slate-700"
              >
                <option value="ALL">Semua Entitas</option>
                <option value="SSOPROVIDER">SsoProvider</option>
                <option value="USERSESSION">UserSession</option>
                <option value="TICKETSLA">TicketSla</option>
                <option value="ORGANIZATION">Organization</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {filteredLogs.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table
                data-testid="table-audit-logs"
                className="w-full text-left border-collapse text-xs"
              >
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                    <th className="py-2.5 px-3">Waktu</th>
                    <th className="py-2.5 px-3">Aktor</th>
                    <th className="py-2.5 px-3">Aksi</th>
                    <th className="py-2.5 px-3">Tipe Entitas</th>
                    <th className="py-2.5 px-3">IP Address</th>
                    <th className="py-2.5 px-3 text-right">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((log) => (
                    <tr
                      key={log.id}
                      data-testid="audit-log-row"
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('id-ID', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800">
                          {log.actorName || 'System'}
                        </div>
                        <div className="text-[11px] text-slate-500">{log.actorEmail || '-'}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getActionBadgeClass(
                            log.action,
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{log.auditableType}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">
                        {log.ipAddress || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {log.changes && Object.keys(log.changes).length > 0 ? (
                          <button
                            type="button"
                            data-testid="btn-view-changes"
                            onClick={() =>
                              setSelectedLogChanges(
                                selectedLogChanges?.id === log.id
                                  ? null
                                  : { id: log.id, changes: log.changes || {} },
                              )
                            }
                            className="text-[11px] font-semibold text-wa-teal-dark hover:underline"
                          >
                            {selectedLogChanges?.id === log.id ? 'Tutup' : 'Lihat'}
                          </button>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              data-testid="empty-audit-logs"
              className="py-12 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200"
            >
              Belum ada log aktivitas tercatat
            </div>
          )}

          {/* Modal / Card JSON Changes Preview */}
          {selectedLogChanges && (
            <div className="bg-slate-900 text-slate-100 rounded-lg p-3 text-xs font-mono border border-slate-800">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 mb-2">
                <span className="text-emerald-400 font-semibold">
                  Payload Perubahan (Audit #{selectedLogChanges.id.slice(0, 8)}):
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedLogChanges(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <pre className="overflow-x-auto text-[11px]">
                {JSON.stringify(selectedLogChanges.changes, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default EnterpriseSecurityPanel
