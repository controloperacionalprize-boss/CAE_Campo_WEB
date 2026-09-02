import { useEffect, useMemo, useState } from 'react'
import { Clock, LandPlot, LayoutGrid, MapPinned, Plus } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { SearchInput, Select, Switch } from '../components/ui/Form'
import {
  Breadcrumbs,
  EmptyState,
  ErrorBanner,
  FilterBar,
  SkeletonRows,
  StatusPill,
} from '../components/ui/Feedback'
import { Card, CardHeader } from '../components/ui/Card'
import { EditButton, ViewButton } from '../components/ui/TableActions'
import { Pagination, Table, TableShell, THead, Th, Td, TdTruncate, Tr } from '../components/ui/Table'
import {
  FundoFormDrawer,
  LoteFormDrawer,
  ModuloFormDrawer,
  TurnoFormDrawer,
  type FundoForm,
  type LoteForm,
  type ModuloForm,
  type TurnoForm,
} from '../components/ubicaciones/UbicacionForms'
import { apiGet, isAbortError, listPage } from '../lib/api'
import { buildTurnoContextMap, eligibleTurnoIds, labelCodigo, labelCodigoTitle, type TurnoContext } from '../lib/ubicacionesLookups'
import { paginate } from '../lib/utils'
import { useDebounce } from '../hooks/useDebounce'
import { useTabParam } from '../hooks/useTabParam'
import { useToast } from '../context/ToastContext'
import type { EmpresaNodo, FundoNodo, Lote, ModuloNodo, TurnoNodo } from '../types/api'

const TAB_IDS = ['fundos', 'modulos', 'turnos', 'lotes'] as const
type TabId = (typeof TAB_IDS)[number]

const TAB_LABELS: Record<TabId, string> = {
  fundos: 'Fundos',
  modulos: 'Módulos',
  turnos: 'Turnos',
  lotes: 'Lotes',
}

const VIEW_ICON = {
  fundos: LandPlot,
  modulos: LayoutGrid,
  turnos: Clock,
  lotes: MapPinned,
} as const

const SEARCH_PLACEHOLDER: Record<TabId, string> = {
  fundos: 'Buscar fundo…',
  modulos: 'Buscar módulo…',
  turnos: 'Buscar turno…',
  lotes: 'Buscar lote…',
}

type Row =
  | { kind: 'fundo'; empresaId: number; empresaNombre: string; data: FundoNodo }
  | {
      kind: 'modulo'
      fundoId: number
      empresaId: number
      empresaNombre: string
      fundoNombre: string
      data: ModuloNodo
    }
  | {
      kind: 'turno'
      moduloId: number
      fundoId: number
      empresaId: number
      empresaNombre: string
      fundoNombre: string
      moduloCodigo: string
      moduloNombre: string | null
      data: TurnoNodo
    }

type LoteRow = Lote & { ctx: TurnoContext }

