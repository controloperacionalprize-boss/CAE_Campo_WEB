import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Inbox, AlertCircle, Info } from 'lucide-react'
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
  const key = estado.trim().toLowerCase()
  const styles: Record<string, string> = {
    pendiente: 'bg-warn-soft text-warn',
    'en ruta': 'bg-info-soft text-info',
    completado: 'bg-success-soft text-success',
    registrado: 'bg-success-soft text-success',
    anulado: 'bg-danger-soft text-danger',
  }
  const labels: Record<string, string> = {
    pendiente: 'Pendiente',
    'en ruta': 'En ruta',
    completado: 'Completado',
    registrado: 'Registrado',
    anulado: 'Anulado',
  }
  const label = labels[key] ?? estado
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium capitalize',
        styles[key] ?? 'bg-sand-100 text-muted',
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          key === 'registrado' || key === 'completado'
            ? 'bg-success'
            : key === 'anulado'
              ? 'bg-danger'
              : key === 'pendiente'
                ? 'bg-warn'
                : 'bg-muted/50',
        )}
      />
      {label}
    </span>
  )
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: string
  description?: string
  actions?: ReactNode
  breadcrumbs?: ReactNode
}) {
  return (
    <div className="mb-6">
      {breadcrumbs}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-medium tracking-tight text-olive-950 sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

type Crumb = { label: string; to?: string }

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Ruta de navegación" className="mb-3 flex flex-wrap items-center gap-1 text-sm">
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3.5 text-text-light" aria-hidden />}
            {item.to && !isLast ? (
              <Link to={item.to} className="text-muted transition hover:text-teal-800">
                {item.label}
              </Link>
            ) : (
              <span className={cn(isLast ? 'font-medium text-olive-900' : 'text-muted')}>
                {item.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}

export function FilterBar({
  children,
  onClear,
  hasActiveFilters,
  embedded,
}: {
  children: ReactNode
  onClear?: () => void
  hasActiveFilters?: boolean
  /** Sin tarjeta propia — filtros dentro de una Card */
  embedded?: boolean
}) {
  return (
    <div
      className={cn(
        embedded
          ? 'rounded-lg bg-sand-50 p-3'
          : 'mb-4 rounded-xl border border-line bg-sand-0 p-3 shadow-[var(--shadow-card)]',
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">{children}</div>
      {hasActiveFilters && onClear && (
        <div className="mt-2 border-t border-line/60 pt-2">
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-teal-800 hover:underline"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  )
}

/** Filtros secundarios colapsables en móvil */
export function CollapsibleFilters({
  children,
  label = 'Más filtros',
  defaultOpen = false,
}: {
  children: ReactNode
  label?: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-2 text-xs font-medium text-muted hover:text-olive-900 sm:hidden"
        aria-expanded={open}
      >
        {open ? 'Ocultar filtros' : label}
      </button>
      <div className={cn('flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end', !open && 'hidden sm:flex')}>
        {children}
      </div>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string
  description: string
  action?: ReactNode
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-line bg-sand-0 px-6 py-14 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 50% 40% at 50% 0%, rgba(0,102,204,0.06), transparent)',
        }}
      />
      <div className="relative mb-4 flex size-12 items-center justify-center rounded-full bg-olive-100 text-olive-700">
        <Icon className="size-5 opacity-70" />
      </div>
      <h3 className="relative font-display text-lg text-olive-950">{title}</h3>
      <p className="relative mt-1 max-w-sm text-sm text-muted">{description}</p>
      {action && <div className="relative mt-5">{action}</div>}
    </div>
  )
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-11 animate-pulse rounded-lg bg-olive-100/60"
          style={{ animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  )
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      className="mb-4 flex items-start gap-3 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger"
      role="alert"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
        <span>{message}</span>
        {onRetry && (
          <button type="button" className="font-medium underline hover:no-underline" onClick={onRetry}>
            Reintentar
          </button>
        )}
      </div>
    </div>
  )
}

export function InfoBanner({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-info/20 bg-info-soft px-4 py-3 text-sm text-info">
      <Info className="mt-0.5 size-4 shrink-0" />
      <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
        <span>{message}</span>
        {children}
      </div>
    </div>
  )
}

/** Indicador de carga centrado para secciones */
export function LoadingBlock({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center" aria-busy="true">
      <div className="mb-3 size-8 animate-spin rounded-full border-2 border-olive-200 border-t-teal-800" />
      <p className="text-sm text-muted">{label}</p>
    </div>
  )
}
