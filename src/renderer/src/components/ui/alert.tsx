import { cn } from '@/lib/utils'
import { type HTMLAttributes } from 'react'
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react'

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'error'
}

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertCircle,
  error: XCircle
}

export function Alert({ variant = 'info', className, children, ...props }: AlertProps) {
  const Icon = icons[variant]
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg p-4 text-sm',
        {
          'bg-blue-50 text-blue-800 border border-blue-200': variant === 'info',
          'bg-green-50 text-green-800 border border-green-200': variant === 'success',
          'bg-yellow-50 text-yellow-800 border border-yellow-200': variant === 'warning',
          'bg-red-50 text-red-800 border border-red-200': variant === 'error'
        },
        className
      )}
      {...props}
    >
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  )
}
