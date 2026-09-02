import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

export function Card({
  children,
  className,
  padding = 'md',
}: {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}) {
  const pad = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-5' }[padding]
  return (
    <div
      className={cn(
        'rounded-xl border border-line bg-sand-0 shadow-[var(--shadow-card)]',
        pad,
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  description,
  actions,
  icon: Icon,
}: {
  title: string
  description?: string
  actions?: ReactNode
  icon?: LucideIcon
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && (
          <span className="flex size-8 items-center justify-center rounded-lg bg-olive-100 text-olive-800">
            <Icon className="size-4" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="font-display text-lg font-medium text-olive-950">{title}</h2>
          {description && <p className="text-xs text-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
