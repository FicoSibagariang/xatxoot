import { type ReactNode, useMemo, useState } from 'react'

// ==========================================
// Types & Domain Interfaces
// (Single Organization: No tenant identifiers)
// ==========================================

export interface AnalyticsOverviewData {
  totalConversations: number
  incomingMessages: number
  outgoingMessages: number
  avgFirstResponseTimeSeconds: number
  avgResolutionTimeSeconds: number
  avgCsatScore: number
  totalResolvedTickets: number
}

export interface HourlyChatVolumeData {
  hour: number
  label: string
  totalChats: number
  incomingCount: number
  outgoingCount: number
}

export interface AgentPerformanceData {
  agentId: string
  agentName: string
  avatarUrl?: string
  totalResolvedTickets: number
  avgFirstResponseTimeSeconds: number
  avgResolutionTimeSeconds: number
  totalReplies: number
  csatScore: number
}

export interface HeatmapSlotData {
  dayOfWeek: number // 1 (Senin) .. 7 (Minggu)
  dayLabel: string
  hourBlock: number // 0 .. 23
  hourLabel: string
  volume: number
  intensity: 0 | 1 | 2 | 3 | 4
}

export interface CsatRatingTier {
  rating: number
  label: string
  count: number
  percentage: number
}

export interface CsatMetricData {
  avgScore: number
  totalResponses: number
  satisfactionRate: number
  breakdown: CsatRatingTier[]
}

export type DateRangeOption = 'today' | 'last_7_days' | 'last_30_days' | 'last_90_days'
export type ChannelFilterOption = 'all' | 'whatsapp' | 'website_widget'

export interface AnalyticsDashboardProps {
  overview?: AnalyticsOverviewData
  hourlyData?: HourlyChatVolumeData[]
  agents?: AgentPerformanceData[]
  heatmapSlots?: HeatmapSlotData[]
  csatData?: CsatMetricData
  selectedRange?: DateRangeOption
  selectedChannel?: ChannelFilterOption
  onRangeChange?: (range: DateRangeOption) => void
  onChannelChange?: (channel: ChannelFilterOption) => void
  onExportCsv?: (type: 'summary' | 'agents' | 'events') => void
  className?: string
  children?: ReactNode
}

// ==========================================
// Formatting Helpers
// ==========================================

export function formatDurationSeconds(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  if (h > 0) {
    const parts = [`${h}j`]
    if (m > 0 || s > 0) parts.push(`${m}m`)
    if (s > 0) parts.push(`${s}s`)
    return parts.join(' ')
  }
  if (m > 0) {
    return s > 0 ? `${m}m ${s}s` : `${m}m`
  }
  return `${s}s`
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('id-ID').format(num)
}

// ==========================================
// Default Mock Data for Standalone View
// ==========================================

export const DEFAULT_OVERVIEW: AnalyticsOverviewData = {
  totalConversations: 1240,
  incomingMessages: 8420,
  outgoingMessages: 7910,
  avgFirstResponseTimeSeconds: 105,
  avgResolutionTimeSeconds: 860,
  avgCsatScore: 4.8,
  totalResolvedTickets: 1180,
}

export const DEFAULT_HOURLY_DATA: HourlyChatVolumeData[] = Array.from({ length: 24 }, (_, i) => {
  const peak = i === 14 ? 142 : i >= 9 && i <= 17 ? 45 + ((i * 11) % 55) : 10 + (i % 15)
  return {
    hour: i,
    label: `${String(i).padStart(2, '0')}:00`,
    totalChats: peak,
    incomingCount: Math.round(peak * 0.58),
    outgoingCount: Math.round(peak * 0.42),
  }
})

export const DEFAULT_AGENTS_DATA: AgentPerformanceData[] = [
  {
    agentId: 'usr_sarah',
    agentName: 'Sarah CS',
    totalResolvedTickets: 420,
    avgFirstResponseTimeSeconds: 78,
    avgResolutionTimeSeconds: 610,
    totalReplies: 1350,
    csatScore: 4.9,
  },
  {
    agentId: 'usr_budi',
    agentName: 'Budi Support',
    totalResolvedTickets: 380,
    avgFirstResponseTimeSeconds: 110,
    avgResolutionTimeSeconds: 740,
    totalReplies: 1120,
    csatScore: 4.7,
  },
  {
    agentId: 'usr_dina',
    agentName: 'Dina Specialist',
    totalResolvedTickets: 290,
    avgFirstResponseTimeSeconds: 140,
    avgResolutionTimeSeconds: 980,
    totalReplies: 890,
    csatScore: 4.6,
  },
  {
    agentId: 'usr_reza',
    agentName: 'Reza Helpdesk',
    totalResolvedTickets: 210,
    avgFirstResponseTimeSeconds: 165,
    avgResolutionTimeSeconds: 1120,
    totalReplies: 740,
    csatScore: 4.5,
  },
]

