import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Plus } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Input, Select, Switch } from '../components/ui/Form'
import {
  EmptyState,
  ErrorBanner,
  FilterBar,
  PageHeader,
  SkeletonRows,
  StatusPill,
} from '../components/ui/Feedback'
import { EditButton, ViewButton } from '../components/ui/TableActions'
import { Pagination, Table, TableShell, THead, Th, Td, Tr } from '../components/ui/Table'
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
import { apiGet } from '../lib/api'
import { paginate } from '../lib/utils'
import { useToast } from '../context/ToastContext'
import type { EmpresaNodo, FundoNodo, ModuloNodo, TurnoNodo } from '../types/api'

type Row =
  | { kind: 'fundo'; empresaId: number; empresaNombre: string; data: FundoNodo }
  | {
      kind: 'modulo'
      fundoId: number
      empresaNombre: string
      fundoNombre: string
      data: ModuloNodo
    }
  | {
      kind: 'turno'
      moduloId: number
      fundoId: number
      empresaNombre: string
      fundoNombre: string
      moduloCodigo: string
      data: TurnoNodo
    }

export function UbicacionesPage() {
  const toast = useToast()
  const [arbol, setArbol] = useState<EmpresaNodo[]>([])
  const [empresaId, setEmpresaId] = useState('')
  const [fundoId, setFundoId] = useState('')
  const [q, setQ] = useState('')
  const [soloActivos, setSoloActivos] = useState(true)
  const [selected, setSelected] = useState<Row | null>(null)
  const [skip, setSkip] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fundoForm, setFundoForm] = useState<FundoForm | null>(null)
  const [moduloForm, setModuloForm] = useState<ModuloForm | null>(null)
  const [turnoForm, setTurnoForm] = useState<TurnoForm | null>(null)
  const [loteForm, setLoteForm] = useState<LoteForm | null>(null)
  const limit = 10

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setArbol(
        await apiGet<EmpresaNodo[]>('/api/v1/arbol/ubicaciones', {
          incluir_inactivos: !soloActivos,
        }),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los fundos')
      setArbol([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [soloActivos])

  const empresasOpts = arbol.map((e) => ({ value: e.id, label: e.razon_social }))
  const fundosOpts = useMemo(() => {
    return arbol.flatMap((e) =>
      (!empresaId || e.id === Number(empresaId) ? e.fundos : []).map((f) => ({
        value: f.id,
        label: f.nombre,
      })),
    )
  }, [arbol, empresaId])

  const allFundosFlat = useMemo(
    () =>
      arbol.flatMap((e) =>
        e.fundos.map((f) => ({ id: f.id, nombre: f.nombre, empresaId: e.id })),
      ),
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

  const rows = useMemo(() => {
    const qn = q.trim().toLowerCase()
    const list: Row[] = []
    for (const e of arbol) {
      if (empresaId && e.id !== Number(empresaId)) continue
      for (const f of e.fundos) {
        if (fundoId && f.id !== Number(fundoId)) continue
        const fundoMatch =
          !qn ||
          f.nombre.toLowerCase().includes(qn) ||
          e.razon_social.toLowerCase().includes(qn) ||
          e.ruc.includes(qn)

        const matchingMods = f.modulos.filter((m) => {
          if (!qn) return true
          const modHit =
            (m.nombre ?? '').toLowerCase().includes(qn) || m.codigo.toLowerCase().includes(qn)
          const turnoHit = m.turnos.some(
            (t) =>
              t.codigo.toLowerCase().includes(qn) || (t.nombre ?? '').toLowerCase().includes(qn),
          )
          return modHit || turnoHit
        })

        if (fundoMatch) {
          list.push({ kind: 'fundo', empresaId: e.id, empresaNombre: e.razon_social, data: f })
        }

        const modsToShow = fundoMatch ? f.modulos : matchingMods
        for (const m of modsToShow) {
          const modHit =
            !qn ||
            (m.nombre ?? '').toLowerCase().includes(qn) ||
            m.codigo.toLowerCase().includes(qn)
          list.push({
            kind: 'modulo',
            fundoId: f.id,
            empresaNombre: e.razon_social,
            fundoNombre: f.nombre,
            data: m,
          })
          const turnosToShow = fundoMatch
            ? m.turnos
            : m.turnos.filter(
                (t) =>
                  !qn ||
                  t.codigo.toLowerCase().includes(qn) ||
                  (t.nombre ?? '').toLowerCase().includes(qn) ||
                  modHit,
              )
          for (const t of turnosToShow) {
            list.push({
              kind: 'turno',
              moduloId: m.id,
              fundoId: f.id,
              empresaNombre: e.razon_social,
              fundoNombre: f.nombre,
              moduloCodigo: m.codigo,
              data: t,
            })
          }
        }
      }
    }
    return list
  }, [arbol, empresaId, fundoId, q])

  const page = paginate(rows, skip, limit)

  function openNuevoFundo() {
    const defaultEmpresa = empresaId ? Number(empresaId) : arbol[0]?.id ?? 0
    if (!defaultEmpresa) {
      toast.error('No hay empresas disponibles')
      return
    }
    setFundoForm({
      empresaId: defaultEmpresa,
      nombre: '',
      domicilio: '',
      activo: true,
    })
  }

  function openNuevoModulo(preFundoId?: number) {
    const id = preFundoId ?? (fundoId ? Number(fundoId) : allFundosFlat[0]?.id ?? 0)
    if (!id) {
      toast.error('Cree un fundo antes de agregar un módulo')
      return
    }
    setModuloForm({ fundoId: id, codigo: '', nombre: '', activo: true })
  }

  function openNuevoTurno(preModuloId?: number) {
    const id = preModuloId ?? allModulosFlat[0]?.id ?? 0
    if (!id) {
      toast.error('Cree un módulo antes de agregar un turno')
      return
    }
    setTurnoForm({ moduloId: id, codigo: '', nombre: '', activo: true })
  }

  function openNuevoLote(preTurnoId?: number) {
    const id = preTurnoId ?? allTurnosFlat[0]?.id ?? 0
    if (!id) {
      toast.error('Cree un turno antes de agregar un lote')
      return
    }
    setLoteForm({ turnoId: id, codigo: '', areaHa: '', activo: true })
  }

  return (
    <div>
      <PageHeader
        title="Fundos"
        description="Empresa → Fundo → Módulo → Turno → Lote (hectáreas)"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button leftIcon={<Plus className="size-4" />} onClick={openNuevoFundo}>
              Nuevo fundo
            </Button>
            <Button variant="secondary" leftIcon={<Plus className="size-4" />} onClick={() => openNuevoModulo()}>
              Módulo
            </Button>
            <Button variant="secondary" leftIcon={<Plus className="size-4" />} onClick={() => openNuevoTurno()}>
              Turno
            </Button>
            <Button variant="secondary" leftIcon={<Plus className="size-4" />} onClick={() => openNuevoLote()}>
              Lote
            </Button>
          </div>
        }
      />

      <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted">
        <span className="text-olive-900">Empresa</span>
        <ChevronRight className="size-3.5" />
        <span className="text-olive-900">Fundo</span>
        <ChevronRight className="size-3.5" />
        <span>Módulo</span>
        <ChevronRight className="size-3.5" />
        <span>Turno</span>
        <ChevronRight className="size-3.5" />
        <span>Lote</span>
      </nav>

      {error && <ErrorBanner message={error} onRetry={load} />}

      <FilterBar>
        <div className="min-w-[160px] flex-1">
          <Select
            label="Empresa"
            value={empresaId}
            onChange={(e) => {
              setEmpresaId(e.target.value)
              setFundoId('')
              setSkip(0)
            }}
            placeholder="Todas"
            options={empresasOpts}
          />
        </div>
        <div className="min-w-[160px] flex-1">
          <Select
            label="Fundo"
            value={fundoId}
            onChange={(e) => {
              setFundoId(e.target.value)
              setSkip(0)
            }}
            placeholder="Todos"
            options={fundosOpts}
          />
        </div>
        <div className="min-w-[180px] flex-[1.2]">
          <Input
            label="Búsqueda"
            placeholder="Nombre, código o RUC…"
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
      </FilterBar>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div>
          {loading ? (
            <SkeletonRows rows={6} />
          ) : page.total === 0 ? (
            <EmptyState
              title="Sin fundos"
              description="No hay fundos, módulos o turnos con los filtros actuales."
              action={
                <Button leftIcon={<Plus className="size-4" />} onClick={openNuevoFundo}>
                  Nuevo fundo
                </Button>
              }
            />
          ) : (
            <>
              <TableShell>
                <Table>
                  <THead>
                    <Th>Nivel</Th>
                    <Th>Nombre / código</Th>
                    <Th>Estado</Th>
                    <Th className="text-right">Acciones</Th>
                  </THead>
                  <tbody>
                    {page.items.map((row) =>
                      row.kind === 'fundo' ? (
                        <Tr
                          key={`f-${row.data.id}`}
                          selected={selected?.kind === 'fundo' && selected.data.id === row.data.id}
                          onClick={() => setSelected(row)}
                        >
                          <Td>
                            <span className="text-xs font-medium text-teal-800">Fundo</span>
                          </Td>
                          <Td>
                            <p className="font-medium">{row.data.nombre}</p>
                            <p className="text-xs text-muted">{row.empresaNombre}</p>
                          </Td>
                          <Td>
                            <StatusPill activo={row.data.activo} />
                          </Td>
                          <Td className="text-right">
                            <div className="inline-flex gap-1" onClick={(e) => e.stopPropagation()}>
                              <Link to={`/ubicaciones/fundos/${row.data.id}`}>
                                <ViewButton />
                              </Link>
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
                      ) : row.kind === 'modulo' ? (
                        <Tr
                          key={`m-${row.data.id}`}
                          selected={selected?.kind === 'modulo' && selected.data.id === row.data.id}
                          onClick={() => setSelected(row)}
                        >
                          <Td>
                            <span className="pl-3 text-xs text-muted">Módulo</span>
                          </Td>
                          <Td>
                            <p className="font-medium">
                              {row.data.codigo}
                              {row.data.nombre ? ` · ${row.data.nombre}` : ''}
                            </p>
                            <p className="text-xs text-muted">{row.fundoNombre}</p>
                          </Td>
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
                      ) : (
                        <Tr
                          key={`t-${row.data.id}`}
                          selected={selected?.kind === 'turno' && selected.data.id === row.data.id}
                          onClick={() => setSelected(row)}
                        >
                          <Td>
                            <span className="pl-6 text-xs text-muted">Turno</span>
                          </Td>
                          <Td>
                            <p className="font-medium">
                              {row.data.codigo}
                              {row.data.nombre ? ` · ${row.data.nombre}` : ''}
                            </p>
                            <p className="text-xs text-muted">
                              {row.fundoNombre} · {row.moduloCodigo}
                            </p>
                          </Td>
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
                      ),
                    )}
                  </tbody>
                </Table>
              </TableShell>
              <Pagination skip={skip} limit={limit} total={page.total} onChange={setSkip} />
            </>
          )}
        </div>

        <aside className="hidden rounded-xl border border-line bg-white p-4 lg:block">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Detalle</p>
          {!selected ? (
            <p className="mt-3 text-sm text-muted">Seleccione un ítem de la tabla.</p>
          ) : selected.kind === 'fundo' ? (
            <div className="mt-3 space-y-2 text-sm">
              <p className="font-display text-lg text-olive-950">{selected.data.nombre}</p>
              <p className="text-muted">{selected.empresaNombre}</p>
              <p>{selected.data.domicilio ?? 'Sin domicilio'}</p>
              <StatusPill activo={selected.data.activo} />
              <div className="flex flex-col gap-2 pt-2">
                <Link
                  to={`/ubicaciones/fundos/${selected.data.id}`}
                  className="text-sm font-medium text-teal-800 hover:underline"
                >
                  Abrir detalle del fundo
                </Link>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Plus className="size-3.5" />}
                  onClick={() => openNuevoModulo(selected.data.id)}
                >
                  Nuevo módulo
                </Button>
              </div>
            </div>
          ) : selected.kind === 'modulo' ? (
            <div className="mt-3 space-y-2 text-sm">
              <p className="font-display text-lg text-olive-950">
                {selected.data.codigo}
                {selected.data.nombre ? ` · ${selected.data.nombre}` : ''}
              </p>
              <p className="text-muted">{selected.fundoNombre}</p>
              <p className="text-xs text-muted">{selected.data.turnos.length} turno(s)</p>
              <StatusPill activo={selected.data.activo} />
              <div className="pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Plus className="size-3.5" />}
                  onClick={() => openNuevoTurno(selected.data.id)}
                >
                  Nuevo turno
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-2 text-sm">
              <p className="font-display text-lg text-olive-950">
                {selected.data.codigo}
                {selected.data.nombre ? ` · ${selected.data.nombre}` : ''}
              </p>
              <p className="text-muted">
                {selected.fundoNombre} · {selected.moduloCodigo}
              </p>
              <StatusPill activo={selected.data.activo} />
              <div className="pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Plus className="size-3.5" />}
                  onClick={() => openNuevoLote(selected.data.id)}
                >
                  Nuevo lote
                </Button>
              </div>
            </div>
          )}
        </aside>
      </div>

      <FundoFormDrawer
        open={!!fundoForm}
        form={fundoForm}
        empresas={empresasOpts}
        onClose={() => setFundoForm(null)}
        onSaved={async () => {
          setFundoForm(null)
          await load()
        }}
      />

      <ModuloFormDrawer
        open={!!moduloForm}
        form={moduloForm}
        fundos={allFundosFlat}
        onClose={() => setModuloForm(null)}
        onSaved={async () => {
          setModuloForm(null)
          await load()
        }}
      />

      <TurnoFormDrawer
        open={!!turnoForm}
        form={turnoForm}
        modulos={allModulosFlat}
        onClose={() => setTurnoForm(null)}
        onSaved={async () => {
          setTurnoForm(null)
          await load()
        }}
      />

      <LoteFormDrawer
        open={!!loteForm}
        form={loteForm}
        turnos={allTurnosFlat}
        onClose={() => setLoteForm(null)}
        onSaved={async () => {
          setLoteForm(null)
          await load()
        }}
      />
    </div>
  )
}
