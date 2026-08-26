import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const variants: Record<Variant, string> = {
  primary:
    'bg-olive-800 text-white hover:bg-olive-700 shadow-sm shadow-olive-950/10 disabled:bg-olive-300',
  secondary:
    'bg-white text-teal-800 border border-teal-800/25 hover:bg-chip-bg disabled:opacity-50',
  ghost: 'bg-transparent text-olive-800 hover:bg-olive-100 disabled:opacity-50',
  danger: 'bg-danger text-white hover:bg-danger/90 disabled:opacity-50',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  leftIcon?: ReactNode
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  leftIcon,
  children,
  type = 'button',
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {leftIcon}
      {children}
    </button>
  )
}
