import { useEffect, useState } from 'react'
import { CsatSurveyWidget, type CsatWidgetSubmission } from '../components/csat'
import { ApiClientError, api } from '../services/apiClient'

export interface CsatSurveyPageProps {
  token?: string
  ticketDisplayId?: string | number
  agentName?: string
  organizationName?: string
}

export function CsatSurveyPage({
  token: propToken,
  ticketDisplayId,
  agentName,
  organizationName = 'Xatxoot Customer Support',
}: CsatSurveyPageProps) {
  // If not provided in props, try to parse from window.location pathname or search params
  const [token] = useState<string>(() => {
    if (propToken) return propToken
    if (typeof window !== 'undefined') {
      const parts = window.location.pathname.split('/')
      const csatIdx = parts.indexOf('csat')
      if (csatIdx !== -1 && parts[csatIdx + 1]) {
        return parts[csatIdx + 1]
      }
      const params = new URLSearchParams(window.location.search)
      return params.get('token') || 'csat_default'
    }
    return 'csat_default'
  })

  const [widgetState, setWidgetState] = useState<
    'loading' | 'form' | 'submitted' | 'already_submitted' | 'expired'
  >('form')
  const [resolvedAgent, setResolvedAgent] = useState<string | undefined>(agentName)
  const [resolvedTicketId, setResolvedTicketId] = useState<string | number | undefined>(
    ticketDisplayId,
  )

  useEffect(() => {
    if (!token || token === 'csat_default') return

    // Optional API fetch to inspect token status before rendering form
    let isMounted = true
    const checkTokenStatus = async () => {
      try {
        // biome-ignore lint/suspicious/noExplicitAny: csat token status payload
        const data = await api.get<any>(`/api/v1/csat/${token}`, { skipAuth: true })
        if (data?.ok && isMounted) {
          if (data.data?.isSubmitted) {
            setWidgetState('already_submitted')
          }
          if (data.data?.agentName) setResolvedAgent(data.data.agentName)
          if (data.data?.ticketDisplayId) setResolvedTicketId(data.data.ticketDisplayId)
        }
      } catch (err) {
        if (err instanceof ApiClientError && isMounted) {
          if (err.status === 410) {
            setWidgetState('expired')
          } else if (err.status === 409) {
            setWidgetState('already_submitted')
          }
        }
        // Fallback to form state
      }
    }

    checkTokenStatus()
    return () => {
      isMounted = false
    }
  }, [token])

  const handleSubmit = async (submission: CsatWidgetSubmission) => {
    try {
      await api.post(`/api/v1/csat/${token}`, submission, { skipAuth: true })
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 409) {
          setWidgetState('already_submitted')
          return
        }
        if (err.status === 410) {
          setWidgetState('expired')
          return
        }
      }
      throw err instanceof Error ? err : new Error('Gagal mengirim survei CSAT')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 selection:bg-emerald-100 selection:text-emerald-800">
      <CsatSurveyWidget
        token={token}
        ticketDisplayId={resolvedTicketId}
        agentName={resolvedAgent}
        organizationName={organizationName}
        initialState={widgetState}
        onSubmit={handleSubmit}
      />
      <footer className="mt-6 text-center text-xs text-slate-400">
        Ditenagai oleh <strong>Xatxoot Omnichannel CS</strong> • Aman &amp; Terpercaya
      </footer>
    </div>
  )
}

export default CsatSurveyPage
