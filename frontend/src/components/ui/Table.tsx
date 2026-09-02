import type { ReactNode } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import { Button } from './Button'
import { cn } from '../../lib/utils'

export function TableShell({
  children,
  stickyHeader,
  flush,
}: {
  children: ReactNode
  stickyHeader?: boolean
  /** Sin borde propio — para tablas dentro de una Card */
  flush?: boolean
}) {
  return (
    <div
      className={cn(
        'overflow-hidden bg-sand-0',
        flush ? 'border-t border-line' : 'rounded-xl border border-line shadow-[var(--shadow-card)]',
      )}
    >
      <div className={cn('overflow-x-auto', stickyHeader && 'max-h-[min(70vh,640px)] overflow-y-auto')}>
        {children}
      </div>
    </div>
  )
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <table className={cn('w-full min-w-[560px] border-collapse text-left text-sm', className)}>
      {children}
    </table>
  )
}

export function THead({ children, sticky }: { children: ReactNode; sticky?: boolean }) {
  return (
    <thead className={cn(sticky && 'sticky top-0 z-10')}>
      <tr className="border-b border-line bg-sage-50 text-xs font-medium tracking-wide text-muted uppercase">
        {children}
      </tr>
    </thead>
  )
}

export function Th({
  children,
  className,
  sortable,
  sorted,
  onSort,
  align = 'left',
}: {
  children?: ReactNode
  className?: string
  sortable?: boolean
  sorted?: 'asc' | 'desc' | null
  onSort?: () => void
  align?: 'left' | 'right' | 'center'
}) {
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'

  if (sortable && onSort) {
    return (
      <th className={cn('px-4 py-3 font-medium', alignClass, className)}>
        <button
          type="button"
          onClick={onSort}
          className="inline-flex items-center gap-1 uppercase transition hover:text-olive-900"
          aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}
        >
          {children}
          {sorted === 'asc' ? (
            <ChevronUp className="size-3.5" />
          ) : sorted === 'desc' ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5 opacity-30" />
          )}
        </button>
      </th>
    )
  }

  return <th className={cn('px-4 py-3 font-medium', alignClass, className)}>{children}</th>
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 text-olive-900', className)}>{children}</td>
}

/** Celda con truncamiento y tooltip nativo para textos largos */
export function TdTruncate({
  children,
  title,
  className,
  maxWidth = '200px',
}: {
  children: ReactNode
  title?: string
  className?: string
  maxWidth?: string
}) {
  return (
    <td className={cn('px-4 py-3 text-olive-900', className)} style={{ maxWidth }}>
      <span className="block truncate" title={title ?? (typeof children === 'string' ? children : undefined)}>
        {children}
      </span>
    </td>
  )
}

export function Tr({
  children,
  onClick,
  selected,
}: {
  children: ReactNode
  onClick?: () => void
  selected?: boolean
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        'border-b border-line/70 transition-colors last:border-0',
        onClick && 'cursor-pointer hover:bg-olive-50/60',
        selected && 'bg-olive-50/80',
      )}
    >
      {children}
    </tr>
  )
}

const DEFAULT_LIMIT_OPTIONS = [10, 25, 50]

/** Paginación con rango, selector de tamaño y navegación */
export function Pagination({
  skip,
  limit,
  total,
  onChange,
  onLimitChange,
  limitOptions = DEFAULT_LIMIT_OPTIONS,
}: {
  skip: number
  limit: number
  total: number
  onChange: (skip: number) => void
  onLimitChange?: (limit: number) => void
  limitOptions?: number[]
}) {
  const page = Math.floor(skip / limit) + 1
  const pages = Math.max(1, Math.ceil(total / limit))
  const from = total === 0 ? 0 : skip + 1
  const to = Math.min(skip + limit, total)

  return (
    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-muted">
          {total === 0 ? 'Sin resultados' : (
            <>
              Mostrando <span className="font-medium text-olive-900">{from}–{to}</span> de{' '}
              <span className="font-medium text-olive-900">{total.toLocaleString('es-PE')}</span>
            </>
          )}
        </p>
        {onLimitChange && total > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="page-size" className="text-xs text-muted">
              Por página
            </label>
            <select
              id="page-size"
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="h-8 rounded-md border border-line bg-white px-2 text-xs text-olive-900 outline-none focus:border-teal-800"
            >
              {limitOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={skip <= 0}
          onClick={() => onChange(Math.max(0, skip - limit))}
          leftIcon={<ChevronLeft className="size-3.5" />}
          aria-label="Página anterior"
        >
          <span className="hidden sm:inline">Anterior</span>
        </Button>
        <span className="min-w-[4rem] text-center text-xs text-muted" aria-live="polite">
          {page} / {pages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={skip + limit >= total}
          onClick={() => onChange(skip + limit)}
          aria-label="Página siguiente"
        >
          <span className="hidden sm:inline">Siguiente</span>
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
