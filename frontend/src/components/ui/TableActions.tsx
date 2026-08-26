import { Pencil, Eye, type LucideIcon } from 'lucide-react'
import { Button } from './Button'
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
      {label}
    </Button>
  )
}

export function EditButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return <TableAction label="Editar" icon={Pencil} onClick={onClick} className={className} />
}

export function ViewButton({ className }: { className?: string }) {
  return <TableAction label="Ver" icon={Eye} className={className} />
}
