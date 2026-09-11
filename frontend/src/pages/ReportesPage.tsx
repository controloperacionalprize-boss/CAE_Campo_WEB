import { useEffect, useMemo, useState } from 'react'
import { Boxes, ClipboardList, Clock, Package, RefreshCw, Truck } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import {
  ColumnChart,
  HBarList,
  MetricCard,
  ProgressBar,
  Segmented,
  StackedBar,
} from '../components/ui/Charts'
import { Breadcrumbs, ErrorBanner, LoadingBlock } from '../components/ui/Feedback'
import { Table, TableShell, THead, Th, Td, Tr } from '../components/ui/Table'
import { apiGet, isAbortError } from '../lib/api'
import { fmtNum } from '../lib/utils'
import type { ReporteDiario, ReporteRango, ReporteVehiculos, ReporteViajes } from '../types/api'

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

function formatFecha(iso: string) {
  const [y, m, d] = (iso || '').split('-')
  if (!y || !m || !d) return iso || '—'
  return `${d}/${m}/${y}`
}

function formatCorta(iso: string) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function diasEntre(desde: string, hasta: string) {
  const a = new Date(`${desde}T12:00:00`).getTime()
  const b = new Date(`${hasta}T12:00:00`).getTime()
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1)
}

type Metrica = 'guias' | 'jabas' | 'jarras'
type Agrupar = 'fundo' | 'modulo' | 'turno'

const METRICAS: Array<{ value: Metrica; label: string }> = [
  { value: 'guias', label: 'Guías' },
  { value: 'jabas', label: 'Jabas' },
  { value: 'jarras', label: 'Jarras' },
]

const PRESETS = [
  { dias: 7, label: '7 días' },
  { dias: 15, label: '15 días' },
  { dias: 30, label: '30 días' },
]

const ESTADOS_VIAJE: Array<{ key: string; label: string; color: string }> = [
  { key: 'recepcionado', label: 'Recepcionado', color: 'var(--color-success)' },
  { key: 'finalizado', label: 'Finalizado', color: 'var(--color-info)' },
  { key: 'en_proceso', label: 'En proceso', color: 'var(--color-warn)' },
  { key: 'anulado', label: 'Anulado', color: 'var(--color-danger)' },
]

