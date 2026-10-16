import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility helper to safely merge Tailwind CSS class names with clsx and tailwind-merge.
 * Prevents class collision and cascade specificity bugs.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
