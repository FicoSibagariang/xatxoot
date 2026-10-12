import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  ActivityHeatmap,
  type AgentPerformanceData,
  AgentPerformanceView,
  AnalyticsDashboard,
  type AnalyticsOverviewData,
  CsatBreakdownView,
  type CsatMetricData,
  type HeatmapSlotData,
  type HourlyChatVolumeData,
  HourlyVolumeChart,
  KpiCardsView,
  formatDurationSeconds,
} from './AnalyticsDashboard'

describe('Visual Analytics Dashboard (Task 4.13 - apps/web)', () => {
  const mockOverview: AnalyticsOverviewData = {
    totalConversations: 1240,
    incomingMessages: 8420,
    outgoingMessages: 7910,
    avgFirstResponseTimeSeconds: 105, // 1m 45s
    avgResolutionTimeSeconds: 860, // 14m 20s
    avgCsatScore: 4.8,
    totalResolvedTickets: 1180,
  }

  const mockHourlyVolumes: HourlyChatVolumeData[] = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    label: `${String(i).padStart(2, '0')}:00`,
    totalChats: i === 14 ? 142 : 20 + ((i * 7) % 65),
    incomingCount: i === 14 ? 85 : 12 + ((i * 4) % 40),
    outgoingCount: i === 14 ? 57 : 8 + ((i * 3) % 25),
  }))

  const mockAgents: AgentPerformanceData[] = [
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
  ]

  const mockHeatmapSlots: HeatmapSlotData[] = [
    {
      dayOfWeek: 1,
      dayLabel: 'Senin',
      hourBlock: 10,
      hourLabel: '10:00',
      volume: 85,
      intensity: 4,
    },
    {
      dayOfWeek: 2,
      dayLabel: 'Selasa',
      hourBlock: 14,
      hourLabel: '14:00',
      volume: 62,
      intensity: 3,
    },
    { dayOfWeek: 3, dayLabel: 'Rabu', hourBlock: 9, hourLabel: '09:00', volume: 45, intensity: 2 },
    {
      dayOfWeek: 4,
      dayLabel: 'Kamis',
      hourBlock: 16,
      hourLabel: '16:00',
      volume: 28,
      intensity: 1,
    },
    { dayOfWeek: 5, dayLabel: 'Jumat', hourBlock: 23, hourLabel: '23:00', volume: 0, intensity: 0 },
  ]

  const mockCsat: CsatMetricData = {
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

  describe('Duration & Time Formatting Helpers', () => {
    it('should format seconds into readable minute and second duration string', () => {
      expect(formatDurationSeconds(0)).toBe('0s')
      expect(formatDurationSeconds(45)).toBe('45s')
      expect(formatDurationSeconds(105)).toBe('1m 45s')
      expect(formatDurationSeconds(3665)).toBe('1j 1m 5s')
    })
  })

  describe('KpiCardsView Component', () => {
    it('should render all 5 primary performance KPI cards correctly', () => {
      const html = renderToStaticMarkup(<KpiCardsView overview={mockOverview} />)

      expect(html).toContain('data-testid="kpi-total-conversations"')
      expect(html).toContain('1.240')
      expect(html).toContain('data-testid="kpi-first-response-time"')
      expect(html).toContain('1m 45s')
      expect(html).toContain('data-testid="kpi-resolution-time"')
      expect(html).toContain('14m 20s')
      expect(html).toContain('data-testid="kpi-avg-csat"')
      expect(html).toContain('4.8')
      expect(html).toContain('data-testid="kpi-resolved-tickets"')
      expect(html).toContain('1.180')
    })
  })

  describe('HourlyVolumeChart Component (Chart Volume Chat per Jam)', () => {
    it('should render 24 hourly bars and indicate peak traffic hour', () => {
      const html = renderToStaticMarkup(<HourlyVolumeChart hourlyData={mockHourlyVolumes} />)

      expect(html).toContain('data-testid="hourly-volume-chart"')
      expect(html).toContain('Volume Percakapan per Jam')
      // Harus menampilkan bar untuk 24 jam
      for (let h = 0; h < 24; h += 4) {
        const hourLabel = `${String(h).padStart(2, '0')}:00`
        expect(html).toContain(hourLabel)
      }
      // Peak hour indicator
      expect(html).toContain('Jam Tersibuk')
      expect(html).toContain('14:00')
      expect(html).toContain('142 chat')
    })
  })

  describe('ActivityHeatmap Component (Heatmap Aktivitas)', () => {
    it('should render 7-day activity heatmap grid and intensity legend', () => {
      const html = renderToStaticMarkup(<ActivityHeatmap slots={mockHeatmapSlots} />)

      expect(html).toContain('data-testid="activity-heatmap"')
      expect(html).toContain('Heatmap Aktivitas Chat Mingguan')
      expect(html).toContain('Senin')
      expect(html).toContain('Selasa')
      expect(html).toContain('Rabu')
      expect(html).toContain('Kamis')
      expect(html).toContain('Jumat')
      expect(html).toContain('Sabtu')
      expect(html).toContain('Minggu')
      // Legend intensitas
      expect(html).toContain('Rendah')
      expect(html).toContain('Tinggi')
    })
  })

  describe('AgentPerformanceView Component (Grafik & Tabel Performa Agen)', () => {
    it('should render agent list with response times, resolution counts, and satisfaction rates', () => {
      const html = renderToStaticMarkup(<AgentPerformanceView agents={mockAgents} />)

      expect(html).toContain('data-testid="agent-performance-view"')
      expect(html).toContain('Performa Agen')
      expect(html).toContain('Sarah CS')
      expect(html).toContain('420 tiket')
      expect(html).toContain('1m 18s') // 78s
      expect(html).toContain('10m 10s') // 610s
      expect(html).toContain('Budi Support')
      expect(html).toContain('380 tiket')
      expect(html).toContain('Dina Specialist')
    })
  })

  describe('CsatBreakdownView Component (Rata-rata Skor & Distribusi CSAT)', () => {
    it('should render average CSAT score and 5-tier rating distribution bars', () => {
      const html = renderToStaticMarkup(<CsatBreakdownView csatData={mockCsat} />)

      expect(html).toContain('data-testid="csat-breakdown-view"')
      expect(html).toContain('Kepuasan Pelanggan (CSAT)')
      expect(html).toContain('4.8')
      expect(html).toContain('520 responden')
      expect(html).toContain('94.2% Puas')

      // 5 level rating labels
      expect(html).toContain('Sangat Puas')
      expect(html).toContain('73.1%')
      expect(html).toContain('Puas')
      expect(html).toContain('21.1%')
      expect(html).toContain('Cukup')
      expect(html).toContain('Kecewa')
      expect(html).toContain('Sangat Kecewa')
    })
  })

  describe('Full AnalyticsDashboard Component Integration', () => {
    it('should render full dashboard with filter toolbar, export CSV button, and charts', () => {
      const html = renderToStaticMarkup(
        <AnalyticsDashboard
          overview={mockOverview}
          hourlyData={mockHourlyVolumes}
          agents={mockAgents}
          heatmapSlots={mockHeatmapSlots}
          csatData={mockCsat}
          selectedRange="last_7_days"
          selectedChannel="all"
        />,
      )

      expect(html).toContain('data-testid="analytics-dashboard"')
      expect(html).toContain('Visual Analytics Dashboard')
      expect(html).toContain('data-testid="filter-date-range"')
      expect(html).toContain('data-testid="filter-channel"')
      expect(html).toContain('data-testid="btn-export-csv"')
      expect(html).toContain('Unduh CSV')
      expect(html).toContain('data-testid="kpi-total-conversations"')
      expect(html).toContain('data-testid="hourly-volume-chart"')
      expect(html).toContain('data-testid="activity-heatmap"')
      expect(html).toContain('data-testid="agent-performance-view"')
      expect(html).toContain('data-testid="csat-breakdown-view"')
    })

    it('should render properly with fallback default data when no props are provided', () => {
      const html = renderToStaticMarkup(<AnalyticsDashboard />)

      expect(html).toContain('data-testid="analytics-dashboard"')
      expect(html).toContain('Visual Analytics Dashboard')
      expect(html).toContain('Unduh CSV')
    })
  })

  describe('Single Organization Rule Guardrail & Phase 4 Checklist', () => {
    it('should strictly NOT contain or require accountId in any Analytics interface or props', () => {
      const code = readFileSync(join(__dirname, 'AnalyticsDashboard.tsx'), 'utf-8')
      expect(code).not.toContain('account_id')
      expect(code).not.toContain('accountId')
    })

    it('should mark Task 4.13 as completed in docs/PHASE_4_CHECKLIST.md', () => {
      const checklist = readFileSync(
        join(__dirname, '../../../../../docs/PHASE_4_CHECKLIST.md'),
        'utf-8',
      )
      expect(checklist).toContain('- [x] **Task 4.13**')
    })
  })
})