export function ReportesPage() {
  const today = toIsoDate()
  const [desde, setDesde] = useState(addDays(today, -14))
  const [hasta, setHasta] = useState(today)
  const [agrupar, setAgrupar] = useState<Agrupar>('fundo')
  const [metrica, setMetrica] = useState<Metrica>('jarras')
  const [diario, setDiario] = useState<ReporteDiario | null>(null)
  const [rango, setRango] = useState<ReporteRango | null>(null)
  const [viajes, setViajes] = useState<ReporteViajes | null>(null)
  const [vehiculos, setVehiculos] = useState<ReporteVehiculos | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    setError(null)
    Promise.all([
      apiGet<ReporteDiario>('/api/v1/reportes/diario', { fecha: hasta }, ac.signal),
      apiGet<ReporteRango>('/api/v1/reportes/rango', { desde, hasta, agrupar }, ac.signal),
      apiGet<ReporteViajes>('/api/v1/reportes/viajes', { desde, hasta }, ac.signal),
      apiGet<ReporteVehiculos>('/api/v1/reportes/vehiculos', { desde, hasta }, ac.signal),
    ])
      .then(([d, r, v, ve]) => {
        if (ac.signal.aborted) return
        setDiario(d)
        setRango(r)
        setViajes(v)
        setVehiculos(ve)
      })
      .catch((e) => {
        if (isAbortError(e)) return
        setError(e instanceof Error ? e.message : 'No se pudieron cargar los reportes')
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false)
      })
    return () => ac.abort()
  }, [desde, hasta, agrupar, tick])

  const dias = diasEntre(desde, hasta)
  const metricaLabel = METRICAS.find((m) => m.value === metrica)!.label.toLowerCase()

  // Serie diaria completa: los días sin guías cuentan como 0 para no ocultar huecos.
  const serie = useMemo(() => {
    const byFecha = new Map((rango?.por_fecha ?? []).map((r) => [r.fecha, r]))
    return Array.from({ length: Math.min(dias, 367) }, (_, i) => {
      const f = addDays(desde, i)
      const r = byFecha.get(f)
      return {
        key: f,
        label: formatCorta(f),
        value: r ? r[metrica] : 0,
        detail: r ? `${fmtNum(r.guias)} guías` : 'Sin guías',
      }
    })
  }, [rango, desde, dias, metrica])

  const pico = serie.reduce((best, d) => (d.value > best.value ? d : best), { label: '—', value: 0 } as {
    label: string
    value: number
  })

  const totalGuias = rango?.total_guias ?? 0
  const totalJabas = rango?.total_jabas ?? 0
  const totalJarras = rango?.total_jarras ?? 0
  const totalViajes = viajes?.total ?? 0
  const conteoEstado = (k: string) => viajes?.por_estado.find((e) => e.estado === k)?.count ?? 0
  const recepcionados = conteoEstado('recepcionado')
  const noAnulados = totalViajes - conteoEstado('anulado')

  const segmentos = ESTADOS_VIAJE.map((e) => ({ ...e, value: conteoEstado(e.key) }))
  const otros = (viajes?.por_estado ?? []).filter((e) => !ESTADOS_VIAJE.some((x) => x.key === e.estado))
  if (otros.length) {
    segmentos.push({
      key: 'otros',
      label: 'Otros',
      color: 'var(--color-text-light)',
      value: otros.reduce((s, e) => s + e.count, 0),
    })
  }

  const filasDiario = diario?.filas ?? []
  const maxJarrasDiario = Math.max(1, ...filasDiario.map((f) => f.jarras))
  const presetActivo = hasta === today ? PRESETS.find((p) => addDays(today, -(p.dias - 1)) === desde)?.dias : undefined

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Reportes' }]} />
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight text-olive-950 sm:text-3xl">Reportes</h1>
          <p className="mt-1 text-sm text-muted">
            {formatFecha(desde)} – {formatFecha(hasta)} · {dias} {dias === 1 ? 'día' : 'días'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-line bg-sand-0 p-0.5">
            {PRESETS.map((p) => (
              <button
                key={p.dias}
                type="button"
                onClick={() => {
                  setHasta(today)
                  setDesde(addDays(today, -(p.dias - 1)))
                }}
                className={
                  presetActivo === p.dias
                    ? 'rounded-md bg-olive-100 px-2.5 py-1.5 text-xs font-medium text-olive-950'
                    : 'rounded-md px-2.5 py-1.5 text-xs font-medium text-muted hover:text-olive-900'
                }
              >
                {p.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-line bg-sand-0 px-3 py-1.5 text-sm">
            <span className="text-xs text-muted">Desde</span>
            <input
              type="date"
              value={desde}
              max={hasta}
              onChange={(e) => setDesde(e.target.value || desde)}
              className="bg-transparent text-sm text-olive-950 outline-none"
            />
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-line bg-sand-0 px-3 py-1.5 text-sm">
            <span className="text-xs text-muted">Hasta</span>
            <input
              type="date"
              value={hasta}
              min={desde}
              onChange={(e) => setHasta(e.target.value || hasta)}
              className="bg-transparent text-sm text-olive-950 outline-none"
            />
          </label>
          <Button
            variant="secondary"
            leftIcon={<RefreshCw className="size-3.5" />}
            onClick={() => setTick((n) => n + 1)}
            loading={loading}
          >
            Actualizar
          </Button>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => setTick((n) => n + 1)} />}
      {loading && !rango ? (
        <LoadingBlock label="Cargando reportes…" />
      ) : (
        <div className="space-y-4">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Guías"
              value={fmtNum(totalGuias)}
              hint={`${fmtNum(Math.round(totalGuias / dias))} por día en promedio`}
              icon={ClipboardList}
              tone="bg-info-soft text-info"
            />
            <MetricCard
              label="Jabas"
              value={fmtNum(totalJabas)}
              hint={totalGuias ? `${(totalJabas / totalGuias).toFixed(1)} por guía` : 'Sin guías'}
              icon={Package}
              tone="bg-success-soft text-success"
            />
            <MetricCard
              label="Jarras"
              value={fmtNum(totalJarras)}
              hint={totalGuias ? `${(totalJarras / totalGuias).toFixed(1)} por guía` : 'Sin guías'}
              icon={Boxes}
              tone="bg-olive-100 text-olive-800"
            />
            <MetricCard
              label="Viajes"
              value={fmtNum(totalViajes)}
              hint={
                viajes?.minutos_promedio_ciclo != null
                  ? `Ciclo promedio ${fmtNum(viajes.minutos_promedio_ciclo)} min`
                  : 'Sin ciclos completos'
              }
              icon={Truck}
              tone="bg-warn-soft text-warn"
              footer={
                <div>
                  <p className="mb-1 text-[11px] text-muted">Recepcionados en planta</p>
                  <ProgressBar value={recepcionados} max={noAnulados} tone="bg-success" />
                </div>
              }
            />
          </section>

          <Card padding="none">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
              <CardHeader
                title="Tendencia diaria"
                description={pico.value > 0 ? `Pico: ${pico.label} con ${fmtNum(pico.value)} ${metricaLabel}` : undefined}
              />
              <Segmented value={metrica} onChange={setMetrica} options={METRICAS} ariaLabel="Métrica" />
            </div>
            <div className="px-4 pt-5 pb-3">
              <ColumnChart data={serie} unit={metricaLabel} height={220} />
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <CardHeader title="Participación" description={`${metricaLabel[0].toUpperCase()}${metricaLabel.slice(1)} del período`} />
                <Segmented
                  value={agrupar}
                  onChange={setAgrupar}
                  ariaLabel="Agrupar por"
                  options={[
                    { value: 'fundo', label: 'Fundo' },
                    { value: 'modulo', label: 'Módulo' },
                    { value: 'turno', label: 'Turno' },
                  ]}
                />
              </div>
              <HBarList
                unit={metricaLabel}
                data={[...(rango?.por_grupo ?? [])]
                  .sort((a, b) => b[metrica] - a[metrica])
                  .map((g) => ({
                    label: g.label,
                    value: g[metrica],
                    meta: `${fmtNum(g.guias)} guías · ${fmtNum(g.jabas)} jabas · ${fmtNum(g.jarras)} jarras`,
                  }))}
              />
            </Card>

            <Card>
              <CardHeader
                title="Estado de viajes"
                description={
                  noAnulados
                    ? `${Math.round((recepcionados / noAnulados) * 100)}% de los viajes vigentes ya se recepcionó`
                    : 'Sin viajes en el período'
                }
              />
              <div className="mt-5">
                {totalViajes > 0 ? (
                  <StackedBar segments={segmentos} />
                ) : (
                  <p className="py-6 text-sm text-muted">Sin viajes en el período</p>
                )}
              </div>
              {viajes?.minutos_promedio_ciclo != null && (
                <div className="mt-5 flex items-center gap-3 rounded-lg bg-sand-50 px-3 py-2.5">
                  <Clock className="size-4 text-olive-700" aria-hidden />
                  <p className="text-xs text-muted">
                    Un viaje tarda en promedio{' '}
                    <span className="font-medium text-olive-950 tabular-nums">
                      {fmtNum(viajes.minutos_promedio_ciclo)} min
                    </span>{' '}
                    desde su creación hasta la recepción.
                  </p>
                </div>
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <Card>
              <CardHeader title="Vehículos" description="Viajes y recepcionados por placa" />
              <div className="mt-2 mb-4 flex items-center gap-4 text-[11px] text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-teal-800" /> Recepcionados
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-olive-300" /> Total viajes
                </span>
              </div>
              <HBarList
                unit="viajes"
                subLabel="recep."
                data={(vehiculos?.filas ?? []).map((v) => ({
                  label: v.placa,
                  value: v.viajes,
                  sub: v.recepcionados,
                }))}
              />
            </Card>

            <Card padding="none">
              <div className="border-b border-line px-4 py-3">
                <CardHeader
                  title={`Detalle del ${formatFecha(hasta)}`}
                  actions={
                    <div className="flex gap-3 text-xs text-muted tabular-nums">
                      <span>
                        <b className="font-medium text-olive-950">{fmtNum(diario?.total_guias ?? 0)}</b> guías
                      </span>
                      <span>
                        <b className="font-medium text-olive-950">{fmtNum(diario?.total_jabas ?? 0)}</b> jabas
                      </span>
                      <span>
                        <b className="font-medium text-olive-950">{fmtNum(diario?.total_jarras ?? 0)}</b> jarras
                      </span>
                    </div>
                  }
                />
              </div>
              {filasDiario.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">Sin despachos en esta fecha</p>
              ) : (
                <TableShell flush>
                  <Table>
                    <THead>
                      <Th>Fundo</Th>
                      <Th>Módulo</Th>
                      <Th>Turno</Th>
                      <Th align="right">Guías</Th>
                      <Th align="right">Jabas</Th>
                      <Th>Jarras</Th>
                    </THead>
                    <tbody>
                      {filasDiario.map((row, i) => (
                        <Tr key={`${row.fundo}-${row.modulo}-${row.turno}-${i}`}>
                          <Td>{row.fundo}</Td>
                          <Td>{row.modulo}</Td>
                          <Td>{row.turno}</Td>
                          <Td className="text-right tabular-nums">{fmtNum(row.guias)}</Td>
                          <Td className="text-right tabular-nums">{fmtNum(row.jabas)}</Td>
                          <Td>
                            <div className="flex min-w-[120px] items-center gap-2">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand-100">
                                <div
                                  className="h-full rounded-full bg-teal-800"
                                  style={{ width: `${(row.jarras / maxJarrasDiario) * 100}%` }}
                                />
                              </div>
                              <span className="w-12 text-right tabular-nums">{fmtNum(row.jarras)}</span>
                            </div>
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableShell>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
