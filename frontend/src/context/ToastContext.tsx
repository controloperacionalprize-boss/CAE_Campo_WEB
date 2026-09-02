import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { CheckCircle2, X, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { cn } from '../lib/utils'

type ToastKind = 'success' | 'error' | 'warning' | 'info'

type Toast = {
  id: number
  kind: ToastKind
  message: string
}

type ToastContextValue = {
  success: (message: string) => void
  error: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const toastStyles: Record<ToastKind, string> = {
  success: 'border-success/20 bg-success-soft text-success',
  error: 'border-danger/20 bg-danger-soft text-danger',
  warning: 'border-warn/20 bg-warn-soft text-warn',
  info: 'border-info/20 bg-info-soft text-info',
}

const toastIcons: Record<ToastKind, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, kind, message }])
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id))
    }, 3200)
  }, [])

  const value = useMemo(
    () => ({
      success: (m: string) => push('success', m),
      error: (m: string) => push('error', m),
      warning: (m: string) => push('warning', m),
      info: (m: string) => push('info', m),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-[min(100%-2rem,22rem)] flex-col gap-2"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((t) => {
          const Icon = toastIcons[t.kind]
          return (
            <div
              key={t.id}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg shadow-olive-950/5',
                toastStyles[t.kind],
              )}
              role="status"
            >
              <Icon className="mt-0.5 size-4 shrink-0" />
              <p className="flex-1 text-sm font-medium">{t.message}</p>
              <button
                type="button"
                className="opacity-60 hover:opacity-100"
                onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
                aria-label="Cerrar"
              >
                <X className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider')
  return ctx
}
