import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileCheck2,
  Search,
  Smartphone,
  Timer,
  Truck,
  type LucideIcon,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { ProgressRing } from '../components/ui/Charts'
import { Breadcrumbs, ErrorBanner, LoadingBlock } from '../components/ui/Feedback'
import { isAbortError, listPage } from '../lib/api'
import { useOnLiveEvent, useOnLiveResync } from '../context/LiveEventsContext'
import { useDebounce } from '../hooks/useDebounce'
import { cn, fmtNum } from '../lib/utils'
import type { GuiaIngreso, Viaje } from '../types/api'

function toIsoDate(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatFecha(iso: string) {
  const [y, m, d] = (iso || '').split('-')
  if (!y || !m || !d) return iso || '—'
  return `${d}/${m}/${y}`
}

function horaDe(ts: string | null | undefined) {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
}

function minutosDesde(ts: string | null | undefined, ahora: number) {
  if (!ts) return null
  const t = new Date(ts).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.round((ahora - t) / 60_000))
}

function espera(min: number | null) {
  if (min == null) return '—'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h ${min % 60} min`
  return `${Math.floor(h / 24)} d`
}

/** Más de 2 h esperando se resalta. */
const ESPERA_ALERTA_MIN = 120

function matchesQ(values: Array<string | null | undefined>, q: string) {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return values.filter(Boolean).some((v) => String(v).toLowerCase().includes(needle))
}

function WaitBadge({ min }: { min: number | null }) {
  const alerta = min != null && min >= ESPERA_ALERTA_MIN
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium tabular-nums',
        alerta ? 'bg-warn-soft text-warn' : 'bg-sand-100 text-muted',
      )}
      title="Tiempo en espera"
    >
      <Timer className="size-3" aria-hidden />
      {espera(min)}
    </span>
  )
}

function Stage({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  last,
}: {
  icon: LucideIcon
  label: string
  value: number
  hint: string
  tone: string
  last?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-line bg-sand-0 px-3.5 py-3">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', tone)}>
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-wide text-muted uppercase">{label}</p>
          <p className="font-display text-2xl leading-tight tabular-nums text-olive-950">{fmtNum(value)}</p>
          <p className="truncate text-[11px] text-muted">{hint}</p>
        </div>
      </div>
      {!last && <ChevronRight className="hidden size-4 shrink-0 text-text-light md:block" aria-hidden />}
    </div>
  )
}

function QueueCard({
  title,
  icon: Icon,
  tone,
  count,
  empty,
  children,
}: {
  title: string
  icon: LucideIcon
  tone: string
  count: number
  empty: string
  children: ReactNode
}) {
  return (
    <Card padding="none" className="flex h-full min-w-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className={cn('flex size-8 items-center justify-center rounded-lg', tone)}>
            <Icon className="size-4" aria-hidden />
          </span>
          <h2 className="font-display text-lg font-medium text-olive-950">{title}</h2>
        </div>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums',
            count ? 'bg-warn-soft text-warn' : 'bg-success-soft text-success',
          )}
        >
          {count ? `${count} pendiente${count === 1 ? '' : 's'}` : 'Al día'}
        </span>
      </div>
      {count === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-10 text-center">
          <CheckCircle2 className="size-8 text-success/70" aria-hidden />
          <p className="text-sm text-muted">{empty}</p>
        </div>
      ) : (
        <ul className="max-h-[420px] flex-1 divide-y divide-line overflow-y-auto">{children}</ul>
      )}
    </Card>
  )
}

type Evento = {
  key: string
  tipo: 'GRR' | 'Guía'
  titulo: string
  detalle: string
  ts: string | null
}

export function RecepcionPage() {
  const todayIso = toIsoDate()
  const [fecha, setFecha] = useState(todayIso)
  const [q, setQ] = useState('')
  const debouncedQ = useDebounce(q, 250)
  const [pendingGrr, setPendingGrr] = useState<Viaje[]>([])
  const [pendingGuias, setPendingGuias] = useState<GuiaIngreso[]>([])
  const [hechosViajes, setHechosViajes] = useState<Viaje[]>([])
  const [hechosGuias, setHechosGuias] = useState<GuiaIngreso[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [ahora, setAhora] = useState(() => Date.now())
  const silentReload = useRef(false)

  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    const silent = silentReload.current
    silentReload.current = false
    if (!silent) setLoading(true)
    setError(null)
    Promise.all([
      listPage<Viaje>('/api/v1/viajes', {
        estado: 'finalizado',
        skip: 0,
        limit: 200,
        signal: ac.signal,
      }),
      listPage<GuiaIngreso>('/api/v1/guias-ingreso', {
        estado: 'registrado',
        recepcionado_acopio: true,
        recepcionado_planta: false,
        skip: 0,
        limit: 200,
        signal: ac.signal,
      }),
      listPage<Viaje>('/api/v1/viajes', {
        estado: 'recepcionado',
        fecha,
        skip: 0,
        limit: 100,
        signal: ac.signal,
      }),
      listPage<GuiaIngreso>('/api/v1/guias-ingreso', {
        fecha,
        recepcionado_planta: true,
        skip: 0,
        limit: 100,
        signal: ac.signal,
      }),
    ])
      .then(([grr, guias, histV, histG]) => {
        if (ac.signal.aborted) return
        setPendingGrr(grr.items)
        setPendingGuias(guias.items)
        setHechosViajes(histV.items)
        setHechosGuias(histG.items)
        setAhora(Date.now())
      })
      .catch((e) => {
        if (isAbortError(e)) return
        setError(e instanceof Error ? e.message : 'No se pudo cargar recepción')
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false)
      })
    return () => ac.abort()
  }, [fecha, reloadTick])

  const recargarSilencioso = () => {
    silentReload.current = true
    setReloadTick((n) => n + 1)
  }
  useOnLiveEvent(recargarSilencioso)
  useOnLiveResync(recargarSilencioso)

  // Los más antiguos primero: son los que llevan más tiempo esperando.
  const filteredGrr = useMemo(
    () =>
      pendingGrr
        .filter((v) => matchesQ([v.codigo, v.placa, v.conductor_nombre, v.grr_numero], debouncedQ))
        .sort((a, b) => a.updated_at.localeCompare(b.updated_at)),
    [pendingGrr, debouncedQ],
  )
  const filteredGuias = useMemo(
    () =>
      pendingGuias
        .filter((g) => matchesQ([g.codigo, g.placa, g.fundo, g.modulo, g.lote], debouncedQ))
        .sort((a, b) => (a.recepcionado_acopio_at ?? a.created_at).localeCompare(b.recepcionado_acopio_at ?? b.created_at)),
    [pendingGuias, debouncedQ],
  )

  const eventos = useMemo<Evento[]>(() => {
    const list: Evento[] = [
      ...hechosViajes.map((v) => ({
        key: `v-${v.id}`,
        tipo: 'GRR' as const,
        titulo: v.grr_numero || v.codigo,
        detalle: `${v.codigo} · ${v.placa || 'Sin placa'} · ${v.conductor_nombre || 'Sin conductor'}`,
        ts: v.updated_at,
      })),
      ...hechosGuias.map((g) => ({
        key: `g-${g.id}`,
        tipo: 'Guía' as const,
        titulo: g.codigo,
        detalle: `${g.fundo} · ${g.modulo} · ${g.lote} · ${fmtNum(g.jarras_totales)} jarras`,
        ts: g.recepcionado_planta_at,
      })),
    ]
    return list
      .filter((e) => matchesQ([e.titulo, e.detalle], debouncedQ))
      .sort((a, b) => (b.ts ?? '').localeCompare(a.ts ?? ''))
  }, [hechosViajes, hechosGuias, debouncedQ])

  const hechos = hechosViajes.length + hechosGuias.length
  const pendientes = pendingGrr.length + pendingGuias.length
  const avance = hechos + pendientes > 0 ? Math.round((hechos / (hechos + pendientes)) * 100) : 100
  const jarrasPendientes = pendingGuias.reduce((s, g) => s + g.jarras_totales, 0)
  const esperaMax = Math.max(
    0,
    ...pendingGrr.map((v) => minutosDesde(v.updated_at, ahora) ?? 0),
    ...pendingGuias.map((g) => minutosDesde(g.recepcionado_acopio_at ?? g.created_at, ahora) ?? 0),
  )
  const esHoy = fecha === todayIso

  const control = 'flex h-10 items-center rounded-lg border border-line bg-sand-0 text-sm text-olive-950'

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Recepción' }]} />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-medium tracking-tight text-olive-950 sm:text-3xl">
              Recepción en planta
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-success" />
              </span>
              En vivo
            </span>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
            <Smartphone className="size-3.5" aria-hidden />
            Solo consulta: la confirmación se hace desde la app móvil.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className={cn(control, 'relative w-[240px]')}>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-text-light" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="GRR, placa, código…"
              aria-label="Buscar"
              className="h-10 w-full rounded-lg bg-transparent pr-3 pl-9 text-sm text-olive-950 outline-none placeholder:text-text-light focus:ring-2 focus:ring-teal-800/15"
            />
          </div>
          <label className={cn(control, 'gap-2 px-3')}>
            <span className="text-xs text-muted">{esHoy ? 'Hoy' : 'Fecha'}</span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value || todayIso)}
              className="h-10 bg-transparent text-sm text-olive-950 outline-none"
            />
          </label>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => setReloadTick((n) => n + 1)} />}

      {loading ? (
        <LoadingBlock label="Cargando recepción…" />
      ) : (
        <div className="space-y-4">
          <Card padding="lg">
            <div className="flex flex-col gap-5 md:flex-row md:items-center">
              <div className="flex items-center gap-4 md:w-[260px] md:shrink-0">
                <ProgressRing pct={avance} label="avance" />
                <div className="min-w-0">
                  <p className="font-display text-lg text-olive-950">
                    {pendientes === 0 ? 'Todo recepcionado' : `${fmtNum(pendientes)} por recepcionar`}
                  </p>
                  <p className="text-xs text-muted">
                    {fmtNum(hechos)} recepcionados {esHoy ? 'hoy' : `el ${formatFecha(fecha)}`}
                  </p>
                  {pendientes > 0 && (
                    <p
                      className={cn(
                        'mt-1 text-xs font-medium',
                        esperaMax >= ESPERA_ALERTA_MIN ? 'text-warn' : 'text-muted',
                      )}
                    >
                      Mayor espera: {espera(esperaMax)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
                <Stage
                  icon={ClipboardList}
                  label="Guías en camino"
                  value={pendingGuias.length}
                  hint={`${fmtNum(jarrasPendientes)} jarras sin llegar a planta`}
                  tone="bg-info-soft text-info"
                />
                <Stage
                  icon={Truck}
                  label="GRR por escanear"
                  value={pendingGrr.length}
                  hint="Viajes finalizados"
                  tone="bg-warn-soft text-warn"
                />
                <Stage
                  icon={FileCheck2}
                  label="Recepcionados"
                  value={hechos}
                  hint={`${fmtNum(hechosViajes.length)} GRR · ${fmtNum(hechosGuias.length)} guías`}
                  tone="bg-success-soft text-success"
                  last
                />
              </div>
            </div>
          </Card>

          <section className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
            <QueueCard
              title="GRR por escanear"
              icon={Truck}
              tone="bg-warn-soft text-warn"
              count={filteredGrr.length}
              empty="No hay GRR pendientes."
            >
              {filteredGrr.map((v) => {
                const min = minutosDesde(v.updated_at, ahora)
                return (
                  <li key={v.id} className="flex items-center gap-3 px-4 py-3 transition hover:bg-olive-50/60">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sand-100 text-[11px] font-semibold tracking-wide text-olive-800">
                      {(v.placa || '—').slice(0, 3)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/viajes?fecha=${v.fecha}`}
                        className="font-medium tracking-wide text-teal-800 hover:underline"
                      >
                        {v.grr_numero || v.codigo}
                      </Link>
                      <p className="truncate text-xs text-muted">
                        {v.placa || 'Sin placa'} · {v.conductor_nombre || 'Sin conductor'}
                      </p>
                    </div>
                    <WaitBadge min={min} />
                  </li>
                )
              })}
            </QueueCard>

            <QueueCard
              title="Guías en camino a planta"
              icon={ClipboardList}
              tone="bg-info-soft text-info"
              count={filteredGuias.length}
              empty="No hay guías pendientes en planta."
            >
              {filteredGuias.map((g) => {
                const min = minutosDesde(g.recepcionado_acopio_at ?? g.created_at, ahora)
                return (
                  <li key={g.id} className="flex items-center gap-3 px-4 py-3 transition hover:bg-olive-50/60">
                    <div className="min-w-0 flex-1">
                      <Link to="/despacho" className="font-medium tracking-wide text-teal-800 hover:underline">
                        {g.codigo}
                      </Link>
                      <p className="truncate text-xs text-muted">
                        {g.fundo} · {g.modulo} · {g.lote} · {g.placa || 'Sin placa'}
                      </p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="text-sm font-medium tabular-nums text-olive-950">{fmtNum(g.jarras_totales)}</p>
                      <p className="text-[11px] text-muted">jarras</p>
                    </div>
                    <WaitBadge min={min} />
                  </li>
                )
              })}
            </QueueCard>
          </section>

          <Card padding="none">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <h2 className="font-display text-lg font-medium text-olive-950">
                Historial {esHoy ? 'de hoy' : `del ${formatFecha(fecha)}`}
              </h2>
              <span className="text-xs text-muted tabular-nums">{eventos.length} registros</span>
            </div>
            {eventos.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">Aún no hay recepciones en esta fecha.</p>
            ) : (
              <ol className="max-h-[480px] overflow-y-auto px-4 py-2">
                {eventos.map((e, i) => (
                  <li key={e.key} className="relative flex gap-3 py-2.5">
                    <div className="flex w-12 shrink-0 justify-end pt-0.5 text-xs tabular-nums text-muted">
                      {horaDe(e.ts)}
                    </div>
                    <div className="relative flex w-4 shrink-0 justify-center">
                      {i < eventos.length - 1 && (
                        <span className="absolute top-4 -bottom-3 w-px bg-line" aria-hidden />
                      )}
                      <span
                        className={cn(
                          'relative mt-1 size-2.5 rounded-full ring-4 ring-sand-0',
                          e.tipo === 'GRR' ? 'bg-success' : 'bg-teal-800',
                        )}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium tracking-wide text-olive-950">{e.titulo}</span>
                        <span
                          className={cn(
                            'rounded px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase',
                            e.tipo === 'GRR' ? 'bg-success-soft text-success' : 'bg-info-soft text-info',
                          )}
                        >
                          {e.tipo}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted">{e.detalle}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
