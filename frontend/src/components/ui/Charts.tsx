import { useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Card } from './Card'
import { cn, fmtNum } from '../../lib/utils'

/** KPI con icono, valor grande y pie opcional (tendencia, barra, enlace). */
export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  footer,
  className,
}: {
  label: string
  value: ReactNode
  hint?: string
  icon: LucideIcon
  tone: string
  footer?: ReactNode
  className?: string
}) {
  return (
    <Card className={cn('flex h-full flex-col', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium tracking-wide text-muted uppercase">{label}</p>
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', tone)}>
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 font-display text-3xl font-medium tabular-nums text-olive-950">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      {footer && <div className="mt-auto pt-3">{footer}</div>}
    </Card>
  )
}

/** Barra de progreso fina con etiqueta de porcentaje. */
export function ProgressBar({ value, max, tone = 'bg-teal-800' }: { value: number; max: number; tone?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand-100">
        <div className={cn('h-full rounded-full transition-[width]', tone)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted">{pct}%</span>
    </div>
  )
}

/** Anillo de avance (0–100). */
export function ProgressRing({ pct, size = 112, label }: { pct: number; size?: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div
      className="relative shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(var(--color-success) 0% ${clamped}%, var(--color-sand-100) ${clamped}% 100%)`,
      }}
      role="img"
      aria-label={`${label}: ${clamped}%`}
    >
      <div className="absolute inset-[14%] flex flex-col items-center justify-center rounded-full bg-sand-0">
        <span className="font-display text-2xl tabular-nums text-olive-950">{clamped}%</span>
        <span className="text-[10px] text-muted">{label}</span>
      </div>
    </div>
  )
}

export type ColumnDatum = { key: string; label: string; value: number; detail?: string }

/** Columnas verticales de una sola serie, con tooltip al pasar el mouse. */
export function ColumnChart({ data, height = 180, unit }: { data: ColumnDatum[]; height?: number; unit: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.value))
  const ticks = [max, Math.round(max / 2), 0]
  const every = Math.max(1, Math.ceil(data.length / 10))

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">Sin datos en el período</p>
  }

  return (
    <div className="flex gap-2">
      <div className="flex flex-col justify-between pb-5 text-right text-[10px] tabular-nums text-text-light" style={{ height }}>
        {ticks.map((t, i) => (
          <span key={i}>{fmtNum(t)}</span>
        ))}
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col justify-between" style={{ height: height - 20 }}>
          {ticks.map((_, i) => (
            <div key={i} className={cn('border-t', i === ticks.length - 1 ? 'border-line' : 'border-dashed border-line/60')} />
          ))}
        </div>
        <div className="relative flex items-end gap-[2px]" style={{ height: height - 20 }}>
          {data.map((d, i) => {
            const h = (d.value / max) * 100
            const active = hover === i
            return (
              <div
                key={d.key}
                className="group relative flex h-full flex-1 items-end justify-center"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <div
                  className={cn(
                    'w-full max-w-9 rounded-t transition-colors',
                    active ? 'bg-teal-900' : 'bg-teal-800',
                    hover != null && !active && 'opacity-60',
                  )}
                  style={{ height: `${Math.max(h, d.value > 0 ? 1.5 : 0)}%` }}
                />
                {active && (
                  <div
                    className="pointer-events-none absolute z-10 -translate-y-2 rounded-lg border border-line bg-sand-0 px-2.5 py-1.5 text-xs whitespace-nowrap shadow-[var(--shadow-elevated)]"
                    style={{ bottom: `${h}%` }}
                  >
                    <p className="font-medium text-olive-950">{d.label}</p>
                    <p className="tabular-nums text-muted">
                      {fmtNum(d.value)} {unit}
                    </p>
                    {d.detail && <p className="tabular-nums text-muted">{d.detail}</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex h-5 items-end gap-[2px]">
          {data.map((d, i) => (
            <span key={d.key} className="flex-1 truncate text-center text-[10px] text-text-light">
              {i % every === 0 ? d.label : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export type BarDatum = { label: string; value: number; sub?: number; meta?: string }

/**
 * Lista de barras horizontales. `sub` (opcional) se dibuja como la parte
 * completada de la barra (p. ej. recepcionados de viajes).
 */
export function HBarList({
  data,
  unit,
  subLabel,
  limit = 8,
}: {
  data: BarDatum[]
  unit: string
  subLabel?: string
  limit?: number
}) {
  const [all, setAll] = useState(false)
  const rows = all ? data : data.slice(0, limit)
  const max = Math.max(1, ...data.map((d) => d.value))
  const total = data.reduce((s, d) => s + d.value, 0)

  if (data.length === 0) {
    return <p className="py-6 text-sm text-muted">Sin datos en el período</p>
  }

  return (
    <div>
      <ul className="space-y-3">
        {rows.map((d) => {
          const share = total > 0 ? Math.round((d.value / total) * 100) : 0
          return (
            <li key={d.label} title={d.meta}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate font-medium text-olive-950">{d.label}</span>
                <span className="shrink-0 tabular-nums text-muted">
                  {fmtNum(d.value)} {unit}
                  {d.sub != null && subLabel ? ` · ${fmtNum(d.sub)} ${subLabel}` : ` · ${share}%`}
                </span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-sand-100">
                <div
                  className={cn('absolute inset-y-0 left-0 rounded-full', d.sub != null ? 'bg-olive-300' : 'bg-teal-800')}
                  style={{ width: `${(d.value / max) * 100}%` }}
                />
                {d.sub != null && (
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-teal-800"
                    style={{ width: `${(d.sub / max) * 100}%` }}
                  />
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {data.length > limit && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-3 text-xs font-medium text-teal-800 hover:underline"
        >
          {all ? 'Ver menos' : `Ver los ${data.length}`}
        </button>
      )}
    </div>
  )
}

export type StackSegment = { key: string; label: string; value: number; color: string }

/** Barra apilada 100% con leyenda (conteo + %). */
export function StackedBar({ segments }: { segments: StackSegment[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  const visibles = segments.filter((s) => s.value > 0)
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-sand-100">
        {visibles.map((s) => (
          <div
            key={s.key}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            title={`${s.label}: ${fmtNum(s.value)}`}
          />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="truncate text-olive-900">{s.label}</span>
            </span>
            <span className="tabular-nums text-muted">
              {fmtNum(s.value)} · {total ? Math.round((s.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Selector segmentado compacto. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string }>
  ariaLabel: string
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-lg border border-line bg-sand-50 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition',
            value === o.value ? 'bg-sand-0 text-olive-950 shadow-[var(--shadow-card)]' : 'text-muted hover:text-olive-900',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
