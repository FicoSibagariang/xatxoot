import { ChevronDown } from 'lucide-react'
import type React from 'react'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  options: SelectOption[]
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  'data-testid'?: string
}

export function Select({
  options,
  value,
  onChange,
  placeholder,
  className = '',
  disabled = false,
  'data-testid': testId,
  ...props
}: SelectProps) {
  return (
    <div className={`relative inline-flex items-center w-full ${className}`}>
      <select
        data-testid={testId}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full appearance-none bg-white border border-slate-200 text-slate-800 text-sm rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:border-wa-teal-primary focus:ring-1 focus:ring-wa-teal-primary transition-colors cursor-pointer disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
        {...props}
      >
        {placeholder && (
          <option value="" disabled hidden={Boolean(value)}>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
    </div>
  )
}
