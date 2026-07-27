import { create } from 'zustand'

export type ToastKind = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
  /** Technical detail (SQLite message, stack head) shown under the message for errors. */
  detail?: string
  /** Sticky toasts stay until dismissed by hand. Errors are sticky by default. */
  sticky: boolean
  at: number
}

interface ToastStore {
  toasts: Toast[]
  push: (t: Omit<Toast, 'id' | 'at'>) => number
  dismiss: (id: number) => void
  clear: () => void
}

let _seq = 0

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => {
    const id = ++_seq
    set((s) => ({ toasts: [...s.toasts, { ...t, id, at: Date.now() }].slice(-6) }))
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] })
}))

/**
 * Fire-and-forget toast helpers, callable from anywhere (including outside React).
 * Success/info/warning fade on their own; errors stay until dismissed so the
 * message can be read and copied.
 */
export const toast = {
  success: (message: string) => useToastStore.getState().push({ kind: 'success', message, sticky: false }),
  info: (message: string) => useToastStore.getState().push({ kind: 'info', message, sticky: false }),
  warning: (message: string, detail?: string) =>
    useToastStore.getState().push({ kind: 'warning', message, detail, sticky: false }),
  error: (message: string, detail?: string) =>
    useToastStore.getState().push({ kind: 'error', message, detail, sticky: true }),
  dismiss: (id: number) => useToastStore.getState().dismiss(id)
}

/**
 * Electron wraps every IPC rejection as:
 *   Error invoking remote method 'students:add': Error: UNIQUE constraint failed: ...
 * Strip the plumbing so the actual cause is the first thing on screen, and keep
 * the raw text as the detail line.
 */
export function describeError(e: unknown): { message: string; detail?: string } {
  const raw = e instanceof Error ? (e.stack || e.message) : String(e)
  const flat = raw.replace(/\s+/g, ' ').trim()

  let core = flat
  const remote = flat.match(/Error invoking remote method '[^']*':\s*(.*)$/)
  if (remote) core = remote[1]
  core = core.replace(/^(Error|UnhandledPromiseRejection):\s*/i, '').trim()

  if (/UNIQUE constraint failed: students\.student_id/i.test(core))
    return { message: 'That student ID is already in this group.', detail: core }
  if (/UNIQUE constraint failed/i.test(core))
    return { message: 'That record already exists.', detail: core }
  if (/FOREIGN KEY constraint failed/i.test(core))
    return { message: 'The parent record no longer exists — try refreshing.', detail: core }
  if (/NOT NULL constraint failed:\s*\S+\.(\w+)/i.test(core)) {
    const field = core.match(/NOT NULL constraint failed:\s*\S+\.(\w+)/i)![1]
    return { message: `Required field missing: ${field}.`, detail: core }
  }
  if (/no such (table|column)/i.test(core))
    return { message: 'Database is out of date — restart the app to run migrations.', detail: core }
  if (/API key|api_key|permission denied|quota/i.test(core))
    return { message: 'Gemini rejected the request — check the API key in Settings.', detail: core }

  const first = core.split(' at ')[0].slice(0, 200)
  return { message: first || 'Something went wrong.', detail: core.slice(0, 600) }
}

/**
 * Wraps a data-changing call: toasts on success, and on failure surfaces the real
 * error in the UI instead of leaving a dead button. Returns undefined when the
 * action failed, so callers can bail out without a try/catch of their own.
 */
export async function runAction<T>(
  successMessage: string,
  fn: () => Promise<T>,
  opts: { silent?: boolean; onError?: (info: { message: string; detail?: string }) => void } = {}
): Promise<T | undefined> {
  try {
    const result = await fn()
    if (!opts.silent) toast.success(successMessage)
    return result
  } catch (e) {
    const info = describeError(e)
    if (opts.onError) opts.onError(info)
    toast.error(info.message, info.detail)
    // eslint-disable-next-line no-console
    console.error('[action failed]', successMessage, e)
    return undefined
  }
}

/** Same as runAction but for read-only loads — no success toast, errors still shown. */
export async function runLoad<T>(what: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn()
  } catch (e) {
    const info = describeError(e)
    toast.error(`Could not load ${what}: ${info.message}`, info.detail)
    // eslint-disable-next-line no-console
    console.error('[load failed]', what, e)
    return undefined
  }
}
