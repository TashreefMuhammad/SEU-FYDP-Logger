import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useToastStore, type Toast } from '@/lib/toast'
import { CheckCircle2, XCircle, AlertTriangle, Info, X, Copy } from 'lucide-react'

const AUTO_DISMISS_MS = 3200

const skin: Record<Toast['kind'], { icon: typeof Info; box: string; iconClass: string }> = {
  success: {
    icon: CheckCircle2,
    box: 'bg-white border-green-300',
    iconClass: 'text-green-600'
  },
  error: { icon: XCircle, box: 'bg-white border-red-300', iconClass: 'text-red-600' },
  warning: { icon: AlertTriangle, box: 'bg-white border-yellow-300', iconClass: 'text-yellow-600' },
  info: { icon: Info, box: 'bg-white border-blue-300', iconClass: 'text-blue-600' }
}

function ToastCard({ t }: { t: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss)
  const [leaving, setLeaving] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [copied, setCopied] = useState(false)
  const { icon: Icon, box, iconClass } = skin[t.kind]

  useEffect(() => {
    if (t.sticky) return
    const fade = setTimeout(() => setLeaving(true), AUTO_DISMISS_MS)
    const kill = setTimeout(() => dismiss(t.id), AUTO_DISMISS_MS + 220)
    return () => {
      clearTimeout(fade)
      clearTimeout(kill)
    }
  }, [t.id, t.sticky, dismiss])

  const copy = () => {
    navigator.clipboard?.writeText(`${t.message}\n${t.detail ?? ''}`.trim())
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      className={cn(
        'pointer-events-auto w-80 rounded-lg border shadow-lg transition-all duration-200',
        box,
        leaving ? 'opacity-0 translate-x-3' : 'opacity-100 translate-x-0'
      )}
      role={t.kind === 'error' ? 'alert' : 'status'}
    >
      <div className="flex items-start gap-2.5 p-3">
        <Icon size={16} className={cn('mt-0.5 shrink-0', iconClass)} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-800 break-words">{t.message}</p>
          {t.detail && (
            <>
              <button
                onClick={() => setShowDetail((v) => !v)}
                className="mt-1 text-xs text-gray-500 underline hover:text-gray-700"
              >
                {showDetail ? 'Hide details' : 'Show details'}
              </button>
              {showDetail && (
                <div className="mt-1.5">
                  <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-2 text-[10px] leading-snug text-gray-600 border border-gray-200">
                    {t.detail}
                  </pre>
                  <button
                    onClick={copy}
                    className="mt-1 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    <Copy size={11} /> {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        <button
          onClick={() => dismiss(t.id)}
          className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Dismiss"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const clear = useToastStore((s) => s.clear)
  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex flex-col items-end gap-2">
      {toasts.map((t) => (
        <ToastCard key={t.id} t={t} />
      ))}
      {toasts.length > 2 && (
        <button
          onClick={clear}
          className="pointer-events-auto rounded bg-gray-800/80 px-2 py-1 text-xs text-white hover:bg-gray-800"
        >
          Dismiss all
        </button>
      )}
    </div>
  )
}
