import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  } catch {
    return dateStr
  }
}

export function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

export function calcAttendancePct(present: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.round((present / total) * 100)}%`
}
