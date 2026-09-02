import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ClipboardList,
  MapPinned,
  Package,
  RefreshCw,
  Truck,
  Users,
  Boxes,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useOnGuiaLive } from '../context/LiveEventsContext'
import { apiGet, isAbortError } from '../lib/api'
import { cn, formatFechaLarga } from '../lib/utils'
import { Button } from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import { EstadoDespacho, ErrorBanner } from '../components/ui/Feedback'
import type { DashboardResumen } from '../types/api'

function toIsoDate(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(iso: string, delta: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, (d ?? 1) + delta)
  return toIsoDate(dt)
}

function formatShort(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function formatNum(n: number) {
  return n.toLocaleString('es-PE')
}

function saludo() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function pctChange(today: number, yesterday: number) {
  if (yesterday <= 0) return today > 0 ? 100 : null
  return Math.round(((today - yesterday) / yesterday) * 100)
}

const DONUT_COLORS = ['#0066cc', '#1b3a6b', '#5a85b8', '#dde3eb']

function Trend({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs text-muted">Sin dato de ayer</span>
  const up = value >= 0
  return (
    <span className={cn('text-xs font-medium', up ? 'text-success' : 'text-danger')}>
      {up ? '↑' : '↓'} {Math.abs(value)}% vs ayer
    </span>
  )
}

function Donut({
  rows,
}: {
  rows: Array<{ label: string; count: number; pct: number }>
}) {
  const total = rows.reduce((s, r) => s + r.count, 0)
  let acc = 0
  const stops = rows.map((r, i) => {
    const start = acc
    acc += total ? (r.count / total) * 100 : 0
    return `${DONUT_COLORS[i % DONUT_COLORS.length]} ${start}% ${acc}%`
  })
  return (
    <div className="flex items-center gap-5">
      <div
        className="relative size-28 shrink-0 rounded-full"
        style={{ background: total ? `conic-gradient(${stops.join(', ')})` : 'var(--color-sand-100)' }}
        aria-hidden
      >
        <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-sand-0">
          <span className="font-display text-xl text-olive-950">{total}</span>
          <span className="text-[10px] text-muted">total</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {rows.map((r, i) => (
          <li key={r.label} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
              />
              <span className="truncate text-olive-900">{r.label}</span>
            </span>
            <span className="tabular-nums text-muted">
              {r.count} · {r.pct}%
            </span>
          </li>
        ))}
        {rows.length === 0 && <li className="text-xs text-muted">Sin despachos en esta fecha</li>}
      </ul>
    </div>
  )
}

const accesos = [
  { to: '/ubicaciones', title: 'Fundos', desc: 'Gestionar fundos', icon: MapPinned, tone: 'bg-success-soft text-success' },
  { to: '/personas', title: 'Personas', desc: 'Usuarios y asignaciones', icon: Users, tone: 'bg-warn-soft text-warn' },
  { to: '/flota', title: 'Flota', desc: 'Vehículos y choferes', icon: Truck, tone: 'bg-olive-100 text-olive-800' },
  { to: '/despacho', title: 'Despacho', desc: 'Guías de ingreso', icon: ClipboardList, tone: 'bg-info-soft text-info' },
]

export function InicioPage() {
  const { user } = useAuth()
  const first = user?.nombre?.split(' ')[0] ?? 'equipo'
  const todayIso = toIsoDate()
  const [fecha, setFecha] = useState(todayIso)
  const [resumen, setResumen] = useState<DashboardResumen | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadTick, setReloadTick] = useState(0)
  const fechaRef = useRef(fecha)
  fechaRef.current = fecha
  const loadSilentRef = useRef<(signal?: AbortSignal) => Promise<void>>(async () => {})

  useEffect(() => {
    const ac = new AbortController()
    async function load(signal: AbortSignal, silent = false) {
      if (!silent) {
        setLoading(true)
        setError(null)
      }
      try {
        const data = await apiGet<DashboardResumen>(
          '/api/v1/dashboard/resumen',
          { fecha },
          signal,
        )
        if (signal.aborted || fecha !== fechaRef.current) return
        setResumen(data)
      } catch (e) {
        if (isAbortError(e)) return
        setError(e instanceof Error ? e.message : 'No se pudo cargar el inicio')
      } finally {
        if (!signal.aborted && !silent) setLoading(false)
      }
    }
    loadSilentRef.current = (signal) => load(signal ?? new AbortController().signal, true)
    void load(ac.signal)
    return () => ac.abort()
  }, [fecha, reloadTick])

  useOnGuiaLive((event) => {
    const g = event.guia
    const f = fechaRef.current
    if (g.fecha === f || g.fecha === addDays(f, -1)) {
      void loadSilentRef.current()
    }
  })

  const hoy = resumen?.hoy ?? { count: 0, jabas: 0, jarras: 0 }
  const prevStats = resumen?.ayer ?? { count: 0, jabas: 0, jarras: 0 }
  const recientes = resumen?.recientes ?? []
  const porFundo = { rows: resumen?.por_fundo ?? [] }
  const porTurno = { rows: resumen?.por_turno ?? [] }
  const porModulo = { rows: resumen?.por_modulo ?? [] }
  const disponibles = resumen?.vehiculos_muestra ?? []
  const vehiculosTotal = resumen?.vehiculos_total ?? 0
  const vehiculosActivos = resumen?.vehiculos_activos ?? 0
  const maxFundo = Math.max(1, ...porFundo.rows.map((r) => r.count))
  const maxModuloPct = Math.max(1, ...porModulo.rows.map((r) => r.pct))
  const esHoy = fecha === todayIso

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight text-olive-950 sm:text-3xl">
            {saludo()}, {first}
          </h1>
          <p className="mt-1 text-sm text-muted capitalize">{formatFechaLarga(new Date(`${fecha}T12:00:00`))}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-line bg-sand-0 px-3 py-2 text-sm">
            <span className="text-xs text-muted">{esHoy ? 'Hoy' : 'Fecha'}</span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value || todayIso)}
              className="bg-transparent text-sm text-olive-950 outline-none"
            />
          </label>
          <Button
            variant="secondary"
            leftIcon={<RefreshCw className="size-3.5" />}
            onClick={() => setReloadTick((n) => n + 1)}
            loading={loading}
          >
            Actualizar
          </Button>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => setReloadTick((n) => n + 1)} />}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Despachos"
          value={loading ? '—' : formatNum(hoy.count)}
          hint={esHoy ? 'Registrados hoy' : `En ${formatShort(fecha)}`}
          icon={ClipboardList}
          tone="bg-info-soft text-info"
          footer={<Trend value={loading ? null : pctChange(hoy.count, prevStats.count)} />}
        />
        <KpiCard
          label="Jabas despachadas"
          value={loading ? '—' : formatNum(hoy.jabas)}
          hint="Completas + incompletas"
          icon={Package}
          tone="bg-success-soft text-success"
          footer={<Trend value={loading ? null : pctChange(hoy.jabas, prevStats.jabas)} />}
        />
        <KpiCard
          label="Jarras totales"
          value={loading ? '—' : formatNum(hoy.jarras)}
          hint="Despachadas en la fecha"
          icon={Boxes}
          tone="bg-olive-100 text-olive-800"
          footer={<Trend value={loading ? null : pctChange(hoy.jarras, prevStats.jarras)} />}
        />
        <KpiCard
          label="Vehículos"
          value={loading ? '—' : `${vehiculosActivos}/${vehiculosTotal}`}
          hint="Disponibles / total"
          icon={Truck}
          tone="bg-warn-soft text-warn"
          footer={
            <Link to="/flota" className="text-xs font-medium text-teal-800 hover:underline">
              Ver flota →
            </Link>
          }
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
        <Card padding="none">
          <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-4">
            <CardHeader title="Despachos recientes" />
            <Link to="/despacho" className="text-xs font-medium text-teal-800 hover:underline">
              Ver todos
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-olive-100/50" />
              ))}
            </div>
          ) : recientes.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted">No hay despachos en esta fecha.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recientes.map((g) => (
                <li key={g.id}>
                  <Link
                    to="/despacho"
                    className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-olive-50/60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium tracking-wide text-olive-950">{g.codigo}</span>
                        <EstadoDespacho estado={g.estado} />
                      </div>
                      <p className="mt-1 truncate text-xs text-muted">
                        {g.hora_envio} · {g.usuario_nombre}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {g.fundo || '—'} · {g.modulo} · {g.turno} · {g.lote}
                      </p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="text-sm font-medium tabular-nums text-olive-950">{formatNum(g.jabas_totales)} jabas</p>
                      <p className="text-xs tabular-nums text-muted">{formatNum(g.jarras_totales)} jarras</p>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-line px-5 py-3">
            <Link to="/despacho" className="text-xs font-medium text-teal-800 hover:underline">
              Ver todos los despachos
            </Link>
          </div>
        </Card>

        <Card padding="none">
          <div className="border-b border-line px-5 py-4">
            <CardHeader title="Vehículos disponibles" />
          </div>
          <div className="space-y-2 p-4">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-olive-100/50" />
                ))}
              </div>
            ) : disponibles.length === 0 ? (
              <p className="py-6 text-sm text-muted">No hay vehículos activos.</p>
            ) : (
              disponibles.map((v) => (
                <Link
                  key={v.id}
                  to="/flota"
                  className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5 transition hover:bg-olive-50/60"
                >
                  <span className="font-medium tracking-wide text-olive-950">{v.placa}</span>
                  <span className="rounded-md bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
                    Disponible
                  </span>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Resumen por fundo" description={esHoy ? 'Hoy' : formatShort(fecha)} />
          <ul className="mt-4 space-y-3">
            {porFundo.rows.length === 0 ? (
              <li className="text-sm text-muted">Sin datos</li>
            ) : (
              porFundo.rows.map((r) => (
                <li key={r.label}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-olive-950">{r.label}</span>
                    <span className="tabular-nums text-muted">
                      {r.count} · {formatNum(r.jarras)} jarras
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-sand-100">
                    <div
                      className="h-full rounded-full bg-teal-800"
                      style={{ width: `${(r.count / maxFundo) * 100}%` }}
                    />
                  </div>
                </li>
              ))
            )}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Despachos por turno" description={esHoy ? 'Hoy' : formatShort(fecha)} />
          <div className="mt-4">
            <Donut rows={porTurno.rows} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Top módulos" description={esHoy ? 'Hoy' : formatShort(fecha)} />
          <ul className="mt-4 space-y-3">
            {porModulo.rows.length === 0 ? (
              <li className="text-sm text-muted">Sin datos</li>
            ) : (
              porModulo.rows.map((r) => (
                <li key={r.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-olive-950">{r.label}</span>
                    <span className="tabular-nums text-muted">{r.pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-sand-100">
                    <div
                      className="h-full rounded-full bg-olive-700"
                      style={{ width: `${(r.pct / maxModuloPct) * 100}%` }}
                    />
                  </div>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>

      <section>
        <p className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">Accesos rápidos</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {accesos.map((a) => {
            const Icon = a.icon
            return (
              <Link
                key={a.to}
                to={a.to}
                className="group flex items-center gap-3 rounded-xl border border-line bg-sand-0 px-4 py-4 shadow-[var(--shadow-card)] transition hover:border-olive-300 hover:bg-olive-50/50"
              >
                <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', a.tone)}>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 font-medium text-olive-950">
                    {a.title}
                    <ArrowRight className="size-3.5 text-muted opacity-0 transition group-hover:opacity-100" />
                  </span>
                  <span className="block text-xs text-muted">{a.desc}</span>
                </span>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  footer,
}: {
  label: string
  value: string
  hint: string
  icon: LucideIcon
  tone: string
  footer: ReactNode
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium tracking-wide text-muted uppercase">{label}</p>
        <span className={cn('flex size-8 items-center justify-center rounded-lg', tone)}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 font-display text-3xl font-medium tabular-nums text-olive-950">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
      <div className="mt-3">{footer}</div>
    </Card>
  )
}
