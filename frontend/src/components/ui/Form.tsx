import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { Search } from 'lucide-react'
import { Button } from './Button'
import { cn } from '../../lib/utils'

const field =
  'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder:text-text-light outline-none transition focus:border-teal-800 focus:ring-2 focus:ring-teal-800/15 disabled:cursor-not-allowed disabled:bg-sand-50 disabled:opacity-70'

export function Label({
  children,
  htmlFor,
  required,
}: {
  children: ReactNode
  htmlFor?: string
  required?: boolean
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-center gap-1 text-xs font-medium tracking-wide text-muted">
      {children}
      {required && (
        <span className="text-danger" aria-hidden>
          *
        </span>
      )}
    </label>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
  hint?: string
  required?: boolean
}

export function Input({ label, error, hint, required, className, id, ...props }: InputProps) {
  const inputId = id ?? props.name
  return (
    <div className="w-full">
      {label && (
        <Label htmlFor={inputId} required={required}>
          {label}
        </Label>
      )}
      <input
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={cn(field, error && 'border-danger focus:border-danger focus:ring-danger/15', className)}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1 text-xs text-text-light">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

type SearchInputProps = Omit<InputProps, 'type'> & {
  onClear?: () => void
}

export function SearchInput({ label, error, hint, required, className, id, ...props }: SearchInputProps) {
  const inputId = id ?? props.name
  return (
    <div className="w-full">
      {label && (
        <Label htmlFor={inputId} required={required}>
          {label}
        </Label>
      )}
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-light"
          aria-hidden
        />
        <input
          id={inputId}
          type="search"
          aria-invalid={!!error}
          className={cn(field, 'pl-9', error && 'border-danger focus:border-danger focus:ring-danger/15', className)}
          {...props}
        />
      </div>
      {error ? (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-text-light">{hint}</p>
      ) : null}
    </div>
  )
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  error?: string
  required?: boolean
  options: { value: string | number; label: string }[]
  placeholder?: string
}

export function Select({
  label,
  error,
  required,
  options,
  placeholder,
  className,
  id,
  ...props
}: SelectProps) {
  const selectId = id ?? props.name
  return (
    <div className="w-full">
      {label && (
        <Label htmlFor={selectId} required={required}>
          {label}
        </Label>
      )}
      <select
        id={selectId}
        aria-invalid={!!error}
        className={cn(field, error && 'border-danger', className)}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 text-sm text-olive-900"
    >
      <span
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors',
          checked ? 'bg-teal-800' : 'bg-olive-200',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-4',
          )}
        />
      </span>
      <span>{label}</span>
    </button>
  )
}

/** Agrupa campos relacionados en formularios de drawer */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-1 w-full border-b border-line pb-2">
        <span className="text-sm font-medium text-olive-950">{title}</span>
        {description && <p className="mt-0.5 text-xs font-normal text-muted">{description}</p>}
      </legend>
      <div className="space-y-4">{children}</div>
    </fieldset>
  )
}

/** Botonera estándar al pie de formularios en drawer */
export function FormActions({
  onCancel,
  saving,
  submitLabel = 'Guardar',
}: {
  onCancel: () => void
  saving?: boolean
  submitLabel?: string
}) {
  return (
    <div className="sticky bottom-0 -mx-5 mt-6 flex gap-2 border-t border-line bg-sand-0 px-5 py-4">
      <Button type="submit" className="flex-1" loading={saving} disabled={saving}>
        {saving ? 'Guardando…' : submitLabel}
      </Button>
      <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
        Cancelar
      </Button>
    </div>
  )
}
