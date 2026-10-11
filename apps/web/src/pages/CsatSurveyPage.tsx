import { useEffect, useState } from 'react'
import { CsatSurveyWidget, type CsatWidgetSubmission } from '../components/csat'

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
        const res = await fetch(`/api/v1/csat/${token}`)
        if (!res.ok) {
          if (res.status === 410) {
            if (isMounted) setWidgetState('expired')
          } else if (res.status === 409) {
            if (isMounted) setWidgetState('already_submitted')
          }
          return
        }
        const data = await res.json()
        if (data.ok && isMounted) {
          if (data.data.isSubmitted) {
            setWidgetState('already_submitted')
          }
          if (data.data.agentName) setResolvedAgent(data.data.agentName)
          if (data.data.ticketDisplayId) setResolvedTicketId(data.data.ticketDisplayId)
        }
      } catch {
        // Fallback to form state
      }
    }

    checkTokenStatus()
    return () => {
      isMounted = false
    }
  }, [token])

  const handleSubmit = async (submission: CsatWidgetSubmission) => {
    const res = await fetch(`/api/v1/csat/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      if (res.status === 409) {
        setWidgetState('already_submitted')
        return
      }
      if (res.status === 410) {
        setWidgetState('expired')
        return
      }
      throw new Error(errData.error || 'Gagal mengirim survei CSAT')
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
