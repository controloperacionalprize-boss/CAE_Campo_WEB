import { useEffect, useState } from 'react'
import { Card, CardHeader } from '../components/ui/Card'
import { Breadcrumbs, ErrorBanner, LoadingBlock } from '../components/ui/Feedback'
import { Select } from '../components/ui/Form'
import { Table, TableShell, THead, Th, Td, Tr } from '../components/ui/Table'
import { apiGet, isAbortError } from '../lib/api'
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

function fmt(n: number) {
  return n.toLocaleString('es-PE')
}

export function ReportesPage() {
  const today = toIsoDate()
  const [desde, setDesde] = useState(addDays(today, -14))
  const [hasta, setHasta] = useState(today)
  const [agrupar, setAgrupar] = useState('fundo')
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

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Reportes' }]} />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-2xl font-medium tracking-tight text-olive-950 sm:text-3xl">Reportes</h1>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-line bg-sand-0 px-3 py-2 text-sm">
            <span className="text-xs text-muted">Desde</span>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value || desde)}
              className="bg-transparent text-sm text-olive-950 outline-none"
            />
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-line bg-sand-0 px-3 py-2 text-sm">
            <span className="text-xs text-muted">Hasta</span>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value || hasta)}
              className="bg-transparent text-sm text-olive-950 outline-none"
            />
          </label>
          <div className="w-[160px]">
            <Select
              label="Agrupar"
              value={agrupar}
              onChange={(e) => setAgrupar(e.target.value)}
              options={[
                { value: 'fundo', label: 'Fundo' },
                { value: 'modulo', label: 'Módulo' },
                { value: 'turno', label: 'Turno' },
              ]}
            />
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => setTick((n) => n + 1)} />}
      {loading ? (
        <LoadingBlock label="Cargando reportes…" />
      ) : (
        <div className="space-y-4">
          <Card padding="none">
            <div className="border-b border-line px-4 py-3">
              <CardHeader
                title={`Diario ${formatFecha(hasta)}`}
                description={
                  diario
                    ? `${fmt(diario.total_guias)} guías · ${fmt(diario.total_jabas)} jabas · ${fmt(diario.total_jarras)} jarras`
                    : undefined
                }
              />
            </div>
            <TableShell flush>
              <Table>
                <THead>
                  <Th>Fundo</Th>
                  <Th>Módulo</Th>
                  <Th>Turno</Th>
                  <Th align="right">Guías</Th>
                  <Th align="right">Jabas</Th>
                  <Th align="right">Jarras</Th>
                </THead>
                <tbody>
                  {(diario?.filas ?? []).map((row, i) => (
                    <Tr key={`${row.fundo}-${row.modulo}-${row.turno}-${i}`}>
                      <Td>{row.fundo}</Td>
                      <Td>{row.modulo}</Td>
                      <Td>{row.turno}</Td>
                      <Td className="text-right tabular-nums">{fmt(row.guias)}</Td>
                      <Td className="text-right tabular-nums">{fmt(row.jabas)}</Td>
                      <Td className="text-right tabular-nums">{fmt(row.jarras)}</Td>
                    </Tr>
                  ))}
                  {(diario?.filas ?? []).length === 0 && (
                    <Tr>
                      <Td className="text-muted">Sin despachos en esta fecha</Td>
                      <Td />
                      <Td />
                      <Td />
                      <Td />
                      <Td />
                    </Tr>
                  )}
                </tbody>
              </Table>
            </TableShell>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card padding="none">
              <div className="border-b border-line px-4 py-3">
                <CardHeader
                  title="Tendencia del rango"
                  description={`${fmt(rango?.total_guias ?? 0)} guías en el período`}
                />
              </div>
              <TableShell flush>
                <Table>
                  <THead>
                    <Th>Fecha</Th>
                    <Th align="right">Guías</Th>
                    <Th align="right">Jabas</Th>
                    <Th align="right">Jarras</Th>
                  </THead>
                  <tbody>
                    {(rango?.por_fecha ?? []).map((row) => (
                      <Tr key={row.fecha}>
                        <Td>{formatFecha(row.fecha)}</Td>
                        <Td className="text-right tabular-nums">{fmt(row.guias)}</Td>
                        <Td className="text-right tabular-nums">{fmt(row.jabas)}</Td>
                        <Td className="text-right tabular-nums">{fmt(row.jarras)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableShell>
            </Card>

            <Card padding="none">
              <div className="border-b border-line px-4 py-3">
                <CardHeader title={`Por ${agrupar}`} description="Totales del rango" />
              </div>
              <TableShell flush>
                <Table>
                  <THead>
                    <Th>Grupo</Th>
                    <Th align="right">Guías</Th>
                    <Th align="right">Jabas</Th>
                    <Th align="right">Jarras</Th>
                  </THead>
                  <tbody>
                    {(rango?.por_grupo ?? []).map((row) => (
                      <Tr key={row.label}>
                        <Td>{row.label}</Td>
                        <Td className="text-right tabular-nums">{fmt(row.guias)}</Td>
                        <Td className="text-right tabular-nums">{fmt(row.jabas)}</Td>
                        <Td className="text-right tabular-nums">{fmt(row.jarras)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableShell>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card padding="none">
              <div className="border-b border-line px-4 py-3">
                <CardHeader
                  title="Viajes"
                  description={
                    viajes?.minutos_promedio_ciclo != null
                      ? `${fmt(viajes.total)} viajes · ciclo promedio ${viajes.minutos_promedio_ciclo} min`
                      : `${fmt(viajes?.total ?? 0)} viajes`
                  }
                />
              </div>
              <TableShell flush>
                <Table>
                  <THead>
                    <Th>Estado</Th>
                    <Th align="right">Cantidad</Th>
                  </THead>
                  <tbody>
                    {(viajes?.por_estado ?? []).map((row) => (
                      <Tr key={row.estado}>
                        <Td className="capitalize">{row.estado.replace('_', ' ')}</Td>
                        <Td className="text-right tabular-nums">{fmt(row.count)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableShell>
            </Card>

            <Card padding="none">
              <div className="border-b border-line px-4 py-3">
                <CardHeader title="Vehículos" description={`${fmt(vehiculos?.total_viajes ?? 0)} viajes`} />
              </div>
              <TableShell flush>
                <Table>
                  <THead>
                    <Th>Placa</Th>
                    <Th align="right">Viajes</Th>
                    <Th align="right">Recepcionados</Th>
                  </THead>
                  <tbody>
                    {(vehiculos?.filas ?? []).map((row) => (
                      <Tr key={row.placa}>
                        <Td className="tracking-wide">{row.placa}</Td>
                        <Td className="text-right tabular-nums">{fmt(row.viajes)}</Td>
                        <Td className="text-right tabular-nums">{fmt(row.recepcionados)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableShell>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
