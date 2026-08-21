import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { CheckCircle2, X, AlertCircle } from 'lucide-react'
import { cn } from '../lib/utils'

type ToastKind = 'success' | 'error'

type Toast = {
  id: number
  kind: ToastKind
  message: string
}

type ToastContextValue = {
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

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
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-[min(100%-2rem,22rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg shadow-olive-950/5',
              t.kind === 'success'
                ? 'border-success/20 bg-success-soft text-success'
                : 'border-danger/20 bg-danger-soft text-danger',
            )}
          >
            {t.kind === 'success' ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
            )}
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
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider')
  return ctx
}
