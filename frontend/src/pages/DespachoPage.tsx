import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Calendar, Clock, Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ExportExcelButton } from '../components/ui/ExportExcelButton'
import { Breadcrumbs, EmptyState, ErrorBanner, EstadoDespacho, LoadingBlock } from '../components/ui/Feedback'
import { Select } from '../components/ui/Form'
import { Drawer } from '../components/ui/Overlay'
import { useToast } from '../context/ToastContext'
import { listAllPages, listPage, isAbortError } from '../lib/api'
import { downloadExcel, stampFile } from '../lib/excel'
import { GUIA_EXCEL_HEADERS, guiaExcelRow } from '../lib/excelRows'
import { applyGuiaOnPage, pruneKnownGuias, sortGuiasByCodigoDesc } from '../lib/guiaLive'
import { useOnGuiaLive, useOnLiveResync } from '../context/LiveEventsContext'
import { cn, fmtNum } from '../lib/utils'
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

/** Avance de la guía: registro → acopio → planta (3 segmentos). */
function Avance({ guia }: { guia: GuiaIngreso }) {
  const anulada = guia.estado === 'anulado'
  const pasos = [true, !!guia.recepcionado_acopio, !!guia.recepcionado_planta]
  const etiqueta = anulada
    ? 'Anulada'
    : guia.recepcionado_planta
      ? 'En planta'
      : guia.recepcionado_acopio
        ? 'En camino'
        : 'Pend. acopio'
  return (
    <span className="flex items-center gap-2" title="Registro → Acopio → Planta">
      <span className="flex gap-0.5" aria-hidden>
        {pasos.map((ok, i) => (
          <span
            key={i}
            className={cn('h-1.5 w-4 rounded-full', anulada ? 'bg-danger/40' : ok ? 'bg-success' : 'bg-sand-100')}
          />
        ))}
      </span>
      <span className={cn('text-[11px] font-medium', anulada ? 'text-danger' : 'text-muted')}>{etiqueta}</span>
    </span>
  )
}

type Etapa = 'todas' | 'pend_acopio' | 'en_camino' | 'planta' | 'anuladas'

const ETAPAS: Array<{ id: Etapa; label: string; estado: string; acopio: string; planta: string }> = [
  { id: 'todas', label: 'Todas', estado: '', acopio: '', planta: '' },
  { id: 'pend_acopio', label: 'Pendiente acopio', estado: 'registrado', acopio: 'false', planta: '' },
  { id: 'en_camino', label: 'En camino a planta', estado: 'registrado', acopio: 'true', planta: 'false' },
  { id: 'planta', label: 'En planta', estado: '', acopio: '', planta: 'true' },
  { id: 'anuladas', label: 'Anuladas', estado: 'anulado', acopio: '', planta: '' },
]

function toIsoDate(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function etiquetaDia(iso: string, hoy: string) {
  const [y, m, d] = hoy.split('-').map(Number)
  const ayer = toIsoDate(new Date(y, m - 1, d - 1))
  if (iso === hoy) return 'Hoy'
  if (iso === ayer) return 'Ayer'
  const dt = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(dt.getTime())) return iso
  return dt.toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'short' })
}

function FiltroChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-sand-0 py-0.5 pr-1 pl-2.5 text-xs text-olive-900">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 text-muted hover:bg-olive-100 hover:text-olive-950"
        aria-label={`Quitar filtro ${label}`}
      >
        <X className="size-3" />
      </button>
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

