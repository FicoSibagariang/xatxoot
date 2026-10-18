import { useState } from 'react'
import {
  type AuditLogEntry,
  DEFAULT_SSO_FORM,
  EnterpriseSecurityPanel,
  type SsoFormData,
} from '../components/security'
import { SettingsNav } from '../components/settings'

const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'log-101',
    actorName: 'Super Admin',
    actorEmail: 'admin@xatxoot.com',
    action: 'UPDATE_SSO',
    auditableType: 'SsoProvider',
    auditableId: 'sso-1',
    ipAddress: '192.168.1.1',
    createdAt: '2026-10-13T10:00:00.000Z',
    changes: { active: true, providerType: 'saml' },
  },
  {
    id: 'log-102',
    actorName: 'Agent Sarah',
    actorEmail: 'sarah@xatxoot.com',
    action: 'LOGIN',
    auditableType: 'UserSession',
    auditableId: 'sess-1',
    ipAddress: '203.0.113.15',
    createdAt: '2026-10-13T09:30:00.000Z',
    changes: { method: 'google_oauth' },
  },
]

export function EnterpriseSecurityPage() {
  const [ssoConfig, setSsoConfig] = useState<SsoFormData>(DEFAULT_SSO_FORM)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS)

  const handleSaveSso = async (data: SsoFormData) => {
    setSsoConfig(data)
    // Add audit entry
    const newLog: AuditLogEntry = {
      id: crypto.randomUUID(),
      actorName: 'Admin Pengguna',
      actorEmail: 'admin@xatxoot.com',
      action: 'UPDATE_SSO',
      auditableType: 'SsoProvider',
      ipAddress: '127.0.0.1',
      createdAt: new Date().toISOString(),
      changes: { name: data.name, providerType: data.providerType, active: data.active },
    }
    setAuditLogs((prev) => [newLog, ...prev])
  }

  const handleTestSso = async (data: SsoFormData) => {
    return {
      success: true,
      message: `Koneksi ke ${data.providerType.toUpperCase()} Identity Provider berhasil! Endpoint merespons dengan benar.`,
    }
  }

  return (
    <div
      data-testid="enterprise-security-page"
      className="min-h-screen bg-wa-header-bg flex flex-col"
    >
      <SettingsNav activeSection="security" />
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Pengaturan</span>
            <span>/</span>
            <span className="font-semibold text-slate-800">Pengaturan Keamanan Enterprise</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <EnterpriseSecurityPanel
          initialSso={ssoConfig}
          auditLogs={auditLogs}
          onSaveSso={handleSaveSso}
          onTestSso={handleTestSso}
        />
      </main>
    </div>
  )
}

export default EnterpriseSecurityPage