export const DAYS_OF_WEEK = [
  { day: 1, label: 'Senin' },
  { day: 2, label: 'Selasa' },
  { day: 3, label: 'Rabu' },
  { day: 4, label: 'Kamis' },
  { day: 5, label: 'Jumat' },
  { day: 6, label: 'Sabtu' },
  { day: 7, label: 'Minggu' },
]

export const DEFAULT_HEATMAP_SLOTS: HeatmapSlotData[] = DAYS_OF_WEEK.flatMap((d) =>
  [0, 4, 8, 12, 16, 20].map((hour) => {
    const isWeekend = d.day >= 6
    const isPeakHours = hour >= 8 && hour <= 16
    let intensity: 0 | 1 | 2 | 3 | 4 = 0
    let volume = 0
    if (!isWeekend && isPeakHours) {
      intensity = hour === 12 ? 4 : 3
      volume = hour === 12 ? 88 : 56
    } else if (!isWeekend && hour > 0) {
      intensity = 2
      volume = 32
    } else if (isWeekend && isPeakHours) {
      intensity = 1
      volume = 18
    }
    return {
      dayOfWeek: d.day,
      dayLabel: d.label,
      hourBlock: hour,
      hourLabel: `${String(hour).padStart(2, '0')}:00`,
      volume,
      intensity,
    }
  }),
)

export const DEFAULT_CSAT_DATA: CsatMetricData = {
  avgScore: 4.8,
  totalResponses: 520,
  satisfactionRate: 94.2,
  breakdown: [
    { rating: 5, label: 'Sangat Puas', count: 380, percentage: 73.1 },
    { rating: 4, label: 'Puas', count: 110, percentage: 21.1 },
    { rating: 3, label: 'Cukup', count: 20, percentage: 3.8 },
    { rating: 2, label: 'Kecewa', count: 7, percentage: 1.4 },
    { rating: 1, label: 'Sangat Kecewa', count: 3, percentage: 0.6 },
  ],
}

// ==========================================
// 1. KPI Cards View
// ==========================================

