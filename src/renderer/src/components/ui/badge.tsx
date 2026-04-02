import { cn } from '@/lib/utils'
import { type HTMLAttributes } from 'react'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        {
          'bg-gray-100 text-gray-700': variant === 'default',
          'bg-green-100 text-green-700': variant === 'success',
          'bg-yellow-100 text-yellow-700': variant === 'warning',
          'bg-red-100 text-red-700': variant === 'danger',
          'bg-blue-100 text-blue-700': variant === 'info'
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
