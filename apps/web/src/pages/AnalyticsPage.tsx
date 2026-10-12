import { useState } from 'react'
import {
  AnalyticsDashboard,
  type ChannelFilterOption,
  type DateRangeOption,
} from '../components/analytics'

export function AnalyticsPage() {
  const [range, setRange] = useState<DateRangeOption>('last_7_days')
  const [channel, setChannel] = useState<ChannelFilterOption>('all')

  const handleExportCsv = (type: 'summary' | 'agents' | 'events') => {
    // In production, triggers download link from /api/v1/analytics/export?type=...
    window.open(`/api/v1/analytics/export?type=${type}`, '_blank')
  }

  return (
    <div data-testid="analytics-page" className="min-h-screen bg-[#f0f2f5] flex flex-col">
      <main className="flex-1 overflow-y-auto">
        <AnalyticsDashboard
          selectedRange={range}
          selectedChannel={channel}
          onRangeChange={setRange}
          onChannelChange={setChannel}
          onExportCsv={handleExportCsv}
        />
      </main>
    </div>
  )
}

export default AnalyticsPage
