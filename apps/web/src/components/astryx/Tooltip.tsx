import type React from 'react'

export interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
  'data-testid'?: string
}

export function Tooltip({
  content,
  children,
  position = 'top',
  className = '',
  'data-testid': testId = 'astryx-tooltip',
}: TooltipProps) {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  }

  return (
    <div className="relative inline-flex items-center justify-center group">
      {children}
      <div
        data-testid={testId}
        role="tooltip"
        className={`absolute z-50 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-md pointer-events-none transition-all duration-150 invisible opacity-0 group-hover:visible group-hover:opacity-100 ${positionClasses[position]} ${className}`}
      >
        {content}
      </div>
    </div>
  )
}