function joinLine(parts: Array<string | null | undefined>) {
  const text = parts.map((p) => (p ?? '').trim()).filter(Boolean).join(' · ')
  return text || null
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
  const toast = useToast()
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

  useOnLiveResync(() => {
    void load()
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
  const hoy = toIsoDate()
  const [filtrosOpen, setFiltrosOpen] = useState(false)

  const etapa: Etapa | null =
    ETAPAS.find((e) => e.estado === estado && e.acopio === acopio && e.planta === planta)?.id ?? null
  function setEtapa(id: Etapa) {
    const e = ETAPAS.find((x) => x.id === id)!
    setEstado(e.estado)
    setAcopio(e.acopio)
    setPlanta(e.planta)
  }

  // Filtros del panel lateral (ubicación y producción), con su chip removible.
  const filtrosPanel = [
    { key: 'fundo', label: `Fundo: ${fundo}`, active: !!fundo, clear: () => { setFundo(''); setModulo(''); setTurno(''); setLote('') } },
    { key: 'modulo', label: `Módulo: ${modulo}`, active: !!modulo, clear: () => { setModulo(''); setTurno(''); setLote('') } },
    { key: 'turno', label: `Turno: ${turno}`, active: !!turno, clear: () => { setTurno(''); setLote('') } },
    { key: 'lote', label: `Lote: ${lote}`, active: !!lote, clear: () => setLote('') },
    { key: 'grupo', label: `Grupo: ${grupo}`, active: !!grupo, clear: () => setGrupo('') },
    { key: 'producto', label: `Producto: ${tipoProducto}`, active: !!tipoProducto, clear: () => setTipoProducto('') },
  ].filter((f) => f.active)

  const hasActiveFilters = !!(fecha || q || etapa !== 'todas' || filtrosPanel.length)

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

  async function exportarExcel() {
    try {
      const rows = await listAllPages<GuiaIngreso>('/api/v1/guias-ingreso', queryFilters())
      if (!rows.length) {
        toast.warning('No hay guías para exportar con los filtros actuales')
        return
      }
      downloadExcel(stampFile('despacho'), [
        { name: 'Despacho', headers: GUIA_EXCEL_HEADERS, rows: rows.map(guiaExcelRow) },
      ])
      toast.success(`Se exportaron ${rows.length} ${rows.length === 1 ? 'guía' : 'guías'}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo exportar a Excel')
    }
  }

  const grupos_dia = useMemo(() => {
    const out: Array<{ fecha: string; items: GuiaIngreso[]; jarras: number }> = []
    for (const g of items) {
      const last = out[out.length - 1]
      if (last && last.fecha === g.fecha) {
        last.items.push(g)
        last.jarras += g.jarras_totales
      } else {
        out.push({ fecha: g.fecha, items: [g], jarras: g.jarras_totales })
      }
    }
    return out
  }, [items])

  const primeraCarga = loading && items.length === 0 && !error

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Despacho' }]} />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight text-olive-950 sm:text-3xl">Despacho</h1>
          <p className="mt-1 text-sm text-muted">
            {fmtNum(total)} {total === 1 ? 'guía' : 'guías'}
            {hasActiveFilters ? ' con los filtros actuales' : ' registradas'}
          </p>
        </div>
        <ExportExcelButton onExport={exportarExcel} disabled={total === 0} />
      </div>

      {error && <ErrorBanner message={error} onRetry={() => void load()} />}

      <Card padding="sm" className="mb-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative flex h-10 min-w-0 flex-1 items-center">
            <Search className="pointer-events-none absolute left-3 size-4 text-text-light" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por código, DNI, usuario, placa, módulo o lote…"
              aria-label="Buscar despachos"
              className="h-10 w-full rounded-lg border border-line bg-sand-0 pr-3 pl-9 text-sm text-olive-950 outline-none placeholder:text-text-light focus:border-teal-800 focus:ring-2 focus:ring-teal-800/15"
            />
          </label>
          <div className="flex items-center gap-2">
            <div className="flex h-10 items-center rounded-lg border border-line bg-sand-0">
              <button
                type="button"
                onClick={() => setFecha(fecha === hoy ? '' : hoy)}
                className={cn(
                  'h-full rounded-l-lg px-3 text-xs font-medium transition',
                  fecha === hoy ? 'bg-olive-100 text-olive-950' : 'text-muted hover:text-olive-900',
                )}
                aria-pressed={fecha === hoy}
              >
                Hoy
              </button>
              <span className="h-5 w-px bg-line" aria-hidden />
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                aria-label="Fecha"
                className="h-full bg-transparent px-2 text-sm text-olive-950 outline-none"
              />
            </div>
            <Button
              variant="secondary"
              leftIcon={<SlidersHorizontal className="size-3.5" />}
              onClick={() => setFiltrosOpen(true)}
            >
              Filtros
              {filtrosPanel.length > 0 && (
                <span className="ml-1 rounded-full bg-teal-800 px-1.5 text-[10px] font-semibold text-white tabular-nums">
                  {filtrosPanel.length}
                </span>
              )}
            </Button>
          </div>
        </div>

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 scrollbar-none" role="radiogroup" aria-label="Etapa">
          {ETAPAS.map((e) => (
            <button
              key={e.id}
              type="button"
              role="radio"
              aria-checked={etapa === e.id}
              onClick={() => setEtapa(e.id)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition',
                etapa === e.id
                  ? 'border-teal-800 bg-teal-800 text-white'
                  : 'border-line bg-sand-0 text-muted hover:border-olive-300 hover:text-olive-900',
              )}
            >
              {e.label}
            </button>
          ))}
        </div>

        {(fecha || q || filtrosPanel.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
            {fecha && <FiltroChip label={`Fecha: ${fecha === hoy ? 'Hoy' : formatFecha(fecha)}`} onRemove={() => setFecha('')} />}
            {q && <FiltroChip label={`“${q}”`} onRemove={() => setQ('')} />}
            {filtrosPanel.map((f) => (
              <FiltroChip key={f.key} label={f.label} onRemove={f.clear} />
            ))}
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} className="ml-1 text-xs font-medium text-teal-800 hover:underline">
                Limpiar todo
              </button>
            )}
          </div>
        )}
      </Card>

      <Drawer open={filtrosOpen} onClose={() => setFiltrosOpen(false)} title="Filtros">
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wide text-olive-800 uppercase">Ubicación</h3>
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
            <div className="grid grid-cols-3 gap-2">
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
              <Select
                label="Lote"
                value={lote}
                onChange={(e) => setLote(e.target.value)}
                placeholder="Todos"
                options={lotes.map((l) => ({ value: l, label: l }))}
              />
            </div>
          </section>
          <section className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wide text-olive-800 uppercase">Producción</h3>
            <Select
              label="Grupo"
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
              placeholder="Todos"
              options={grupos.map((g) => ({ value: g, label: g }))}
            />
            <Select
              label="Tipo de producto"
              value={tipoProducto}
              onChange={(e) => setTipoProducto(e.target.value)}
              placeholder="Todos"
              options={tiposProducto.map((t) => ({ value: t, label: t }))}
            />
          </section>
          <p className="text-xs text-muted">Las opciones se ajustan a la fecha, la etapa y la búsqueda actuales.</p>
          <div className="flex gap-2 border-t border-line pt-4">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => filtrosPanel.forEach((f) => f.clear())}
              disabled={filtrosPanel.length === 0}
            >
              Limpiar
            </Button>
            <Button className="flex-1" onClick={() => setFiltrosOpen(false)}>
              Ver {fmtNum(total)} {total === 1 ? 'guía' : 'guías'}
            </Button>
          </div>
        </div>
      </Drawer>

      {primeraCarga ? (
        <LoadingBlock label="Cargando despachos…" />
      ) : items.length === 0 && !loading ? (
        <EmptyState
          title="Sin despachos"
          description={
            hasActiveFilters
              ? 'No hay guías de ingreso con los filtros actuales.'
              : 'Aún no hay guías de ingreso registradas.'
          }
          action={
            hasActiveFilters ? (
              <Button variant="secondary" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
          <Card padding="none" className="relative flex flex-col overflow-hidden lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
            {loading && (
              <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-olive-100" aria-hidden>
                <div className="h-full w-1/3 animate-pulse bg-teal-800" />
              </div>
            )}
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
              <h2 className="font-display text-lg font-medium text-olive-950">Despachos recientes</h2>
              <span className="text-xs text-muted tabular-nums">
                {fmtNum(Math.min(skip + 1, total))}–{fmtNum(Math.min(skip + items.length, total))} de {fmtNum(total)}
              </span>
            </div>
            <div className={cn('min-h-0 flex-1 overflow-y-auto transition-opacity', loading && 'opacity-60')}>
              {grupos_dia.map((grupoDia) => (
                <section key={grupoDia.fecha}>
                  <div className="sticky top-0 z-[1] flex items-center justify-between border-b border-line bg-sand-50/95 px-4 py-1.5 backdrop-blur">
                    <span className="text-[11px] font-semibold tracking-wide text-olive-800 uppercase first-letter:uppercase">
                      {etiquetaDia(grupoDia.fecha, hoy)}
                    </span>
                    <span className="text-[11px] text-muted tabular-nums">
                      {grupoDia.items.length} · {fmtNum(grupoDia.jarras)} jarras
                    </span>
                  </div>
                  <ul className="divide-y divide-line">
                    {grupoDia.items.map((g) => {
                      const activo = selected?.id === g.id
                      const ubicacion = joinLine([g.fundo, g.modulo, g.turno, g.lote])
                      return (
                        <li key={g.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(g.id)}
                            className={cn(
                              'flex w-full flex-col gap-1.5 border-l-[3px] px-4 py-2.5 text-left transition-colors',
                              activo ? 'border-l-teal-800 bg-sage-100' : 'border-l-transparent hover:bg-sand-50',
                            )}
                            aria-current={activo ? 'true' : undefined}
                          >
                            <span className="flex items-baseline justify-between gap-2">
                              <span
                                className={cn(
                                  'truncate text-sm tracking-wide',
                                  activo ? 'font-semibold text-olive-950' : 'font-medium text-olive-900',
                                )}
                              >
                                {g.codigo}
                              </span>
                              <span className="shrink-0 text-xs text-muted tabular-nums">{g.hora_envio}</span>
                            </span>
                            {ubicacion && <span className="truncate text-xs text-muted">{ubicacion}</span>}
                            <span className="flex items-center justify-between gap-2">
                              <Avance guia={g} />
                              <span className="text-xs text-olive-900 tabular-nums">
                                {fmtNum(g.jarras_totales)} <span className="text-muted">jarras</span>
                              </span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
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
                        <StatBox label="HA trabajadas" value={formatHa(selected.ha)} />
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
