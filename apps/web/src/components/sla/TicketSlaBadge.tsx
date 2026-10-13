import type React from 'react'

export type SlaSeverity = 'none' | 'safe' | 'warning' | 'urgent' | 'breached' | 'fulfilled'
export type SlaTargetType = 'first_response' | 'resolution'

export interface TicketSlaParams {
  firstResponseDeadline?: string | Date | null
  resolutionDeadline?: string | Date | null
  isBreached?: boolean
  breachedAt?: string | Date | null
  targetType?: 'first_response' | 'resolution' | 'auto'
  ticketStatus?: 'open' | 'pending' | 'resolved' | 'snoozed'
  policyName?: string
}

export interface TicketSlaCalculationResult {
  hasSla: boolean
  targetType: SlaTargetType
  targetDeadline: Date | null
  remainingMs: number
  formattedRemaining: string
  badgeLabel: string
  severity: SlaSeverity
  isApproaching: boolean
  isBreached: boolean
}

export interface TicketSlaBadgeProps extends TicketSlaParams {
  now?: Date
  size?: 'sm' | 'md' | 'lg'
  showTooltip?: boolean
  className?: string
}

export function calculateTicketSla(
  params: TicketSlaParams,
  now: Date = new Date(),
): TicketSlaCalculationResult {
  const {
    firstResponseDeadline,
    resolutionDeadline,
    isBreached: forcedBreach = false,
    targetType = 'auto',
    ticketStatus,
  } = params

  const frDate = firstResponseDeadline ? new Date(firstResponseDeadline) : null
  const resDate = resolutionDeadline ? new Date(resolutionDeadline) : null

  const hasFr = frDate !== null && !Number.isNaN(frDate.getTime())
  const hasRes = resDate !== null && !Number.isNaN(resDate.getTime())

  if (!hasFr && !hasRes) {
    return {
      hasSla: false,
      targetType: 'resolution',
      targetDeadline: null,
      remainingMs: 0,
      formattedRemaining: '',
      badgeLabel: '',
      severity: 'none',
      isApproaching: false,
      isBreached: false,
    }
  }

  // Handle resolved ticket state (SLA fulfilled unless breached before resolve)
  if (ticketStatus === 'resolved') {
    if (forcedBreach) {
      return {
        hasSla: true,
        targetType: 'resolution',
        targetDeadline: resDate || frDate,
        remainingMs: 0,
        formattedRemaining: 'Breached',
        badgeLabel: 'SLA Breached',
        severity: 'breached',
        isApproaching: false,
        isBreached: true,
      }
    }
    return {
      hasSla: true,
      targetType: 'resolution',
      targetDeadline: resDate || frDate,
      remainingMs: 0,
      formattedRemaining: 'Terpenuhi',
      badgeLabel: 'SLA Terpenuhi',
      severity: 'fulfilled',
      isApproaching: false,
      isBreached: false,
    }
  }

  // Determine active target deadline
  let activeTarget: SlaTargetType = 'resolution'
  let activeDeadline: Date | null = null

  if (targetType === 'first_response') {
    activeTarget = 'first_response'
    activeDeadline = frDate || resDate
  } else if (targetType === 'resolution') {
    activeTarget = 'resolution'
    activeDeadline = resDate || frDate
  } else {
    // Auto: prioritaskan first response bila masih valid dan di masa depan
    if (hasFr && frDate && frDate.getTime() > now.getTime()) {
      activeTarget = 'first_response'
      activeDeadline = frDate
    } else if (hasRes && resDate) {
      activeTarget = 'resolution'
      activeDeadline = resDate
    } else {
      activeTarget = hasFr ? 'first_response' : 'resolution'
      activeDeadline = frDate || resDate
    }
  }

  if (!activeDeadline) {
    return {
      hasSla: false,
      targetType: 'resolution',
      targetDeadline: null,
      remainingMs: 0,
      formattedRemaining: '',
      badgeLabel: '',
      severity: 'none',
      isApproaching: false,
      isBreached: false,
    }
  }

  const remainingMs = activeDeadline.getTime() - now.getTime()
  const isBreached = forcedBreach || remainingMs <= 0

  if (isBreached) {
    const overdueMs = Math.abs(remainingMs)
    const overdueMins = Math.floor(overdueMs / (60 * 1000))
    const overdueHours = Math.floor(overdueMins / 60)

    let overdueStr = ''
    if (overdueHours > 0) {
      overdueStr = `Lewat ${overdueHours}j`
    } else {
      overdueStr = `Lewat ${Math.max(1, overdueMins)}m`
    }

    const prefix = activeTarget === 'first_response' ? 'FR: ' : ''
    return {
      hasSla: true,
      targetType: activeTarget,
      targetDeadline: activeDeadline,
      remainingMs,
      formattedRemaining: overdueStr,
      badgeLabel: `${prefix}${overdueStr}`,
      severity: 'breached',
      isApproaching: false,
      isBreached: true,
    }
  }

  const totalMinutes = Math.floor(remainingMs / (60 * 1000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  let formattedRemaining = ''
  if (hours > 0) {
    formattedRemaining = minutes > 0 ? `${hours}j ${minutes}m` : `${hours}j`
  } else {
    formattedRemaining = `${Math.max(1, totalMinutes)}m`
  }

  let severity: SlaSeverity = 'safe'
  let isApproaching = false

  if (totalMinutes <= 15) {
    severity = 'urgent'
    isApproaching = true
  } else if (totalMinutes <= 60) {
    severity = 'warning'
    isApproaching = false
  } else {
    severity = 'safe'
    isApproaching = false
  }

  const targetPrefix = activeTarget === 'first_response' ? 'FR: ' : ''
  const badgeLabel = `${targetPrefix}${formattedRemaining}`

  return {
    hasSla: true,
    targetType: activeTarget,
    targetDeadline: activeDeadline,
    remainingMs,
    formattedRemaining,
    badgeLabel,
    severity,
    isApproaching,
    isBreached: false,
  }
}

export function TicketSlaBadge({
  firstResponseDeadline,
  resolutionDeadline,
  isBreached,
  breachedAt,
  targetType = 'auto',
  ticketStatus,
  policyName,
  now,
  size = 'sm',
  showTooltip = false,
  className = '',
}: TicketSlaBadgeProps) {
  const calculation = calculateTicketSla(
    {
      firstResponseDeadline,
      resolutionDeadline,
      isBreached,
      breachedAt,
      targetType,
      ticketStatus,
      policyName,
    },
    now,
  )

  if (!calculation.hasSla) {
    return null
  }

  const severityStyles: Record<SlaSeverity, { container: string; icon: string }> = {
    none: { container: '', icon: '' },
    safe: {
      container: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: '🕒',
    },
    warning: {
      container: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: '⏱️',
    },
    urgent: {
      container: 'bg-rose-50 text-rose-700 border-rose-300 font-semibold animate-pulse',
      icon: '⏳',
    },
    breached: {
      container: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
      icon: '⚠️',
    },
    fulfilled: {
      container: 'bg-teal-50 text-teal-700 border-teal-200',
      icon: '✅',
    },
  }

  const sizeClasses: Record<'sm' | 'md' | 'lg', string> = {
    sm: 'text-[10px] px-1.5 py-0.5 rounded',
    md: 'text-xs px-2 py-0.5 rounded-md',
    lg: 'text-sm px-2.5 py-1 rounded-lg',
  }

  const style = severityStyles[calculation.severity]

  return (
    <div className="relative inline-flex items-center group">
      <span
        data-testid="ticket-sla-badge"
        data-severity={calculation.severity}
        data-target-type={calculation.targetType}
        data-breached={calculation.isBreached ? 'true' : 'false'}
        data-approaching={calculation.isApproaching ? 'true' : 'false'}
        title={policyName ? `${policyName} - ${calculation.badgeLabel}` : calculation.badgeLabel}
        className={`inline-flex items-center gap-1 border shrink-0 leading-none select-none ${sizeClasses[size]} ${style.container} ${className}`}
      >
        <span data-testid="sla-icon" aria-hidden="true" className="text-[11px]">
          {style.icon}
        </span>
        <span data-testid="sla-countdown-text">{calculation.badgeLabel}</span>
      </span>

      {/* SLA Hover / Popover Tooltip */}
      {showTooltip && (
        <div
          data-testid="sla-tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col z-30 bg-slate-900 text-white text-[11px] rounded-lg p-2.5 shadow-lg whitespace-nowrap min-w-[180px]"
        >
          <div className="font-semibold text-emerald-400 border-b border-slate-700 pb-1 mb-1">
            {policyName || 'SLA Policy'}
          </div>
          <div className="space-y-0.5 text-slate-300">
            {firstResponseDeadline && (
              <div className="flex justify-between gap-2">
                <span>First Response:</span>
                <span className="font-mono text-white">
                  {new Date(firstResponseDeadline).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}
            {resolutionDeadline && (
              <div className="flex justify-between gap-2">
                <span>Resolusi:</span>
                <span className="font-mono text-white">
                  {new Date(resolutionDeadline).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}
            <div className="flex justify-between gap-2 pt-1 border-t border-slate-800 text-[10px]">
              <span>Status:</span>
              <span
                className={
                  calculation.isBreached
                    ? 'text-rose-400 font-bold'
                    : calculation.severity === 'fulfilled'
                      ? 'text-teal-400 font-semibold'
                      : 'text-emerald-300'
                }
              >
                {calculation.isBreached
                  ? 'Terlewat (Breached)'
                  : calculation.severity === 'fulfilled'
                    ? 'Terpenuhi'
                    : 'Berjalan'}
              </span>
            </div>
          </div>
          <div className="w-2 h-2 bg-slate-900 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2" />
        </div>
      )}
    </div>
  )
}

export default TicketSlaBadge
