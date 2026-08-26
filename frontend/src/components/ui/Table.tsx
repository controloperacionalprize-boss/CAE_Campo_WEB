import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './Button'
import { cn } from '../../lib/utils'

export function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-sand-0 shadow-[0_1px_0_rgba(26,26,26,0.04)]">
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return <table className={cn('w-full min-w-[640px] border-collapse text-left text-sm', className)}>{children}</table>
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-line bg-sage-50 text-xs font-medium tracking-wide text-muted uppercase">
        {children}
      </tr>
    </thead>
  )
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn('px-4 py-3 font-medium', className)}>{children}</th>
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 text-olive-900', className)}>{children}</td>
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
        'border-b border-line/70 last:border-0',
        onClick && 'cursor-pointer hover:bg-olive-50/60',
        selected && 'bg-olive-50',
      )}
    >
      {children}
    </tr>
  )
}

/** Paginación (internamente skip / limit hacia la API) */
export function Pagination({
  skip,
  limit,
  total,
  onChange,
}: {
  skip: number
  limit: number
  total: number
  onChange: (skip: number) => void
}) {
  const page = Math.floor(skip / limit) + 1
  const pages = Math.max(1, Math.ceil(total / limit))
  const from = total === 0 ? 0 : skip + 1
  const to = Math.min(skip + limit, total)

  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted">
        {total === 0 ? 'Sin resultados' : `Mostrando ${from}–${to} de ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={skip <= 0}
          onClick={() => onChange(Math.max(0, skip - limit))}
          leftIcon={<ChevronLeft className="size-3.5" />}
        >
          Anterior
        </Button>
        <span className="text-xs text-muted">
          {page} / {pages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={skip + limit >= total}
          onClick={() => onChange(skip + limit)}
        >
          Siguiente
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
