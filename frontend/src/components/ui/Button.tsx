import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const variants: Record<Variant, string> = {
  primary:
    'bg-olive-800 text-white hover:bg-olive-700 shadow-sm shadow-olive-950/10 disabled:bg-olive-300 disabled:text-white/80',
  secondary:
    'bg-white text-teal-800 border border-line hover:border-teal-800/30 hover:bg-sage-50 disabled:opacity-50',
  ghost:
    'bg-transparent text-olive-800 hover:bg-olive-100 disabled:opacity-50',
  danger:
    'bg-danger text-white hover:bg-danger/90 disabled:opacity-50',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  leftIcon?: ReactNode
  loading?: boolean
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  leftIcon,
  loading,
  children,
  type = 'button',
  disabled,
  ...props
}: Props) {
  const isDisabled = disabled || loading

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
      ) : (
        leftIcon
      )}
      {children}
    </button>
  )
}

/** Clases compartidas para enlaces con apariencia de botón */
export const linkButtonClass = (variant: Variant = 'ghost', size: Size = 'sm') =>
  cn(
    'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800',
    variants[variant],
    sizes[size],
  )
