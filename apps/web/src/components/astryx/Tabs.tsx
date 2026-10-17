import type React from 'react'
import { createContext, useContext, useState } from 'react'

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = createContext<TabsContextValue>({
  value: '',
  onValueChange: () => {},
})

export interface TabsProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
  'data-testid'?: string
}

export function Tabs({
  value,
  defaultValue = '',
  onValueChange,
  children,
  className = '',
  'data-testid': testId,
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue)
  const activeValue = value !== undefined ? value : internalValue

  const handleValueChange = (newVal: string) => {
    if (value === undefined) {
      setInternalValue(newVal)
    }
    onValueChange?.(newVal)
  }

  return (
    <TabsContext.Provider value={{ value: activeValue, onValueChange: handleValueChange }}>
      <div data-testid={testId} className={`flex flex-col w-full ${className}`}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

export interface TabsListProps {
  children: React.ReactNode
  className?: string
  'data-testid'?: string
}

export function TabsList({
  children,
  className = '',
  'data-testid': testId = 'astryx-tabs-list',
}: TabsListProps) {
  return (
    <div
      data-testid={testId}
      className={`inline-flex items-center gap-1 border-b border-slate-200 bg-transparent p-0 ${className}`}
      role="tablist"
    >
      {children}
    </div>
  )
}

export interface TabsTriggerProps {
  value: string
  children: React.ReactNode
  icon?: React.ReactNode
  disabled?: boolean
  className?: string
  'data-testid'?: string
}

export function TabsTrigger({
  value,
  children,
  icon,
  disabled = false,
  className = '',
  'data-testid': testId,
}: TabsTriggerProps) {
  const { value: activeValue, onValueChange } = useContext(TabsContext)
  const isActive = activeValue === value

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      data-testid={testId}
      onClick={() => onValueChange(value)}
      className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer border-b-2 -mb-px disabled:opacity-50 disabled:cursor-not-allowed ${
        isActive
          ? 'border-wa-teal-primary text-wa-teal-primary font-bold'
          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
      } ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  )
}

export interface TabsContentProps {
  value: string
  children: React.ReactNode
  className?: string
  'data-testid'?: string
}

export function TabsContent({
  value,
  children,
  className = '',
  'data-testid': testId,
}: TabsContentProps) {
  const { value: activeValue } = useContext(TabsContext)

  if (activeValue !== value) {
    return null
  }

  return (
    <div data-testid={testId} role="tabpanel" className={`py-4 animate-in fade-in ${className}`}>
      {children}
    </div>
  )
}