export function KpiCardsView({ overview }: { overview: AnalyticsOverviewData }) {
  const cards = [
    {
      testId: 'kpi-total-conversations',
      title: 'Total Percakapan',
      value: formatNumber(overview.totalConversations),
      subtext: `${formatNumber(overview.incomingMessages)} pesan masuk`,
      icon: '💬',
      trend: '+12.4%',
      trendPositive: true,
    },
    {
      testId: 'kpi-first-response-time',
      title: 'First Response Time (FRT)',
      value: formatDurationSeconds(overview.avgFirstResponseTimeSeconds),
      subtext: 'Rata-rata respon perdana',
      icon: '⚡',
      trend: '-18s lebih cepat',
      trendPositive: true,
    },
    {
      testId: 'kpi-resolution-time',
      title: 'Waktu Resolusi Tiket',
      value: formatDurationSeconds(overview.avgResolutionTimeSeconds),
      subtext: 'Rata-rata hingga tuntas',
      icon: '⏱️',
      trend: '-2.5m efisiensi',
      trendPositive: true,
    },
    {
      testId: 'kpi-avg-csat',
      title: 'Skor CSAT Rata-rata',
      value: overview.avgCsatScore.toFixed(1),
      subtext: 'Dari skala 5.0 bintang',
      icon: '⭐',
      trend: '+0.2 poin',
      trendPositive: true,
    },
    {
      testId: 'kpi-resolved-tickets',
      title: 'Tiket Terselesaikan',
      value: formatNumber(overview.totalResolvedTickets),
      subtext: '95.1% tingkat keberhasilan',
      icon: '✅',
      trend: '+8.3%',
      trendPositive: true,
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <div
          key={card.testId}
          data-testid={card.testId}
          className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              {card.title}
            </span>
            <span className="text-xl p-1.5 bg-gray-50 rounded-lg">{card.icon}</span>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#111b21] tracking-tight">{card.value}</div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50 text-xs">
              <span className="text-gray-500 truncate">{card.subtext}</span>
              <span
                className={`font-semibold ml-1 shrink-0 ${
                  card.trendPositive ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {card.trend}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ==========================================
// 2. Hourly Volume Chart (Chart Volume per Jam)
// ==========================================

export function HourlyVolumeChart({
  hourlyData,
}: {
  hourlyData: HourlyChatVolumeData[]
}) {
  const maxVolume = useMemo(() => {
    return Math.max(...hourlyData.map((d) => d.totalChats), 1)
  }, [hourlyData])

  const peakHour = useMemo(() => {
    return hourlyData.reduce((prev, curr) => (curr.totalChats > prev.totalChats ? curr : prev))
  }, [hourlyData])

  return (
    <div
      data-testid="hourly-volume-chart"
      className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-gray-100 gap-2">
        <div>
          <h3 className="text-base font-semibold text-[#111b21] flex items-center gap-2">
            <span>📊</span> Volume Percakapan per Jam
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Distribusi 24 jam interaksi pelanggan untuk perencanaan kapasitas shift
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-100 font-medium">
          <span>⚡ Jam Tersibuk:</span>
          <span className="font-bold underline">{peakHour.label}</span>
          <span className="bg-emerald-200/60 px-1.5 py-0.5 rounded text-emerald-900">
            {peakHour.totalChats} chat
          </span>
        </div>
      </div>

      {/* SVG / Bar Grid */}
      <div className="mt-6 flex-1 min-h-[220px] flex flex-col justify-end">
        <div className="flex items-end gap-1.5 sm:gap-2 h-44 w-full px-1">
          {hourlyData.map((d) => {
            const heightPercent = Math.max(8, Math.round((d.totalChats / maxVolume) * 100))
            const isPeak = d.hour === peakHour.hour

            return (
              <div
                key={d.hour}
                className="flex-1 flex flex-col items-center h-full justify-end group relative"
              >
                {/* Tooltip Hover */}
                <div className="absolute -top-12 z-20 hidden group-hover:flex flex-col items-center bg-gray-900 text-white text-[11px] py-1 px-2 rounded shadow-lg pointer-events-none whitespace-nowrap">
                  <span className="font-semibold">{d.label}</span>
                  <span>{d.totalChats} chat total</span>
                  <div className="w-1.5 h-1.5 bg-gray-900 rotate-45 -mb-1 mt-0.5" />
                </div>

                {/* Bar */}
                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full rounded-t-md transition-all duration-300 group-hover:opacity-90 ${
                    isPeak
                      ? 'bg-gradient-to-t from-[#00a884] to-emerald-400 shadow-sm'
                      : 'bg-[#00a884]/80 group-hover:bg-[#00a884]'
                  }`}
                />
              </div>
            )
          })}
        </div>

        {/* X-Axis Labels (Setiap 4 Jam) */}
        <div className="flex justify-between border-t border-gray-200 pt-2 text-[11px] text-gray-500 font-mono">
          {hourlyData
            .filter((d) => d.hour % 4 === 0)
            .map((d) => (
              <span key={d.hour}>{d.label}</span>
            ))}
          <span>23:59</span>
        </div>
      </div>
    </div>
  )
}

// ==========================================
// 3. Activity Heatmap (Heatmap Aktivitas Chat Mingguan)
// ==========================================

const INTENSITY_COLORS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-gray-100 hover:bg-gray-200 text-gray-400',
  1: 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700',
  2: 'bg-emerald-300 hover:bg-emerald-400 text-emerald-800',
  3: 'bg-emerald-500 hover:bg-emerald-600 text-white',
  4: 'bg-emerald-700 hover:bg-emerald-800 text-white font-bold',
}

