import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Card, CardHeader } from '../components/ui/Card'
import {
  Breadcrumbs,
  ErrorBanner,
  EstadoDespacho,
  LoadingBlock,
} from '../components/ui/Feedback'
import { isAbortError, listPage } from '../lib/api'
import { useOnLiveEvent } from '../context/LiveEventsContext'
import { useDebounce } from '../hooks/useDebounce'
import { cn } from '../lib/utils'
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

function matchesQ(viaje: Viaje, q: string) {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return [viaje.codigo, viaje.placa, viaje.conductor_nombre, viaje.grr_numero]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(needle))
}

function KpiCard({
  label,
  value,
  hint,
  valueClass,
}: {
  label: string
  value: number
  hint: string
  valueClass: string
}) {
  return (
    <Card className="h-full">
      <p className="text-[11px] font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className={cn('mt-1 font-display text-3xl font-medium tabular-nums', valueClass)}>{value}</p>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
    </Card>
  )
}

function PendingPill({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">
      <span className="size-1.5 rounded-full bg-warn" />
      {label}
    </span>
  )
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
  const silentReload = useRef(false)

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

  useOnLiveEvent(() => {
    silentReload.current = true
    setReloadTick((n) => n + 1)
  })

  const filteredGrr = useMemo(
    () => pendingGrr.filter((v) => matchesQ(v, debouncedQ)),
    [pendingGrr, debouncedQ],
  )
  const filteredGuias = useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase()
    if (!needle) return pendingGuias
    return pendingGuias.filter((g) =>
      [g.codigo, g.placa, g.fundo, g.modulo].some((v) => String(v).toLowerCase().includes(needle)),
    )
  }, [pendingGuias, debouncedQ])

  const control =
    'flex h-10 items-center rounded-lg border border-line bg-sand-0 text-sm text-olive-950'

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Recepción' }]} />

      <div className="mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-2xl font-medium tracking-tight text-olive-950 sm:text-3xl">
            Recepción
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <div className={cn(control, 'relative w-[240px]')}>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-text-light" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="GRR, placa, código…"
                aria-label="Buscar"
                className="h-10 w-full rounded-lg bg-transparent pr-3 pl-9 text-sm text-olive-950 outline-none placeholder:text-text-light focus:border-teal-800 focus:ring-2 focus:ring-teal-800/15"
              />
            </div>
            <label className={cn(control, 'gap-2 px-3')}>
              <span className="text-xs text-muted">{fecha === todayIso ? 'Hoy' : 'Fecha'}</span>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value || todayIso)}
                className="h-10 bg-transparent text-sm text-olive-950 outline-none"
              />
            </label>
          </div>
        </div>
        <p className="mt-1.5 max-w-2xl text-sm text-muted">
          Consulta de pendientes en planta. La confirmación se hace desde la app móvil.
        </p>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => setReloadTick((n) => n + 1)} />}

      {loading ? (
        <LoadingBlock label="Cargando recepción…" />
      ) : (
        <div className="space-y-4">
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <KpiCard
              label="GRR pendientes"
              value={pendingGrr.length}
              hint="Viajes finalizados"
              valueClass="text-warn"
            />
            <KpiCard
              label="Guías en planta"
              value={pendingGuias.length}
              hint="Pendiente recepción"
              valueClass="text-teal-800"
            />
            <KpiCard
              label="Recepcionados"
              value={hechosViajes.length + hechosGuias.length}
              hint={fecha === todayIso ? 'Completados hoy' : `En ${formatFecha(fecha)}`}
              valueClass="text-success"
            />
          </section>

          <section className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-2">
            <Card padding="none" className="flex h-full min-w-0 flex-col">
              <div className="border-b border-line px-4 py-3">
                <CardHeader
                  title="GRR pendientes"
                  actions={
                    <span className="text-xs text-muted">
                      {filteredGrr.length} {filteredGrr.length === 1 ? 'pendiente' : 'pendientes'}
                    </span>
                  }
                />
              </div>
              {filteredGrr.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted">
                  No hay GRR pendientes. Se confirman desde la app móvil.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {filteredGrr.map((v) => (
                    <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <Link
                          to={`/viajes?fecha=${v.fecha}`}
                          className="font-medium tracking-wide text-teal-800 hover:underline"
                        >
                          {v.grr_numero || v.codigo}
                        </Link>
                        <p className="truncate text-xs text-muted">
                          {v.codigo} · {v.placa || 'Sin placa'} · {v.conductor_nombre || 'Sin conductor'}
                        </p>
                      </div>
                      <EstadoDespacho estado={v.estado} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card padding="none" className="flex h-full min-w-0 flex-col">
              <div className="border-b border-line px-4 py-3">
                <CardHeader
                  title="Guías pendientes en planta"
                  actions={
                    <span className="text-xs text-muted">
                      {filteredGuias.length} {filteredGuias.length === 1 ? 'pendiente' : 'pendientes'}
                    </span>
                  }
                />
              </div>
              {filteredGuias.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted">No hay guías pendientes en planta.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {filteredGuias.map((g) => (
                    <li key={g.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <Link to="/despacho" className="font-medium tracking-wide text-teal-800 hover:underline">
                          {g.codigo}
                        </Link>
                        <p className="truncate text-xs text-muted">
                          {g.fundo} · {g.modulo} · {g.placa || 'Sin placa'}
                        </p>
                      </div>
                      <PendingPill label="Pendiente" />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>

          <Card padding="none">
            <div className="border-b border-line px-4 py-3">
              <CardHeader
                title="Historial del día"
                actions={
                  <span className="text-xs text-muted">
                    {hechosViajes.length + hechosGuias.length} registros
                  </span>
                }
              />
            </div>
            {hechosViajes.length === 0 && hechosGuias.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">Aún no hay recepciones en esta fecha.</p>
            ) : (
              <ul className="divide-y divide-line">
                {hechosViajes.map((v) => (
                  <li key={`v-${v.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium tracking-wide text-olive-950">{v.grr_numero || v.codigo}</p>
                      <p className="truncate text-xs text-muted">{v.placa} · GRR</p>
                    </div>
                    <EstadoDespacho estado={v.estado} />
                  </li>
                ))}
                {hechosGuias.map((g) => (
                  <li key={`g-${g.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium tracking-wide text-olive-950">{g.codigo}</p>
                      <p className="truncate text-xs text-muted">
                        {g.fundo} · {g.modulo} · Guía
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
                      Planta
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
