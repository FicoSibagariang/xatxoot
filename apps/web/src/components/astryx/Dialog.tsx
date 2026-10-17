import { X } from 'lucide-react'
import React, { createContext, useCallback, useContext, useEffect } from 'react'

interface DialogContextValue {
  isOpen: boolean
  onClose?: () => void
}

const DialogContext = createContext<DialogContextValue>({
  isOpen: false,
})

export interface DialogProps {
  isOpen?: boolean
  open?: boolean
  onClose?: () => void
  onOpenChange?: (open: boolean) => void
  title?: string
  description?: string
  children?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  className?: string
  'data-testid'?: string
}

export function Dialog({
  isOpen,
  open,
  onClose,
  onOpenChange,
  title,
  description,
  children,
  size = 'md',
  className = '',
  'data-testid': testId = 'astryx-dialog',
}: DialogProps) {
  const isVisible = open ?? isOpen ?? false

  const handleClose = useCallback(() => {
    if (onClose) onClose()
    if (onOpenChange) onOpenChange(false)
  }, [onClose, onOpenChange])

  // Keyboard ESC listener
  useEffect(() => {
    if (!isVisible) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isVisible, handleClose])

  if (!isVisible) {
    return null
  }

  // Check if children contain compound components
  const hasCompoundContent = React.Children.toArray(children).some(
    (child) =>
      React.isValidElement(child) &&
      (child.type === DialogContent ||
        (child.props as Record<string, unknown>)?.['data-dialog-content']),
  )

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full m-4',
  }

  return (
    <DialogContext.Provider value={{ isOpen: isVisible, onClose: handleClose }}>
      {hasCompoundContent ? (
        children
      ) : (
        <div
          data-testid={testId}
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label="Tutup backdrop"
            className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in cursor-default border-none outline-none"
            onClick={handleClose}
          />
          <div
            className={`relative z-10 w-full ${sizeClasses[size]} bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col ${className}`}
          >
            {(title || description) && (
              <DialogHeader>
                {title && <DialogTitle>{title}</DialogTitle>}
                {description && <DialogDescription>{description}</DialogDescription>}
              </DialogHeader>
            )}
            <div className="p-6">{children}</div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  )
}

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  children: React.ReactNode
  hideCloseButton?: boolean
  'data-testid'?: string
}

export function DialogContent({
  size = 'md',
  children,
  hideCloseButton = false,
  className = '',
  'data-testid': testId = 'astryx-dialog',
  ...props
}: DialogContentProps) {
  const { onClose } = useContext(DialogContext)

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full m-4',
  }

  return (
    <div
      data-testid={testId}
      data-dialog-content="true"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Tutup backdrop"
        className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in cursor-default border-none outline-none"
        onClick={onClose}
      />
      <div
        className={`relative z-10 w-full ${sizeClasses[size]} bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col ${className}`}
        {...props}
      >
        {!hideCloseButton && onClose && (
          <button
            type="button"
            data-testid="astryx-dialog-close"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors cursor-pointer z-10"
            aria-label="Tutup Dialog"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-1 ${className}`}
    >
      {children}
    </div>
  )
}

export function DialogTitle({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <h2 className={`text-base font-semibold text-slate-800 ${className}`}>{children}</h2>
}

export function DialogDescription({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <p className={`text-xs text-slate-500 ${className}`}>{children}</p>
}

export function DialogFooter({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3 ${className}`}
    >
      {children}
    </div>
  )
}
