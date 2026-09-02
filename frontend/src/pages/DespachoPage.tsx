import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Calendar, Clock } from 'lucide-react'
import { Card, CardHeader } from '../components/ui/Card'
import {
  Breadcrumbs,
  CollapsibleFilters,
  EmptyState,
  ErrorBanner,
  EstadoDespacho,
  FilterBar,
  LoadingBlock,
} from '../components/ui/Feedback'
import { Input, SearchInput, Select } from '../components/ui/Form'
import { listPage, isAbortError } from '../lib/api'
import { applyGuiaOnPage, pruneKnownGuias, sortGuiasByCodigoDesc } from '../lib/guiaLive'
import { LiveStatusBadge, useOnGuiaLive } from '../context/LiveEventsContext'
import { cn } from '../lib/utils'
import { useDebounce } from '../hooks/useDebounce'
import { Pagination } from '../components/ui/Table'
import type { GuiaFacets, GuiaIngreso, GuiaListPage } from '../types/api'

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

function parseBoolFilter(value: string): boolean | undefined {
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

const EMPTY_FACETS: GuiaFacets = {
  fundos: [],
  modulos: [],
  turnos: [],
  lotes: [],
  grupos: [],
  tipos_producto: [],
}

function formatFecha(iso: string) {
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
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

function formatHa(value: number | string) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
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

export function DespachoPage() {
  const [items, setItems] = useState<GuiaIngreso[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fecha, setFecha] = useState('')
  const [estado, setEstado] = useState('')
  const [q, setQ] = useState('')
  const debouncedQ = useDebounce(q)
  const [fundo, setFundo] = useState('')
  const [modulo, setModulo] = useState('')
  const [turno, setTurno] = useState('')
  const [lote, setLote] = useState('')
  const [grupo, setGrupo] = useState('')
  const [tipoProducto, setTipoProducto] = useState('')
  const [acopio, setAcopio] = useState('')
  const [planta, setPlanta] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [skip, setSkip] = useState(0)
  const [limit, setLimit] = useState(50)
  const [facets, setFacets] = useState<GuiaFacets>(EMPTY_FACETS)
  const knownRef = useRef(new Map<number, GuiaIngreso>())
  const filtersRef = useRef({
    fecha,
    estado,
    q: debouncedQ,
    acopio,
    planta,
    fundo,
    modulo,
    turno,
    lote,
    grupo,
    tipoProducto,
  })
  filtersRef.current = {
    fecha,
    estado,
    q: debouncedQ,
    acopio,
    planta,
    fundo,
    modulo,
    turno,
    lote,
    grupo,
    tipoProducto,
  }
  const pageRef = useRef({ skip, limit })
  pageRef.current = { skip, limit }
  const totalRef = useRef(total)
  totalRef.current = total

  function queryFilters() {
    const f = filtersRef.current
    return {
      fecha: f.fecha || undefined,
      estado: f.estado || undefined,
      q: f.q || undefined,
      recepcionado_acopio: parseBoolFilter(f.acopio),
      recepcionado_planta: parseBoolFilter(f.planta),
      fundo: f.fundo || undefined,
      modulo: f.modulo || undefined,
      turno: f.turno || undefined,
      lote: f.lote || undefined,
      grupo: f.grupo || undefined,
      tipo_producto: f.tipoProducto || undefined,
    }
  }

  async function load(signal?: AbortSignal) {
    setLoading(true)
    setError(null)
    const filters = queryFilters()
    try {
      const page = await listPage<GuiaIngreso>('/api/v1/guias-ingreso', {
        skip,
        limit,
        ...filters,
        signal,
      }) as GuiaListPage
      if (signal?.aborted) return
      const known = knownRef.current
      let nextItems = page.items
      let nextTotal = page.total
      for (const guia of known.values()) {
        const merged = applyGuiaOnPage(nextItems, nextTotal, guia, filters, { skip, limit })
        nextItems = merged.items
        nextTotal = merged.total
      }
      pruneKnownGuias(page.items, known)
      setItems(sortGuiasByCodigoDesc(nextItems))
      setTotal(nextTotal)
      setFacets(page.facets ?? EMPTY_FACETS)
      setSelectedId((current) => {
        if (current && nextItems.some((g) => g.id === current)) return current
        return nextItems[0]?.id ?? null
      })
    } catch (e) {
      if (isAbortError(e)) return
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los despachos')
      setItems([])
      setTotal(0)
      setFacets(EMPTY_FACETS)
      setSelectedId(null)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    setSkip(0)
  }, [fecha, estado, debouncedQ, acopio, planta, fundo, modulo, turno, lote, grupo, tipoProducto])

  useEffect(() => {
    const ac = new AbortController()
    void load(ac.signal)
    return () => ac.abort()
  }, [fecha, estado, debouncedQ, acopio, planta, fundo, modulo, turno, lote, grupo, tipoProducto, skip, limit])

  useOnGuiaLive((event) => {
    const guia = event.guia
    knownRef.current.set(guia.id, guia)
    const filters = queryFilters()
    const page = pageRef.current
    setItems((current) => {
      const merged = applyGuiaOnPage(current, totalRef.current, guia, filters, page)
      totalRef.current = merged.total
      setTotal(merged.total)
      return merged.items
    })
  })

  const fundos = facets.fundos
  const modulos = facets.modulos
  const turnos = facets.turnos
  const lotes = facets.lotes
  const grupos = facets.grupos
  const tiposProducto = facets.tipos_producto

  useEffect(() => {
    if (items.length === 0) {
      setSelectedId(null)
      return
    }
    if (!items.some((g) => g.id === selectedId)) {
      setSelectedId(items[0].id)
    }
  }, [items, selectedId])

  const selected = items.find((g) => g.id === selectedId) ?? null
  const hasActiveFilters = !!(
    fecha ||
    estado ||
    q ||
    fundo ||
    modulo ||
    turno ||
    lote ||
    grupo ||
    tipoProducto ||
    acopio ||
    planta
  )

  function clearFilters() {
    setFecha('')
    setEstado('')
    setQ('')
    setFundo('')
    setModulo('')
    setTurno('')
    setLote('')
    setGrupo('')
    setTipoProducto('')
    setAcopio('')
    setPlanta('')
  }

  const selectCls = 'min-w-[140px] flex-1'

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Despacho' }]} />
        <LiveStatusBadge className="mb-3" />
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <FilterBar hasActiveFilters={hasActiveFilters} onClear={clearFilters}>
        <div className="min-w-[150px]">
          <Input label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className={selectCls}>
          <Select
            label="Estado"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            placeholder="Todos"
            options={[
              { value: 'registrado', label: 'Registrado' },
              { value: 'anulado', label: 'Anulado' },
            ]}
          />
        </div>
        <div className={selectCls}>
          <Select
            label="Acopio"
            value={acopio}
            onChange={(e) => setAcopio(e.target.value)}
            placeholder="Todos"
            options={[
              { value: 'false', label: 'Pendiente' },
              { value: 'true', label: 'Recepcionado' },
            ]}
          />
        </div>
        <div className={selectCls}>
          <Select
            label="Planta"
            value={planta}
            onChange={(e) => setPlanta(e.target.value)}
            placeholder="Todos"
            options={[
              { value: 'false', label: 'Pendiente' },
              { value: 'true', label: 'Recepcionado' },
            ]}
          />
        </div>
        <div className="min-w-[180px] flex-[1.3]">
          <SearchInput
            label="Búsqueda"
            placeholder="Código, DNI, usuario, placa o lote…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <CollapsibleFilters label="Ubicación y producto">
          <div className={selectCls}>
            <Select
              label="Fundo"
              value={fundo}
              onChange={(e) => {
                setFundo(e.target.value)
                setModulo('')
                setTurno('')
                setLote('')
              }}
              placeholder="Todos"
              options={fundos.map((f) => ({ value: f, label: f }))}
            />
          </div>
          <div className={selectCls}>
            <Select
              label="Módulo"
              value={modulo}
              onChange={(e) => {
                setModulo(e.target.value)
                setTurno('')
                setLote('')
              }}
              placeholder="Todos"
              options={modulos.map((m) => ({ value: m, label: m }))}
            />
          </div>
          <div className={selectCls}>
            <Select
              label="Turno"
              value={turno}
              onChange={(e) => {
                setTurno(e.target.value)
                setLote('')
              }}
              placeholder="Todos"
              options={turnos.map((t) => ({ value: t, label: t }))}
            />
          </div>
          <div className={selectCls}>
            <Select
              label="Lote"
              value={lote}
              onChange={(e) => setLote(e.target.value)}
              placeholder="Todos"
              options={lotes.map((l) => ({ value: l, label: l }))}
            />
          </div>
          <div className={selectCls}>
            <Select
              label="Grupo"
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
              placeholder="Todos"
              options={grupos.map((g) => ({ value: g, label: g }))}
            />
          </div>
          <div className={selectCls}>
            <Select
              label="Tipo de producto"
              value={tipoProducto}
              onChange={(e) => setTipoProducto(e.target.value)}
              placeholder="Todos"
              options={tiposProducto.map((t) => ({ value: t, label: t }))}
            />
          </div>
        </CollapsibleFilters>
      </FilterBar>

      {loading ? (
        <LoadingBlock label="Cargando despachos…" />
      ) : items.length === 0 ? (
        <EmptyState
          title="Sin despachos"
          description={
            hasActiveFilters
              ? 'No hay guías de ingreso con los filtros actuales.'
              : 'Aún no hay guías de ingreso registradas.'
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Card padding="none" className="flex flex-col">
            <div className="border-b border-line px-4 py-3">
              <CardHeader
                title="Despachos recientes"
                description={`${total} registros`}
              />
            </div>
            <ul className="flex-1 divide-y divide-line overflow-y-auto">
              {items.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(g.id)}
                    className={cn(
                      'relative flex w-full flex-col gap-1 border-l-[3px] px-4 py-3 text-left transition-colors',
                      selected?.id === g.id
                        ? 'border-l-teal-800 bg-sage-100'
                        : 'border-l-transparent hover:bg-sand-50',
                    )}
                    aria-current={selected?.id === g.id ? 'true' : undefined}
                  >
                    <span
                      className={cn(
                        'tracking-wide',
                        selected?.id === g.id ? 'font-semibold text-olive-950' : 'font-medium text-olive-900',
                      )}
                    >
                      {g.codigo}
                    </span>
                    <span className="text-xs text-muted">
                      {formatFecha(g.fecha)} · {g.hora_envio}
                    </span>
                    <EstadoDespacho estado={g.estado} />
                    <span className="mt-0.5 flex flex-wrap gap-1">
                      <EstacionPill ok={!!g.recepcionado_acopio} label="Acopio" />
                      <EstacionPill ok={!!g.recepcionado_planta} label="Planta" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="border-t border-line px-3 py-2">
              <Pagination
                skip={skip}
                limit={limit}
                total={total}
                onChange={setSkip}
                onLimitChange={(next) => {
                  setLimit(next)
                  setSkip(0)
                }}
                limitOptions={[20, 50, 100]}
              />
            </div>
          </Card>

          <Card padding="none">
            {!selected ? (
              <div className="p-6">
                <p className="text-sm text-muted">Seleccione un despacho de la lista.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <h2 className="font-display text-lg font-medium text-olive-950">Detalle de despacho</h2>
                    <EstadoDespacho estado={selected.estado} />
                    <EstacionPill ok={!!selected.recepcionado_acopio} label="Acopio" />
                    <EstacionPill ok={!!selected.recepcionado_planta} label="Planta" />
                  </div>
                  <p className="font-medium tracking-wide text-olive-800">{selected.codigo}</p>
                </div>

                <div className="space-y-6 px-5 py-5">
                  <section>
                    <SectionTitle>Información general</SectionTitle>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <Field label="Código" value={selected.codigo} />
                      <Field
                        label="Fecha"
                        value={formatFecha(selected.fecha)}
                        icon={<Calendar className="size-3.5 text-muted" />}
                      />
                      <Field
                        label="Hora de envío"
                        value={selected.hora_envio}
                        icon={<Clock className="size-3.5 text-muted" />}
                      />
                      <Field label="Usuario (DNI)" value={selected.usuario_dni} />
                      <Field label="Usuario" value={selected.usuario_nombre} />
                      <Field label="Grupo" value={selected.grupo || '—'} />
                      <Field label="Fundo" value={selected.fundo || '—'} />
                      <Field label="Módulo" value={selected.modulo} />
                      <Field label="Turno" value={selected.turno} />
                      <Field label="Lote" value={selected.lote} />
                    </div>
                  </section>

                  <section>
                    <SectionTitle>Producto y envases</SectionTitle>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label="Tipo de producto" value={selected.tipo_producto} />
                      <Field label="Tipo de llenado" value={selected.tipo_llenado} />
                      <Field label="Envase principal" value={selected.envase_principal} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <StatBox label="Jabas completas" value={selected.jabas_completas} />
                      <StatBox label="Jabas incompletas" value={selected.jabas_incompletas} />
                      <StatBox label="Jarras / jabas" value={selected.jarras_jabas} />
                      <StatBox label="Jarras extras" value={selected.jarras_extras} />
                    </div>
                  </section>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <section>
                      <SectionTitle>Totales</SectionTitle>
                      <div className="grid grid-cols-3 gap-2">
                        <StatBox label="Jabas totales" value={selected.jabas_totales} />
                        <StatBox label="Jarras totales" value={selected.jarras_totales} />
                        <StatBox label="HA (lote)" value={formatHa(selected.ha)} />
                      </div>
                    </section>
                    <section>
                      <SectionTitle>Transporte</SectionTitle>
                      <div className="rounded-lg border border-line bg-sand-50 px-3 py-2.5">
                        <p className="text-[11px] text-muted">Placa</p>
                        <p className="mt-0.5 font-medium tracking-wide text-olive-950">{selected.placa || '—'}</p>
                      </div>
                    </section>
                  </div>

                  <section>
                    <SectionTitle>Observaciones</SectionTitle>
                    <p className="rounded-lg border border-line bg-sand-50 px-3 py-2.5 text-sm text-olive-900">
                      {selected.observacion?.trim() ? selected.observacion : 'Sin observaciones'}
                    </p>
                  </section>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-sand-50 px-5 py-3 text-xs text-muted">
                  <span>
                    Estado: <span className="font-medium text-olive-900 capitalize">{selected.estado}</span>
                    {selected.recepcionado_acopio_at
                      ? ` · Acopio ${formatDateTime(selected.recepcionado_acopio_at)}`
                      : ''}
                    {selected.recepcionado_planta_at
                      ? ` · Planta ${formatDateTime(selected.recepcionado_planta_at)}`
                      : ''}
                  </span>
                  <span>
                    Registrado por {selected.usuario_nombre} · {formatDateTime(selected.created_at)}
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
