import { Link } from 'react-router-dom'
import { Pencil, Eye, MoreHorizontal, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button, linkButtonClass } from './Button'
import { cn } from '../../lib/utils'

/** Acción de tabla unificada: icono + etiqueta, mismo look en toda la app. */
export function TableAction({
  label,
  icon: Icon,
  onClick,
  className,
}: {
  label: string
  icon: LucideIcon
  onClick?: () => void
  className?: string
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      leftIcon={<Icon className="size-3.5 opacity-80" />}
      onClick={onClick}
      className={cn('text-olive-800', className)}
      type="button"
    >
      <span className="sr-only sm:not-sr-only">{label}</span>
    </Button>
  )
}

export function EditButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return <TableAction label="Editar" icon={Pencil} onClick={onClick} className={className} />
}

export function ViewButton({ to, onClick, className }: { to?: string; onClick?: () => void; className?: string }) {
  if (to) {
    return (
      <Link to={to} className={cn(linkButtonClass('ghost', 'sm'), 'text-olive-800', className)} title="Ver detalle">
        <Eye className="size-3.5 opacity-80" />
        <span className="sr-only sm:not-sr-only">Ver</span>
      </Link>
    )
  }
  return <TableAction label="Ver" icon={Eye} onClick={onClick} className={className} />
}

type RowAction = { label: string; icon?: LucideIcon; onClick: () => void; variant?: 'default' | 'danger' }

/** Menú compacto para filas con varias acciones */
export function RowActionsMenu({ actions }: { actions: RowAction[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (actions.length === 0) return null
  if (actions.length === 1) {
    const a = actions[0]
    const Icon = a.icon
    return (
      <Button variant="ghost" size="sm" onClick={a.onClick} leftIcon={Icon ? <Icon className="size-3.5" /> : undefined}>
        {a.label}
      </Button>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Más acciones"
      >
        <MoreHorizontal className="size-4" />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-20 mt-1 min-w-[10rem] rounded-lg border border-line bg-sand-0 py-1 shadow-[var(--shadow-elevated)]"
        >
          {actions.map((a) => {
            const Icon = a.icon
            return (
              <button
                key={a.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  a.onClick()
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-olive-50',
                  a.variant === 'danger' ? 'text-danger' : 'text-olive-900',
                )}
              >
                {Icon && <Icon className="size-3.5 opacity-70" />}
                {a.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