export function ActivityHeatmap({ slots }: { slots: HeatmapSlotData[] }) {
  const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
  const hourLabels = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00']

  return (
    <div
      data-testid="activity-heatmap"
      className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-gray-100 gap-2">
        <div>
          <h3 className="text-base font-semibold text-[#111b21] flex items-center gap-2">
            <span>🔥</span> Heatmap Aktivitas Chat Mingguan
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Intensitas pesan masuk per blok jam untuk optimasi jadwal piket agen
          </p>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span>Rendah</span>
          <div className="w-3.5 h-3.5 rounded bg-gray-100" />
          <div className="w-3.5 h-3.5 rounded bg-emerald-100" />
          <div className="w-3.5 h-3.5 rounded bg-emerald-300" />
          <div className="w-3.5 h-3.5 rounded bg-emerald-500" />
          <div className="w-3.5 h-3.5 rounded bg-emerald-700" />
          <span>Tinggi</span>
        </div>
      </div>

      {/* Grid */}
      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[480px]">
          {/* Header Jam */}
          <div className="grid grid-cols-7 gap-1.5 pb-2 border-b border-gray-100 text-xs text-gray-500 font-medium text-center">
            <div className="text-left font-semibold text-gray-600">Hari</div>
            {hourLabels.map((lbl) => (
              <div key={lbl}>{lbl}</div>
            ))}
          </div>

          {/* Rows Hari */}
          <div className="space-y-1.5 pt-2">
            {days.map((dayName, dayIndex) => {
              const dayNum = dayIndex + 1
              return (
                <div key={dayName} className="grid grid-cols-7 gap-1.5 items-center text-xs">
                  <div className="font-medium text-gray-700 text-left truncate">{dayName}</div>
                  {[0, 4, 8, 12, 16, 20].map((hour) => {
                    const slot = slots.find(
                      (s) => s.dayOfWeek === dayNum && s.hourBlock === hour,
                    ) || {
                      volume: 0,
                      intensity: 0 as const,
                    }

                    return (
                      <div
                        key={hour}
                        title={`${dayName} ${hour}:00 - ${slot.volume} pesan`}
                        className={`h-7 rounded flex items-center justify-center transition-colors cursor-pointer text-[10px] ${
                          INTENSITY_COLORS[slot.intensity]
                        }`}
                      >
                        {slot.volume > 0 ? slot.volume : ''}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ==========================================
// 4. Agent Performance View (Grafik & Tabel Performa Agen)
// ==========================================

export function AgentPerformanceView({
  agents,
}: {
  agents: AgentPerformanceData[]
}) {
  const maxResolved = useMemo(() => {
    return Math.max(...agents.map((a) => a.totalResolvedTickets), 1)
  }, [agents])

  return (
    <div
      data-testid="agent-performance-view"
      className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col"
    >
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <div>
          <h3 className="text-base font-semibold text-[#111b21] flex items-center gap-2">
            <span>👥</span> Performa Agen & Tim
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Metrik produktivitas individu, kecepatan tanggapan, dan kepuasan pelanggan
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-100 text-gray-500 uppercase tracking-wider text-[11px]">
              <th className="pb-3 font-semibold">Agen</th>
              <th className="pb-3 font-semibold">Tiket Selesai</th>
              <th className="pb-3 font-semibold">Avg FRT</th>
              <th className="pb-3 font-semibold">Avg Resolusi</th>
              <th className="pb-3 font-semibold">Balasan</th>
              <th className="pb-3 font-semibold text-right">Rating CSAT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {agents.map((agent) => {
              const barPercent = Math.round((agent.totalResolvedTickets / maxResolved) * 100)

              return (
                <tr key={agent.agentId} className="hover:bg-gray-50/80 transition-colors">
                  <td className="py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-semibold flex items-center justify-center text-xs">
                        {agent.agentName.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-900">{agent.agentName}</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800">
                        {agent.totalResolvedTickets} tiket
                      </span>
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                        <div
                          style={{ width: `${barPercent}%` }}
                          className="h-full bg-[#00a884] rounded-full"
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 font-medium text-gray-700">
                    {formatDurationSeconds(agent.avgFirstResponseTimeSeconds)}
                  </td>
                  <td className="py-3 font-medium text-gray-700">
                    {formatDurationSeconds(agent.avgResolutionTimeSeconds)}
                  </td>
                  <td className="py-3 text-gray-600">{agent.totalReplies} pesan</td>
                  <td className="py-3 text-right">
                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200/60 px-2 py-0.5 rounded-md font-semibold">
                      ⭐ {agent.csatScore.toFixed(1)}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ==========================================
// 5. CSAT Breakdown View (Rata-rata Skor & Distribusi Rating)
// ==========================================

export function CsatBreakdownView({ csatData }: { csatData: CsatMetricData }) {
  return (
    <div
      data-testid="csat-breakdown-view"
      className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex flex-col"
    >
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <div>
          <h3 className="text-base font-semibold text-[#111b21] flex items-center gap-2">
            <span>⭐</span> Kepuasan Pelanggan (CSAT)
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Analisis umpan balik dan distribusi penilaian dari tiket terselesaikan
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Kolom 1: Skor Besar */}
        <div className="flex flex-col items-center justify-center p-4 bg-emerald-50/60 rounded-xl border border-emerald-100 text-center">
          <div className="text-4xl font-extrabold text-[#00a884] tracking-tight">
            {csatData.avgScore.toFixed(1)}
          </div>
          <div className="flex items-center gap-1 text-amber-400 text-lg my-1">
            {'★'.repeat(Math.round(csatData.avgScore))}
            {'☆'.repeat(5 - Math.round(csatData.avgScore))}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Berdasarkan{' '}
            <span className="font-semibold text-gray-800">{csatData.totalResponses} responden</span>
          </div>
          <div className="mt-2.5 inline-flex items-center gap-1 bg-emerald-600 text-white text-xs px-2.5 py-0.5 rounded-full font-medium">
            <span>🎉</span> {csatData.satisfactionRate}% Puas
          </div>
        </div>

        {/* Kolom 2-3: Rating Distribution Bars */}
        <div className="md:col-span-2 space-y-2.5">
          {csatData.breakdown.map((tier) => (
            <div key={tier.rating} className="flex items-center gap-3 text-xs">
              <span className="w-24 text-gray-600 font-medium truncate flex items-center gap-1">
                <span>{tier.rating}★</span>
                <span>{tier.label}</span>
              </span>
              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  style={{ width: `${tier.percentage}%` }}
                  className={`h-full rounded-full transition-all duration-300 ${
                    tier.rating >= 4
                      ? 'bg-[#00a884]'
                      : tier.rating === 3
                        ? 'bg-amber-400'
                        : 'bg-rose-500'
                  }`}
                />
              </div>
              <span className="w-12 text-right font-semibold text-gray-700">
                {tier.percentage.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ==========================================
// 6. Main Analytics Dashboard Component
// ==========================================

export function AnalyticsDashboard({
  overview = DEFAULT_OVERVIEW,
  hourlyData = DEFAULT_HOURLY_DATA,
  agents = DEFAULT_AGENTS_DATA,
  heatmapSlots = DEFAULT_HEATMAP_SLOTS,
  csatData = DEFAULT_CSAT_DATA,
  selectedRange = 'last_7_days',
  selectedChannel = 'all',
  onRangeChange = () => {},
  onChannelChange = () => {},
  onExportCsv = () => {},
  className = '',
  children,
}: AnalyticsDashboardProps) {
  const [range, setRange] = useState<DateRangeOption>(selectedRange)
  const [channel, setChannel] = useState<ChannelFilterOption>(selectedChannel)

  const handleRangeChange = (r: DateRangeOption) => {
    setRange(r)
    onRangeChange(r)
  }

  const handleChannelChange = (c: ChannelFilterOption) => {
    setChannel(c)
    onChannelChange(c)
  }

  return (
    <div
      data-testid="analytics-dashboard"
      className={`min-h-full w-full bg-[#f0f2f5] p-4 sm:p-6 lg:p-8 space-y-6 ${className}`}
    >
      {/* Top Header & Filters Toolbar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#111b21] tracking-tight flex items-center gap-2">
            <span>📈</span> Visual Analytics Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Pantau metrik percakapan, kecepatan penanganan agen, dan kepuasan pelanggan secara
            real-time
          </p>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Date Range Selector */}
          <select
            data-testid="filter-date-range"
            value={range}
            onChange={(e) => handleRangeChange(e.target.value as DateRangeOption)}
            className="text-xs font-medium bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#00a884] focus:border-transparent cursor-pointer"
          >
            <option value="today">Hari Ini</option>
            <option value="last_7_days">7 Hari Terakhir</option>
            <option value="last_30_days">30 Hari Terakhir</option>
            <option value="last_90_days">90 Hari Terakhir</option>
          </select>

          {/* Channel Selector */}
          <select
            data-testid="filter-channel"
            value={channel}
            onChange={(e) => handleChannelChange(e.target.value as ChannelFilterOption)}
            className="text-xs font-medium bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#00a884] focus:border-transparent cursor-pointer"
          >
            <option value="all">Semua Saluran</option>
            <option value="whatsapp">WhatsApp Gateway</option>
            <option value="website_widget">Website Widget</option>
          </select>

          {/* Export CSV Button */}
          <button
            type="button"
            data-testid="btn-export-csv"
            onClick={() => onExportCsv('summary')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#00a884] text-white px-3.5 py-2 rounded-lg hover:bg-[#008f6f] active:bg-[#007a5e] transition-colors shadow-sm cursor-pointer ml-auto md:ml-0"
          >
            <span>📥</span>
            <span>Unduh CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <KpiCardsView overview={overview} />

      {/* Chart Section: Hourly Volume & CSAT Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HourlyVolumeChart hourlyData={hourlyData} />
        <CsatBreakdownView csatData={csatData} />
      </div>

      {/* Heatmap & Agent Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActivityHeatmap slots={heatmapSlots} />
        <AgentPerformanceView agents={agents} />
      </div>

      {children}
    </div>
  )
}

export default AnalyticsDashboard
