import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export function StatusPill({ activo }: { activo: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
        activo ? 'bg-success-soft text-success' : 'bg-sand-100 text-muted',
      )}
    >
      <span className={cn('size-1.5 rounded-full', activo ? 'bg-success' : 'bg-muted/50')} />
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  )
}

export function EstadoDespacho({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    Pendiente: 'bg-warn-soft text-warn',
    'En ruta': 'bg-chip-bg text-chip-text',
    Completado: 'bg-success-soft text-success',
  }
  return (
    <span className={cn('inline-flex rounded-md px-2 py-0.5 text-xs font-medium', map[estado] ?? 'bg-sand-100')}>
      {estado}
    </span>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-[1.65rem] font-medium tracking-tight text-olive-950 sm:text-3xl">
          {title}
        </h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-line bg-sand-0/80 p-3 sm:flex-row sm:flex-wrap sm:items-end">
      {children}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-line bg-sand-0 px-6 py-16 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 50% 40% at 50% 0%, rgba(0,102,204,0.08), transparent)',
        }}
      />
      <div className="relative mb-4 flex size-12 items-center justify-center rounded-full bg-olive-100 text-olive-700">
        <span className="size-2 rounded-full bg-olive-500" />
      </div>
      <h3 className="relative font-display text-lg text-olive-950">{title}</h3>
      <p className="relative mt-1 max-w-sm text-sm text-muted">{description}</p>
      {action && <div className="relative mt-5">{action}</div>}
    </div>
  )
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-11 animate-pulse rounded-lg bg-olive-100/70" />
      ))}
    </div>
  )
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="font-medium underline" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  )
}
