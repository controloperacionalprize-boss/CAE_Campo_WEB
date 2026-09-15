import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Check, Clock } from 'lucide-react'
import { Card, CardHeader } from '../components/ui/Card'
import { ExportExcelButton } from '../components/ui/ExportExcelButton'
import {
  Breadcrumbs,
  EmptyState,
  ErrorBanner,
  EstadoDespacho,
  LoadingBlock,
} from '../components/ui/Feedback'
import { Table, TableShell, THead, Th, Td, TdTruncate, Tr } from '../components/ui/Table'
import { useToast } from '../context/ToastContext'
import { apiGet, isAbortError, listAllPages, listPage } from '../lib/api'
import { downloadExcel, stampFile } from '../lib/excel'
import { VIAJE_EXCEL_HEADERS, viajeExcelRow } from '../lib/excelRows'
import { useOnLiveEvent, useOnLiveResync } from '../context/LiveEventsContext'
import { cn } from '../lib/utils'
import type { Croquis, Grr, Viaje, ViajeCompleto, ViajeDetalle } from '../types/api'

const STEPS = [
  { key: 'creado', label: 'Creado' },
  { key: 'detalle', label: 'Detalle cargado' },
  { key: 'croquis', label: 'Croquis' },
  { key: 'grr', label: 'GRR' },
  { key: 'finalizado', label: 'Finalizado' },
  { key: 'recepcionado', label: 'Recepcionado' },
] as const

type TabId = 'detalle' | 'croquis' | 'grr'

function toIsoDate(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fechaFromUrl() {
  const q = new URLSearchParams(window.location.search).get('fecha')
  if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q
  return toIsoDate()
}

function formatFecha(iso: string) {
  const [y, m, d] = (iso || '').split('-')
  if (!y || !m || !d) return iso || '—'
  return `${d}/${m}/${y}`
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function dash(value: string | number | null | undefined) {
  if (value == null || value === '') return '—'
  return String(value)
}

function joinLine(parts: Array<string | null | undefined>) {
  const text = parts
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' · ')
  return text || null
}

function formatTipo(tipo: string) {
  const key = tipo.trim().toLowerCase()
  if (key === 'directo') return 'Directo'
  if (key === 'agrupado') return 'Agrupado'
  return tipo || '—'
}

function tieneGrr(v: Pick<Viaje, 'grr_numero'> & { grr?: Grr | null }) {
  return !!(v.grr_numero || v.grr)
}

function EstacionPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
        ok ? 'bg-success-soft text-success' : 'bg-sand-100 text-muted',
      )}
    >
      <span className={cn('size-1.5 rounded-full', ok ? 'bg-success' : 'bg-muted/50')} />
      {label}
    </span>
  )
}

function Field({
  label,
  value,
  icon,
}: {
  label: string
  value: string | number | null | undefined
  icon?: ReactNode
}) {
  const text = value == null || value === '' ? '—' : String(value)
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-olive-950">
        {icon}
        {text}
      </p>
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-3 text-xs font-semibold tracking-wide text-olive-800 uppercase">{children}</h3>
  )
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-line bg-sand-50 px-3 py-2.5">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-0.5 font-display text-lg font-medium tabular-nums text-olive-950">{value}</p>
    </div>
  )
}

function completedSteps(viaje: ViajeCompleto) {
  const estado = viaje.estado.toLowerCase()
  const done = [
    true,
    viaje.detalle.length > 0,
    !!viaje.croquis,
    !!viaje.grr,
    estado === 'finalizado' || estado === 'recepcionado',
    estado === 'recepcionado',
  ]
  return done
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
    <Card>
      <p className="text-[11px] font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className={cn('mt-1 font-display text-3xl font-medium tabular-nums', valueClass)}>{value}</p>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
    </Card>
  )
}

