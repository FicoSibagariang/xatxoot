import { describe, expect, it } from 'bun:test'
import { cn } from './cn'

describe('Utility Class Merging - cn()', () => {
  it('should merge simple class strings', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2')
  })

  it('should handle falsy values gracefully', () => {
    expect(cn('btn', false, null, undefined, '', 'btn-primary')).toBe('btn btn-primary')
  })

  it('should merge conflicting Tailwind utility classes properly via tailwind-merge', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500')
    expect(cn('text-sm text-gray-500', 'text-lg text-black')).toBe('text-lg text-black')
  })

  it('should handle conditional object notation and arrays', () => {
    const isActive = true
    const isDisabled = false
    expect(
      cn('base-class', {
        'active-class': isActive,
        'disabled-class': isDisabled,
      }),
    ).toBe('base-class active-class')

    expect(cn(['class-a', ['class-b', false && 'class-c']])).toBe('class-a class-b')
  })

  it('should resolve conflicts between WhatsApp design tokens correctly', () => {
    expect(cn('bg-wa-header-bg', 'bg-wa-chat-bg')).toBe('bg-wa-chat-bg')
    expect(cn('text-wa-text-secondary', 'text-wa-text-primary')).toBe('text-wa-text-primary')
  })
})
