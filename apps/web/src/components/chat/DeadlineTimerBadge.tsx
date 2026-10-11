import type React from 'react'

export type DeadlineSeverity = 'none' | 'safe' | 'warning' | 'urgent' | 'breached'

export interface DeadlineStatusResult {
  hasDeadline: boolean
  isApproaching: boolean
  isBreached: boolean
  remainingMs: number
  label: string
  severity: DeadlineSeverity
}

export function calculateDeadlineStatus(
  deadlineAt: string | Date | null | undefined,
  now: Date = new Date(),
): DeadlineStatusResult {
  if (!deadlineAt) {
    return {
      hasDeadline: false,
      isApproaching: false,
      isBreached: false,
      remainingMs: 0,
      label: '',
      severity: 'none',
    }
  }

  const deadlineDate = typeof deadlineAt === 'string' ? new Date(deadlineAt) : deadlineAt
  if (Number.isNaN(deadlineDate.getTime())) {
    return {
      hasDeadline: false,
      isApproaching: false,
      isBreached: false,
      remainingMs: 0,
      label: '',
      severity: 'none',
    }
  }

  const remainingMs = deadlineDate.getTime() - now.getTime()

  // Breached: remainingMs <= 0
  if (remainingMs <= 0) {
    const overdueMs = Math.abs(remainingMs)
    const overdueMins = Math.floor(overdueMs / (60 * 1000))
    const overdueHours = Math.floor(overdueMins / 60)

    let overdueLabel = 'Lewat'
    if (overdueHours > 0) {
      overdueLabel = `Lewat ${overdueHours}j`
    } else {
      overdueLabel = `Lewat ${Math.max(1, overdueMins)}m`
    }

    return {
      hasDeadline: true,
      isApproaching: true,
      isBreached: true,
      remainingMs,
      label: overdueLabel,
      severity: 'breached',
    }
  }

  const totalMinutes = Math.floor(remainingMs / (60 * 1000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  let label = ''
  if (hours > 0) {
    label = minutes > 0 ? `${hours}j ${minutes}m` : `${hours}j`
  } else {
    label = `${Math.max(1, totalMinutes)}m`
  }

  // Urgent / Approaching: <= 15 minutes
  if (totalMinutes <= 15) {
    return {
      hasDeadline: true,
      isApproaching: true,
      isBreached: false,
      remainingMs,
      label,
      severity: 'urgent',
    }
  }

  // Warning: <= 60 minutes
  if (totalMinutes <= 60) {
    return {
      hasDeadline: true,
      isApproaching: false,
      isBreached: false,
      remainingMs,
      label,
      severity: 'warning',
    }
  }

  // Safe: > 60 minutes
  return {
    hasDeadline: true,
    isApproaching: false,
    isBreached: false,
    remainingMs,
    label,
    severity: 'safe',
  }
}

export interface DeadlineTimerBadgeProps {
  deadlineAt?: string | Date | null
  status?: string
  now?: Date
  size?: 'sm' | 'md'
  className?: string
}

export function DeadlineTimerBadge({
  deadlineAt,
  status,
  now,
  size = 'sm',
  className = '',
}: DeadlineTimerBadgeProps) {
  if (status === 'resolved' || !deadlineAt) {
    return null
  }

  const deadlineInfo = calculateDeadlineStatus(deadlineAt, now)
  if (!deadlineInfo.hasDeadline) {
    return null
  }

  const severityStyles: Record<DeadlineSeverity, string> = {
    none: '',
    safe: 'bg-slate-100 text-slate-600 border-slate-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    urgent: 'bg-rose-50 text-rose-600 border-rose-200 font-semibold',
    breached: 'bg-rose-100 text-rose-700 border-rose-300 font-bold',
  }

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 rounded',
    md: 'text-xs px-2 py-0.5 rounded-md',
  }

  return (
    <span
      data-testid="deadline-timer-badge"
      data-severity={deadlineInfo.severity}
      data-breached={deadlineInfo.isBreached ? 'true' : 'false'}
      data-approaching={deadlineInfo.isApproaching ? 'true' : 'false'}
      title={
        deadlineInfo.isBreached
          ? `SLA Terlewat: ${deadlineInfo.label}`
          : `Batas Waktu SLA: ${deadlineInfo.label}`
      }
      className={`inline-flex items-center gap-1 leading-none border shrink-0 ${sizeClasses[size]} ${severityStyles[deadlineInfo.severity]} ${className}`}
    >
      <span aria-hidden="true" className="text-[11px]">
        ⏱️
      </span>
      <span>{deadlineInfo.label}</span>
    </span>
  )
}