function ViajeStepper({ viaje }: { viaje: ViajeCompleto }) {
  const done = completedSteps(viaje)
  const current = done.lastIndexOf(true) + 1
  return (
    <ol className="flex items-start justify-between gap-1">
      {STEPS.map((step, i) => {
        const complete = done[i]
        const active = !complete && i === current
        return (
          <li key={step.key} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-medium',
                  complete && 'bg-success text-white',
                  active && 'bg-warn text-white',
                  !complete && !active && 'bg-sand-100 text-muted',
                )}
              >
                {complete ? <Check className="size-3.5" strokeWidth={2.5} /> : i + 1}
              </span>
              {i < STEPS.length - 1 && (
                <span
                  className={cn('mx-1 h-0.5 flex-1 rounded-full', done[i] ? 'bg-success' : 'bg-line')}
                />
              )}
            </div>
            <span
              className={cn(
                'mt-2 max-w-[5.5rem] text-center text-[10px] leading-tight',
                complete || active ? 'font-medium text-olive-900' : 'text-muted',
              )}
            >
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function DetalleTab({ items }: { items: ViajeDetalle[] }) {
  const totals = items.reduce(
    (s, r) => ({
      jabasC: s.jabasC + (r.jabas_completas ?? 0),
      jabasI: s.jabasI + (r.jabas_incompletas ?? 0),
      jarrasJ: s.jarrasJ + (r.jarras_jabas ?? 0),
      jarrasE: s.jarrasE + (r.jarras_extras ?? 0),
    }),
    { jabasC: 0, jabasI: 0, jarrasJ: 0, jarrasE: 0 },
  )

  if (!items.length) {
    return (
      <div className="px-5 py-5">
        <p className="text-sm text-muted">Este viaje aún no tiene guías de ingreso.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 border-b border-line px-5 py-4 sm:grid-cols-4">
        <StatBox label="Jabas completas" value={totals.jabasC} />
        <StatBox label="Jabas incompletas" value={totals.jabasI} />
        <StatBox label="Jarras / jabas" value={totals.jarrasJ} />
        <StatBox label="Jarras extras" value={totals.jarrasE} />
      </div>
      <TableShell flush stickyHeader>
        <Table className="min-w-[720px]">
          <THead sticky>
            <Th>Guía</Th>
            <Th>Fundo</Th>
            <Th>Módulo</Th>
            <Th>Turno</Th>
            <Th align="right">Jabas C.</Th>
            <Th align="right">Jabas I.</Th>
            <Th align="right">Jarras/jabas</Th>
            <Th align="right">Jarras extras</Th>
            <Th>Estado</Th>
          </THead>
          <tbody>
            {items.map((row) => (
              <Tr key={row.id}>
                <Td>
                  <Link to="/despacho" className="font-medium tracking-wide text-teal-800 hover:underline">
                    {row.guia_codigo || `GI #${row.guia_ingreso_id}`}
                  </Link>
                </Td>
                <TdTruncate>{row.fundo || '—'}</TdTruncate>
                <Td>{row.modulo || '—'}</Td>
                <Td>{row.turno || '—'}</Td>
                <Td className="text-right tabular-nums">{row.jabas_completas}</Td>
                <Td className="text-right tabular-nums">{row.jabas_incompletas}</Td>
                <Td className="text-right tabular-nums">{row.jarras_jabas}</Td>
                <Td className="text-right tabular-nums">{row.jarras_extras}</Td>
                <Td>
                  <span className="flex flex-wrap gap-1">
                    <EstacionPill ok={!!row.recepcionado_acopio} label="Acopio" />
                    <EstacionPill ok={!!row.recepcionado_planta} label="Planta" />
                  </span>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableShell>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-sand-50 px-5 py-3 text-xs text-muted">
        <span>
          Total guías: <span className="font-medium text-olive-900">{items.length}</span>
        </span>
      </div>
    </div>
  )
}

function CroquisTab({ croquis, viaje }: { croquis: Croquis | null; viaje: ViajeCompleto }) {
  if (!croquis) {
    return (
      <div className="px-5 py-5">
        <p className="text-sm text-muted">
          El croquis se carga desde la app móvil. Aún no hay uno para este viaje.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 px-5 py-5">
      <section>
        <SectionTitle>Información del croquis</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Placa" value={croquis.placa || viaje.placa} />
          <Field label="Hora de salida" value={croquis.hora_salida} icon={<Clock className="size-3.5 text-muted" />} />
          <Field label="Punto de partida" value={croquis.punto_partida} />
          <Field label="Punto de llegada" value={croquis.punto_llegada} />
          <Field label="Motivo traslado" value={croquis.motivo_traslado} />
        </div>
      </section>
      <section>
        <SectionTitle>Pallets</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {croquis.pallets.map((p) => (
            <div key={p.id} className="rounded-lg border border-line bg-sand-50 px-3 py-2.5">
              <p className="font-medium tracking-wide text-olive-950">{p.nombre || 'Pallet'}</p>
              <p className="mt-1 text-xs text-muted">
                {joinLine([p.modulo, p.turno]) || '—'}
              </p>
              <p className="mt-1 text-sm tabular-nums text-olive-950">
                {p.jarras} jarras · {p.jabas} jabas
              </p>
              {p.variedad ? <p className="mt-1 truncate text-xs text-olive-800">{p.variedad}</p> : null}
              {p.continuaciones?.length
                ? p.continuaciones.map((c) => (
                    <p key={c.id} className="mt-1 text-[11px] text-muted">
                      + {c.modulo} · {c.jarras} jarras · {c.jabas} jabas
                    </p>
                  ))
                : null}
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatBox label="Pallets" value={croquis.total_pallets} />
          <StatBox label="Jarras totales" value={croquis.total_jarras} />
          <StatBox label="Jabas totales" value={croquis.total_jabas} />
        </div>
      </section>
    </div>
  )
}

function GrrTab({ grr, viaje }: { grr: Grr | null; viaje: ViajeCompleto }) {
  return (
    <div className="space-y-6 px-5 py-5">
      <section>
        <SectionTitle>Guía de remisión</SectionTitle>
        <p className="mb-3 text-sm text-muted">
          {grr
            ? `Emitida ${formatFecha(grr.fecha_emision)}`
            : 'Pendiente de generar para este viaje. La GRR se crea en la app móvil, no desde la web.'}
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Número" value={grr?.numero} />
          <Field
            label="Fecha emisión"
            value={grr ? formatFecha(grr.fecha_emision) : null}
            icon={<Calendar className="size-3.5 text-muted" />}
          />
          <Field label="Motivo traslado" value={grr?.motivo_traslado} />
          <Field label="Remitente" value={grr?.remitente} />
          <Field label="Destinatario" value={grr?.destinatario} />
          <Field label="Conductor" value={viaje.conductor_nombre} />
          <Field label="Placa" value={grr?.placa || viaje.placa} />
          <Field label="Punto de partida" value={grr?.punto_partida} />
          <Field label="Punto de llegada" value={grr?.punto_llegada} />
        </div>
      </section>
      <section>
        <SectionTitle>Totales</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <StatBox label="Jarras totales" value={grr?.total_jarras ?? '—'} />
          <StatBox label="Jabas totales" value={grr?.total_jabas ?? '—'} />
          <StatBox label="Estado GRR" value={grr ? (grr.recepcionado ? 'Recepcionada' : dash(grr.estado)) : '—'} />
        </div>
      </section>
    </div>
  )
}

export function ViajesPage() {
  const toast = useToast()
  const todayIso = toIsoDate()
  const [fecha, setFecha] = useState(fechaFromUrl)
  const [items, setItems] = useState<Viaje[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detalle, setDetalle] = useState<ViajeCompleto | null>(null)
  const [tab, setTab] = useState<TabId>('detalle')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const silentReload = useRef(false)

  const kpis = useMemo(() => {
    const by = { en_proceso: 0, finalizado: 0, recepcionado: 0, anulado: 0 }
    for (const v of items) {
      const k = v.estado.toLowerCase() as keyof typeof by
      if (k in by) by[k] += 1
    }
    return by
  }, [items])

  useEffect(() => {
    const ac = new AbortController()
    const silent = silentReload.current
    silentReload.current = false
    if (!silent) setLoading(true)
    setError(null)
    listPage<Viaje>('/api/v1/viajes', { fecha, skip: 0, limit: 200, signal: ac.signal })
      .then((page) => {
        if (ac.signal.aborted) return
        const next = page.items
        setItems(next)
        setSelectedId((current) => {
          if (current && next.some((v) => v.id === current)) return current
          return next[0]?.id ?? null
        })
      })
      .catch((e) => {
        if (isAbortError(e)) return
        setError(e instanceof Error ? e.message : 'No se pudieron cargar los viajes')
        setItems([])
        setSelectedId(null)
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false)
      })
    return () => ac.abort()
  }, [fecha, reloadTick])

  useEffect(() => {
    if (!selectedId) {
      setDetalle(null)
      return
    }
    const ac = new AbortController()
    setDetalle((current) => (current?.id === selectedId ? current : null))
    setDetailLoading(true)
    apiGet<ViajeCompleto>(`/api/v1/viajes/${selectedId}`, undefined, ac.signal)
      .then((row) => {
        if (!ac.signal.aborted) setDetalle(row)
      })
      .catch((e) => {
        if (isAbortError(e)) return
        setError((prev) => prev ?? (e instanceof Error ? e.message : 'No se pudo cargar el viaje'))
        setDetalle(null)
      })
      .finally(() => {
        if (!ac.signal.aborted) setDetailLoading(false)
      })
    return () => ac.abort()
  }, [selectedId, reloadTick])

  useOnLiveEvent((event) => {
    if (event.type.startsWith('guia.') || event.type.startsWith('viaje.')) {
      silentReload.current = true
      setReloadTick((n) => n + 1)
    }
  })

  useOnLiveResync(() => {
    silentReload.current = true
    setReloadTick((n) => n + 1)
  })

  const nGuias = detalle?.detalle.length ?? 0
  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'detalle', label: `Detalle (${nGuias} ${nGuias === 1 ? 'guía' : 'guías'})` },
    { id: 'croquis', label: 'Croquis' },
    { id: 'grr', label: 'GRR' },
  ]

  async function exportarExcel() {
    try {
      const rows = await listAllPages<Viaje>('/api/v1/viajes', { fecha })
      if (!rows.length) {
        toast.warning('No hay viajes para exportar en esta fecha')
        return
      }
      downloadExcel(stampFile(`viajes_${fecha}`), [
        { name: 'Viajes', headers: VIAJE_EXCEL_HEADERS, rows: rows.map(viajeExcelRow) },
      ])
      toast.success(`Se exportaron ${rows.length} ${rows.length === 1 ? 'viaje' : 'viajes'}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo exportar a Excel')
    }
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Viajes' }]} />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-2xl font-medium tracking-tight text-olive-950 sm:text-3xl">Viajes</h1>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-line bg-sand-0 px-3 py-2 text-sm">
            <span className="text-xs text-muted">{fecha === todayIso ? 'Hoy' : 'Fecha'}</span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value || todayIso)}
              className="bg-transparent text-sm text-olive-950 outline-none"
            />
          </label>
          <ExportExcelButton onExport={exportarExcel} disabled={items.length === 0} />
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => setReloadTick((n) => n + 1)} />}

      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="En proceso" value={kpis.en_proceso} hint="Viajes abiertos" valueClass="text-warn" />
        <KpiCard
          label="Finalizados"
          value={kpis.finalizado}
          hint="Pendiente recepción"
          valueClass="text-teal-800"
        />
        <KpiCard
          label="Recepcionados"
          value={kpis.recepcionado}
          hint="Completados hoy"
          valueClass="text-success"
        />
        <KpiCard label="Anulados" value={kpis.anulado} hint="Este día" valueClass="text-olive-950" />
      </section>

      {loading ? (
        <LoadingBlock label="Cargando viajes…" />
      ) : items.length === 0 ? (
        <EmptyState
          title="Sin viajes"
          description="No hay viajes registrados en esta fecha. Se arman desde la app móvil."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
          <Card padding="none" className="flex flex-col">
            <div className="border-b border-line px-4 py-3">
              <CardHeader title="Viajes del día" description={`${items.length} registros`} />
            </div>
            <ul className="flex-1 divide-y divide-line overflow-y-auto">
              {items.map((v) => {
                const transporte = joinLine([v.placa || 'Sin placa', v.conductor_nombre || 'Sin conductor'])
                const ruta = joinLine([v.kia_origen, v.kia_destino])
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(v.id)
                        setTab('detalle')
                      }}
                      className={cn(
                        'relative flex w-full flex-col gap-1 border-l-[3px] px-4 py-3 text-left transition-colors',
                        selectedId === v.id
                          ? 'border-l-teal-800 bg-sage-100'
                          : 'border-l-transparent hover:bg-sand-50',
                      )}
                      aria-current={selectedId === v.id ? 'true' : undefined}
                    >
                      <span
                        className={cn(
                          'tracking-wide',
                          selectedId === v.id ? 'font-semibold text-olive-950' : 'font-medium text-olive-900',
                        )}
                      >
                        {v.codigo}
                      </span>
                      <span className="text-xs text-muted">
                        {formatFecha(v.fecha)} · {formatTipo(v.tipo_viaje)}
                      </span>
                      {transporte && <span className="truncate text-xs text-muted">{transporte}</span>}
                      {ruta && <span className="truncate text-xs text-olive-800">{ruta}</span>}
                      {v.grr_numero ? (
                        <span className="truncate text-xs text-olive-800">{v.grr_numero}</span>
                      ) : null}
                      <span className="mt-0.5 flex flex-wrap gap-1">
                        <EstadoDespacho estado={v.estado} />
                        <EstacionPill ok={tieneGrr(v)} label="GRR" />
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Card>

          <Card padding="none">
            {detailLoading && !detalle ? (
              <LoadingBlock label="Cargando detalle…" />
            ) : !detalle ? (
              <div className="p-6">
                <p className="text-sm text-muted">Seleccione un viaje de la lista.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                  <div className="flex min-w-0 flex-wrap items-center gap-3">
                    <h2 className="font-display text-lg font-medium text-olive-950">Detalle de viaje</h2>
                    <EstadoDespacho estado={detalle.estado} />
                    <EstacionPill ok={tieneGrr(detalle)} label="GRR" />
                  </div>
                  <p className="font-medium tracking-wide text-olive-800">{detalle.codigo}</p>
                </div>

                <div className="space-y-6 px-5 py-5">
                  <section>
                    <SectionTitle>Información general</SectionTitle>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <Field label="Código" value={detalle.codigo} />
                      <Field
                        label="Fecha"
                        value={formatFecha(detalle.fecha)}
                        icon={<Calendar className="size-3.5 text-muted" />}
                      />
                      <Field label="Tipo" value={formatTipo(detalle.tipo_viaje)} />
                      <Field label="Placa" value={detalle.placa} />
                      <Field label="Conductor" value={detalle.conductor_nombre} />
                      <Field label="GRR" value={detalle.grr?.numero || detalle.grr_numero} />
                      <Field label="Origen" value={detalle.kia_origen || detalle.croquis?.punto_partida} />
                      <Field label="Destino" value={detalle.kia_destino || detalle.croquis?.punto_llegada} />
                      <Field
                        label="Creado"
                        value={formatDateTime(detalle.created_at)}
                        icon={<Clock className="size-3.5 text-muted" />}
                      />
                    </div>
                  </section>

                  <section>
                    <SectionTitle>Progreso</SectionTitle>
                    <ViajeStepper viaje={detalle} />
                  </section>
                </div>

                <div className="flex gap-1 border-y border-line px-3">
                  {tabs.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={cn(
                        'relative px-3 py-2.5 text-sm transition',
                        tab === t.id ? 'font-medium text-teal-800' : 'text-muted hover:text-olive-900',
                      )}
                    >
                      {t.label}
                      {tab === t.id && (
                        <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-teal-800" />
                      )}
                    </button>
                  ))}
                </div>

                {tab === 'detalle' && <DetalleTab items={detalle.detalle} />}
                {tab === 'croquis' && <CroquisTab croquis={detalle.croquis} viaje={detalle} />}
                {tab === 'grr' && <GrrTab grr={detalle.grr} viaje={detalle} />}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-sand-50 px-5 py-3 text-xs text-muted">
                  <span>
                    Estado: <span className="font-medium text-olive-900 capitalize">{detalle.estado.replace('_', ' ')}</span>
                    {detalle.grr?.recepcionado_at
                      ? ` · Recepcionado ${formatDateTime(detalle.grr.recepcionado_at)}`
                      : ''}
                  </span>
                  <span>
                    {detalle.observacion?.trim() ? detalle.observacion : 'Sin observaciones'} ·{' '}
                    {formatDateTime(detalle.created_at)}
                  </span>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