export function UbicacionesPage() {
  const toast = useToast()
  const [tab] = useTabParam('fundos', [...TAB_IDS])
  const view = tab as TabId
  const label = TAB_LABELS[view] ?? 'Fundos'

  const [arbol, setArbol] = useState<EmpresaNodo[]>([])
  const [empresaId, setEmpresaId] = useState('')
  const [fundoId, setFundoId] = useState('')
  const [moduloId, setModuloId] = useState('')
  const [turnoId, setTurnoId] = useState('')
  const [q, setQ] = useState('')
  const debouncedQ = useDebounce(q)
  const [soloActivos, setSoloActivos] = useState(true)
  const [skip, setSkip] = useState(0)
  const [limit, setLimit] = useState(15)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fundoForm, setFundoForm] = useState<FundoForm | null>(null)
  const [moduloForm, setModuloForm] = useState<ModuloForm | null>(null)
  const [turnoForm, setTurnoForm] = useState<TurnoForm | null>(null)
  const [loteForm, setLoteForm] = useState<LoteForm | null>(null)

  const [lotes, setLotes] = useState<LoteRow[]>([])
  const [lotesTotal, setLotesTotal] = useState(0)
  const [lotesLoading, setLotesLoading] = useState(false)

  const turnoContextMap = useMemo(() => buildTurnoContextMap(arbol), [arbol])

  const hasActiveFilters =
    !!empresaId || !!fundoId || !!moduloId || !!turnoId || !!q || !soloActivos

  function clearFilters() {
    setEmpresaId('')
    setFundoId('')
    setModuloId('')
    setTurnoId('')
    setQ('')
    setSoloActivos(true)
    setSkip(0)
  }

  async function loadArbol(signal?: AbortSignal) {
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet<EmpresaNodo[]>('/api/v1/arbol/ubicaciones', {
        incluir_inactivos: !soloActivos,
      }, signal)
      if (signal?.aborted) return
      setArbol(data)
    } catch (e) {
      if (isAbortError(e)) return
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos')
      setArbol([])
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  async function loadLotes(signal?: AbortSignal) {
    setLotesLoading(true)
    setError(null)
    try {
      const parentFilter = !!(empresaId || fundoId || moduloId)
      const params = {
        incluirInactivos: !soloActivos,
        q: debouncedQ || undefined,
        signal,
      }

      if (turnoId) {
        const page = await listPage<Lote>('/api/v1/lotes', { ...params, turno_id: turnoId, skip, limit })
        if (signal?.aborted) return
        const rows: LoteRow[] = page.items
          .map((l) => {
            const ctx = turnoContextMap.get(l.turno_id)
            return ctx ? { ...l, ctx } : null
          })
          .filter((r): r is LoteRow => r != null)
        setLotes(rows)
        setLotesTotal(page.total)
      } else if (!parentFilter) {
        const page = await listPage<Lote>('/api/v1/lotes', { ...params, skip, limit })
        if (signal?.aborted) return
        const rows: LoteRow[] = page.items
          .map((l) => {
            const ctx = turnoContextMap.get(l.turno_id)
            return ctx ? { ...l, ctx } : null
          })
          .filter((r): r is LoteRow => r != null)
        setLotes(rows)
        setLotesTotal(page.total)
      } else {
        const allowed = eligibleTurnoIds(arbol, { empresaId, fundoId, moduloId, turnoId })
        if (!allowed.length) {
          setLotes([])
          setLotesTotal(0)
          return
        }
        const page = await listPage<Lote>('/api/v1/lotes', {
          ...params,
          turno_ids: allowed,
          skip,
          limit,
        })
        if (signal?.aborted) return
        const rows: LoteRow[] = page.items
          .map((l) => {
            const ctx = turnoContextMap.get(l.turno_id)
            return ctx ? { ...l, ctx } : null
          })
          .filter((r): r is LoteRow => r != null)
        setLotes(rows)
        setLotesTotal(page.total)
      }
    } catch (e) {
      if (isAbortError(e)) return
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los lotes')
      setLotes([])
      setLotesTotal(0)
    } finally {
      if (!signal?.aborted) setLotesLoading(false)
    }
  }

  useEffect(() => {
    const ac = new AbortController()
    void loadArbol(ac.signal)
    return () => ac.abort()
  }, [soloActivos])

  useEffect(() => {
    if (view !== 'lotes') return
    const ac = new AbortController()
    void loadLotes(ac.signal)
    return () => ac.abort()
  }, [view, skip, limit, debouncedQ, empresaId, fundoId, moduloId, turnoId, arbol])

  useEffect(() => {
    setSkip(0)
    if (view === 'fundos') {
      setModuloId('')
      setTurnoId('')
    } else if (view === 'modulos') {
      setTurnoId('')
    }
  }, [view])

  const empresasOpts = arbol.map((e) => ({ value: e.id, label: e.razon_social }))

  const fundosOpts = useMemo(
    () =>
      arbol.flatMap((e) =>
        (!empresaId || e.id === Number(empresaId) ? e.fundos : []).map((f) => ({
          value: f.id,
          label: f.nombre,
        })),
      ),
    [arbol, empresaId],
  )

  const modulosOpts = useMemo(
    () =>
      arbol.flatMap((e) => {
        if (empresaId && e.id !== Number(empresaId)) return []
        return e.fundos.flatMap((f) => {
          if (fundoId && f.id !== Number(fundoId)) return []
          return f.modulos.map((m) => ({
            value: m.id,
            label: `${m.codigo} (${f.nombre})`,
          }))
        })
      }),
    [arbol, empresaId, fundoId],
  )

  const turnosOpts = useMemo(
    () =>
      arbol.flatMap((e) => {
        if (empresaId && e.id !== Number(empresaId)) return []
        return e.fundos.flatMap((f) => {
          if (fundoId && f.id !== Number(fundoId)) return []
          return f.modulos.flatMap((m) => {
            if (moduloId && m.id !== Number(moduloId)) return []
            return m.turnos.map((t) => ({
              value: t.id,
              label: `${t.codigo} (${m.codigo})`,
            }))
          })
        })
      }),
    [arbol, empresaId, fundoId, moduloId],
  )

  const allFundosFlat = useMemo(
    () => arbol.flatMap((e) => e.fundos.map((f) => ({ id: f.id, nombre: f.nombre, empresaId: e.id }))),
    [arbol],
  )

  const allModulosFlat = useMemo(
    () =>
      arbol.flatMap((e) =>
        e.fundos.flatMap((f) =>
          f.modulos.map((m) => ({
            id: m.id,
            codigo: m.codigo,
            nombre: m.nombre,
            fundoNombre: f.nombre,
          })),
        ),
      ),
    [arbol],
  )

  const allTurnosFlat = useMemo(
    () =>
      arbol.flatMap((e) =>
        e.fundos.flatMap((f) =>
          f.modulos.flatMap((m) =>
            m.turnos.map((t) => ({
              id: t.id,
              codigo: t.codigo,
              nombre: t.nombre,
              moduloCodigo: m.codigo,
            })),
          ),
        ),
      ),
    [arbol],
  )

  const allRows = useMemo(() => {
    const qn = debouncedQ.trim().toLowerCase()
    const list: Row[] = []
    for (const e of arbol) {
      if (empresaId && e.id !== Number(empresaId)) continue
      for (const f of e.fundos) {
        if (fundoId && f.id !== Number(fundoId)) continue

        if (view === 'fundos' || view === 'modulos' || view === 'turnos') {
          const fundoHit =
            !qn ||
            f.nombre.toLowerCase().includes(qn) ||
            e.razon_social.toLowerCase().includes(qn) ||
            (view === 'fundos' && (f.domicilio ?? '').toLowerCase().includes(qn))

          if (view === 'fundos' && fundoHit) {
            list.push({ kind: 'fundo', empresaId: e.id, empresaNombre: e.razon_social, data: f })
          }
        }

        for (const m of f.modulos) {
          if (moduloId && m.id !== Number(moduloId)) continue
          const modHit =
            !qn ||
            m.codigo.toLowerCase().includes(qn) ||
            (m.nombre ?? '').toLowerCase().includes(qn)

          if (view === 'modulos' && modHit) {
            list.push({
              kind: 'modulo',
              fundoId: f.id,
              empresaId: e.id,
              empresaNombre: e.razon_social,
              fundoNombre: f.nombre,
              data: m,
            })
          }

          for (const t of m.turnos) {
            if (turnoId && t.id !== Number(turnoId)) continue
            const turnoHit =
              !qn ||
              t.codigo.toLowerCase().includes(qn) ||
              (t.nombre ?? '').toLowerCase().includes(qn)

            if (view === 'turnos' && turnoHit) {
              list.push({
                kind: 'turno',
                moduloId: m.id,
                fundoId: f.id,
                empresaId: e.id,
                empresaNombre: e.razon_social,
                fundoNombre: f.nombre,
                moduloCodigo: m.codigo,
                moduloNombre: m.nombre,
                data: t,
              })
            }
          }
        }
      }
    }
    return list
  }, [arbol, empresaId, fundoId, moduloId, turnoId, debouncedQ, view])

  const page = paginate(allRows, skip, limit)

  function openNuevoFundo() {
    const defaultEmpresa = empresaId ? Number(empresaId) : arbol[0]?.id ?? 0
    if (!defaultEmpresa) {
      toast.error('No hay empresas disponibles')
      return
    }
    setFundoForm({ empresaId: defaultEmpresa, nombre: '', domicilio: '', activo: true })
  }

  function openNuevoModulo() {
    const id = fundoId ? Number(fundoId) : allFundosFlat[0]?.id ?? 0
    if (!id) {
      toast.error('Cree un fundo antes de agregar un módulo')
      return
    }
    setModuloForm({ fundoId: id, codigo: '', nombre: '', activo: true })
  }

  function openNuevoTurno() {
    const id = moduloId ? Number(moduloId) : allModulosFlat[0]?.id ?? 0
    if (!id) {
      toast.error('Cree un módulo antes de agregar un turno')
      return
    }
    setTurnoForm({ moduloId: id, codigo: '', nombre: '', activo: true })
  }

  function openNuevoLote() {
    const id = turnoId ? Number(turnoId) : allTurnosFlat[0]?.id ?? 0
    if (!id) {
      toast.error('Cree un turno antes de agregar un lote')
      return
    }
    setLoteForm({ turnoId: id, codigo: '', areaHa: '', activo: true })
  }

  const createAction = {
    fundos: { label: 'Nuevo fundo', onClick: openNuevoFundo },
    modulos: { label: 'Nuevo módulo', onClick: openNuevoModulo },
    turnos: { label: 'Nuevo turno', onClick: openNuevoTurno },
    lotes: { label: 'Nuevo lote', onClick: openNuevoLote },
  }[view]

  const isLoading = view === 'lotes' ? lotesLoading : loading
  const isEmpty = view === 'lotes' ? lotesTotal === 0 : page.total === 0

  function renderFilters() {
    const selectCls = 'min-w-[150px] flex-1'
    const onEmpresa = (v: string) => {
      setEmpresaId(v)
      setFundoId('')
      setModuloId('')
      setTurnoId('')
      setSkip(0)
    }
    const onFundo = (v: string) => {
      setFundoId(v)
      setModuloId('')
      setTurnoId('')
      setSkip(0)
    }
    const onModulo = (v: string) => {
      setModuloId(v)
      setTurnoId('')
      setSkip(0)
    }

    return (
      <>
        {(view === 'fundos' || view === 'modulos' || view === 'turnos' || view === 'lotes') && (
          <div className={selectCls}>
            <Select
              label="Empresa"
              value={empresaId}
              onChange={(e) => onEmpresa(e.target.value)}
              placeholder="Todas"
              options={empresasOpts}
            />
          </div>
        )}
        {(view === 'fundos' || view === 'modulos' || view === 'turnos' || view === 'lotes') && (
          <div className={selectCls}>
            <Select
              label="Fundo"
              value={fundoId}
              onChange={(e) => onFundo(e.target.value)}
              placeholder="Todos"
              options={fundosOpts}
            />
          </div>
        )}
        {(view === 'modulos' || view === 'turnos' || view === 'lotes') && (
          <div className={selectCls}>
            <Select
              label="Módulo"
              value={moduloId}
              onChange={(e) => onModulo(e.target.value)}
              placeholder="Todos"
              options={modulosOpts}
            />
          </div>
        )}
        {(view === 'turnos' || view === 'lotes') && (
          <div className={selectCls}>
            <Select
              label="Turno"
              value={turnoId}
              onChange={(e) => {
                setTurnoId(e.target.value)
                setSkip(0)
              }}
              placeholder="Todos"
              options={turnosOpts}
            />
          </div>
        )}
        <div className="min-w-[160px] flex-[1.2]">
          <SearchInput
            label="Búsqueda"
            placeholder={SEARCH_PLACEHOLDER[view]}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setSkip(0)
            }}
          />
        </div>
        <div className="flex h-[42px] items-center sm:mb-0.5">
          <Switch
            checked={soloActivos}
            onChange={(v) => {
              setSoloActivos(v)
              setSkip(0)
            }}
            label="Solo activos"
          />
        </div>
      </>
    )
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Inicio', to: '/' },
          { label: 'Fundos', to: '/ubicaciones' },
          { label },
        ]}
      />

      {error && <ErrorBanner message={error} onRetry={view === 'lotes' ? loadLotes : loadArbol} />}

      <Card padding="none">
        <div className="flex flex-col gap-4 p-4 pb-3">
          <CardHeader
            title={label}
            icon={VIEW_ICON[view]}
            actions={
              <Button leftIcon={<Plus className="size-4" />} onClick={createAction.onClick}>
                {createAction.label}
              </Button>
            }
          />
          <FilterBar embedded onClear={clearFilters} hasActiveFilters={hasActiveFilters}>
            {renderFilters()}
          </FilterBar>
        </div>

        {isLoading ? (
          <div className="px-4 pb-4">
            <SkeletonRows rows={6} />
          </div>
        ) : isEmpty ? (
          <div className="px-4 pb-6">
            <EmptyState
              title={`Sin ${label.toLowerCase()}`}
              description={
                hasActiveFilters
                  ? 'No hay coincidencias con los filtros actuales.'
                  : 'Comience creando un registro desde el botón superior.'
              }
              action={
                hasActiveFilters ? (
                  <Button variant="secondary" onClick={clearFilters}>
                    Limpiar filtros
                  </Button>
                ) : (
                  <Button leftIcon={<Plus className="size-4" />} onClick={createAction.onClick}>
                    {createAction.label}
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <>
            {view === 'lotes' ? (
              <TableShell stickyHeader flush>
                <Table className="min-w-[720px]">
                  <THead sticky>
                    <Th>Código</Th>
                    <Th>Ha</Th>
                    <Th>Turno</Th>
                    <Th className="hidden md:table-cell">Módulo</Th>
                    <Th className="hidden lg:table-cell">Fundo</Th>
                    <Th className="hidden xl:table-cell">Empresa</Th>
                    <Th>Estado</Th>
                    <Th className="text-right">Acciones</Th>
                  </THead>
                  <tbody>
                    {lotes.map((l) => (
                      <Tr key={l.id}>
                        <Td className="font-medium">{l.codigo}</Td>
                        <Td>{Number(l.area_ha).toFixed(2)}</Td>
                        <Td>
                          <span title={labelCodigoTitle(l.ctx.turnoCodigo, l.ctx.turnoNombre)}>
                            {labelCodigo(l.ctx.turnoCodigo, l.ctx.turnoNombre)}
                          </span>
                        </Td>
                        <Td className="hidden md:table-cell">
                          <span title={labelCodigoTitle(l.ctx.moduloCodigo, l.ctx.moduloNombre)}>
                            {labelCodigo(l.ctx.moduloCodigo, l.ctx.moduloNombre)}
                          </span>
                        </Td>
                        <Td className="hidden text-muted lg:table-cell">{l.ctx.fundoNombre}</Td>
                        <TdTruncate className="hidden xl:table-cell" maxWidth="160px">
                          {l.ctx.empresaNombre}
                        </TdTruncate>
                        <Td>
                          <StatusPill activo={l.activo} />
                        </Td>
                        <Td className="text-right">
                          <div onClick={(e) => e.stopPropagation()}>
                            <EditButton
                              onClick={() =>
                                setLoteForm({
                                  id: l.id,
                                  turnoId: l.turno_id,
                                  codigo: l.codigo,
                                  areaHa: String(l.area_ha),
                                  activo: l.activo,
                                })
                              }
                            />
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableShell>
            ) : view === 'fundos' ? (
              <TableShell stickyHeader flush>
                <Table>
                  <THead sticky>
                    <Th>Nombre</Th>
                    <Th className="hidden sm:table-cell">Empresa</Th>
                    <Th className="hidden md:table-cell">Domicilio</Th>
                    <Th>Estado</Th>
                    <Th className="text-right">Acciones</Th>
                  </THead>
                  <tbody>
                    {page.items.map((row) => {
                      if (row.kind !== 'fundo') return null
                      return (
                        <Tr key={`f-${row.data.id}`}>
                          <Td className="font-medium">{row.data.nombre}</Td>
                          <TdTruncate className="hidden sm:table-cell" maxWidth="180px">
                            {row.empresaNombre}
                          </TdTruncate>
                          <TdTruncate className="hidden md:table-cell" maxWidth="200px">
                            {row.data.domicilio ?? '—'}
                          </TdTruncate>
                          <Td>
                            <StatusPill activo={row.data.activo} />
                          </Td>
                          <Td className="text-right">
                            <div className="inline-flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                              <ViewButton to={`/ubicaciones/fundos/${row.data.id}`} />
                              <EditButton
                                onClick={() =>
                                  setFundoForm({
                                    id: row.data.id,
                                    empresaId: row.empresaId,
                                    nombre: row.data.nombre,
                                    domicilio: row.data.domicilio ?? '',
                                    activo: row.data.activo,
                                  })
                                }
                              />
                            </div>
                          </Td>
                        </Tr>
                      )
                    })}
                  </tbody>
                </Table>
              </TableShell>
            ) : view === 'modulos' ? (
              <TableShell stickyHeader flush>
                <Table className="min-w-[640px]">
                  <THead sticky>
                    <Th>Código</Th>
                    <Th className="hidden sm:table-cell">Nombre</Th>
                    <Th>Fundo</Th>
                    <Th className="hidden md:table-cell">Empresa</Th>
                    <Th>Estado</Th>
                    <Th className="text-right">Acciones</Th>
                  </THead>
                  <tbody>
                    {page.items.map((row) => {
                      if (row.kind !== 'modulo') return null
                      return (
                        <Tr key={`m-${row.data.id}`}>
                          <Td className="font-medium">{row.data.codigo}</Td>
                          <Td className="hidden sm:table-cell">{row.data.nombre ?? '—'}</Td>
                          <Td className="text-muted">{row.fundoNombre}</Td>
                          <TdTruncate className="hidden md:table-cell" maxWidth="160px">
                            {row.empresaNombre}
                          </TdTruncate>
                          <Td>
                            <StatusPill activo={row.data.activo} />
                          </Td>
                          <Td className="text-right">
                            <div onClick={(e) => e.stopPropagation()}>
                              <EditButton
                                onClick={() =>
                                  setModuloForm({
                                    id: row.data.id,
                                    fundoId: row.fundoId,
                                    codigo: row.data.codigo,
                                    nombre: row.data.nombre ?? '',
                                    activo: row.data.activo,
                                  })
                                }
                              />
                            </div>
                          </Td>
                        </Tr>
                      )
                    })}
                  </tbody>
                </Table>
              </TableShell>
            ) : (
              <TableShell stickyHeader flush>
                <Table className="min-w-[720px]">
                  <THead sticky>
                    <Th>Código</Th>
                    <Th className="hidden sm:table-cell">Nombre</Th>
                    <Th>Módulo</Th>
                    <Th className="hidden md:table-cell">Fundo</Th>
                    <Th className="hidden lg:table-cell">Empresa</Th>
                    <Th>Estado</Th>
                    <Th className="text-right">Acciones</Th>
                  </THead>
                  <tbody>
                    {page.items.map((row) => {
                      if (row.kind !== 'turno') return null
                      return (
                        <Tr key={`t-${row.data.id}`}>
                          <Td className="font-medium">{row.data.codigo}</Td>
                          <Td className="hidden sm:table-cell">{row.data.nombre ?? '—'}</Td>
                          <Td>
                            <span title={labelCodigoTitle(row.moduloCodigo, row.moduloNombre)}>
                              {labelCodigo(row.moduloCodigo, row.moduloNombre)}
                            </span>
                          </Td>
                          <Td className="hidden text-muted md:table-cell">{row.fundoNombre}</Td>
                          <TdTruncate className="hidden lg:table-cell" maxWidth="160px">
                            {row.empresaNombre}
                          </TdTruncate>
                          <Td>
                            <StatusPill activo={row.data.activo} />
                          </Td>
                          <Td className="text-right">
                            <div onClick={(e) => e.stopPropagation()}>
                              <EditButton
                                onClick={() =>
                                  setTurnoForm({
                                    id: row.data.id,
                                    moduloId: row.moduloId,
                                    codigo: row.data.codigo,
                                    nombre: row.data.nombre ?? '',
                                    activo: row.data.activo,
                                  })
                                }
                              />
                            </div>
                          </Td>
                        </Tr>
                      )
                    })}
                  </tbody>
                </Table>
              </TableShell>
            )}
            <div className="border-t border-line px-4 py-3 [&>div]:mt-0">
              <Pagination
                skip={skip}
                limit={limit}
                total={view === 'lotes' ? lotesTotal : page.total}
                onChange={setSkip}
                onLimitChange={(n) => {
                  setLimit(n)
                  setSkip(0)
                }}
              />
            </div>
          </>
        )}
      </Card>

      <FundoFormDrawer
        open={!!fundoForm}
        form={fundoForm}
        empresas={empresasOpts}
        onClose={() => setFundoForm(null)}
        onSaved={async () => {
          setFundoForm(null)
          await loadArbol()
        }}
      />
      <ModuloFormDrawer
        open={!!moduloForm}
        form={moduloForm}
        fundos={allFundosFlat}
        onClose={() => setModuloForm(null)}
        onSaved={async () => {
          setModuloForm(null)
          await loadArbol()
        }}
      />
      <TurnoFormDrawer
        open={!!turnoForm}
        form={turnoForm}
        modulos={allModulosFlat}
        onClose={() => setTurnoForm(null)}
        onSaved={async () => {
          setTurnoForm(null)
          await loadArbol()
        }}
      />
      <LoteFormDrawer
        open={!!loteForm}
        form={loteForm}
        turnos={allTurnosFlat}
        onClose={() => setLoteForm(null)}
        onSaved={async () => {
          setLoteForm(null)
          if (view === 'lotes') await loadLotes()
          else await loadArbol()
        }}
      />
    </div>
  )
}
