import type React from 'react'
import { createContext, useCallback, useContext, useEffect, useRef } from 'react'

interface DropdownMenuContextValue {
  isOpen: boolean
  onClose: () => void
}

const DropdownMenuContext = createContext<DropdownMenuContextValue>({
  isOpen: false,
  onClose: () => {},
})

export interface DropdownMenuProps {
  isOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onClose?: () => void
  children: React.ReactNode
  className?: string
}

export function DropdownMenu({
  isOpen,
  open,
  onOpenChange,
  onClose,
  children,
  className = '',
}: DropdownMenuProps) {
  const isVisible = open ?? isOpen ?? false
  const menuRef = useRef<HTMLDivElement>(null)

  const handleClose = useCallback(() => {
    if (onClose) onClose()
    if (onOpenChange) onOpenChange(false)
  }, [onClose, onOpenChange])

  // Click outside detection
  useEffect(() => {
    if (!isVisible) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        handleClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isVisible, handleClose])

  return (
    <DropdownMenuContext.Provider value={{ isOpen: isVisible, onClose: handleClose }}>
      <div ref={menuRef} className={`relative inline-block text-left ${className}`}>
        {children}
      </div>
    </DropdownMenuContext.Provider>
  )
}

export interface DropdownMenuTriggerProps {
  children: React.ReactNode
  asChild?: boolean
  className?: string
}

export function DropdownMenuTrigger({ children, className = '' }: DropdownMenuTriggerProps) {
  return <div className={`inline-flex ${className}`}>{children}</div>
}

export interface DropdownMenuContentProps {
  align?: 'start' | 'end' | 'center'
  children: React.ReactNode
  className?: string
  'data-testid'?: string
}

export function DropdownMenuContent({
  align = 'end',
  children,
  className = '',
  'data-testid': testId = 'astryx-dropdown-content',
}: DropdownMenuContentProps) {
  const { isOpen } = useContext(DropdownMenuContext)

  if (!isOpen) {
    return null
  }

  const alignClasses = {
    start: 'left-0 origin-top-left',
    end: 'right-0 origin-top-right',
    center: 'left-1/2 -translate-x-1/2 origin-top',
  }

  return (
    <div
      data-testid={testId}
      className={`absolute z-50 mt-1 min-w-[180px] rounded-xl bg-white p-1.5 shadow-xl border border-slate-200/80 animate-in fade-in zoom-in-95 focus:outline-none ${alignClasses[align]} ${className}`}
    >
      {children}
    </div>
  )
}

export interface DropdownMenuItemProps {
  icon?: React.ReactNode
  variant?: 'default' | 'danger'
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
  className?: string
  'data-testid'?: string
}

export function DropdownMenuItem({
  icon,
  variant = 'default',
  disabled = false,
  onClick,
  children,
  className = '',
  'data-testid': testId,
}: DropdownMenuItemProps) {
  const { onClose } = useContext(DropdownMenuContext)

  const variantClasses = {
    default: 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
    danger: 'text-rose-600 hover:bg-rose-50 hover:text-rose-700',
  }

  const handleClick = () => {
    if (disabled) return
    if (onClick) onClick()
    onClose()
  }

  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={handleClick}
      className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="flex-1 text-left">{children}</span>
    </button>
  )
}

export function DropdownMenuSeparator({
  className = '',
  'data-testid': testId = 'dropdown-separator',
}: {
  className?: string
  'data-testid'?: string
}) {
  return <div data-testid={testId} className={`my-1 h-px bg-slate-100 -mx-1 ${className}`} />
}
