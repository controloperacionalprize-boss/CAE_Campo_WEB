import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Plus, Eye, Pencil } from 'lucide-react'
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
import { Modal } from '../components/ui/Overlay'
import { Pagination, Table, TableShell, THead, Th, Td, Tr } from '../components/ui/Table'
import { apiGet, apiPatch, apiPost } from '../lib/api'
import { paginate } from '../lib/utils'
import { useToast } from '../context/ToastContext'
import type { EmpresaNodo, FundoNodo, ModuloNodo } from '../types/api'

type Row =
  | { kind: 'fundo'; empresaId: number; empresaNombre: string; data: FundoNodo }
  | {
      kind: 'modulo'
      fundoId: number
      empresaNombre: string
      fundoNombre: string
      data: ModuloNodo
    }

type FundoForm = { id?: number; empresaId: number; nombre: string; domicilio: string; activo: boolean }
type ModuloForm = {
  id?: number
  fundoId: number
  codigo: string
  nombre: string
  activo: boolean
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
  const limit = 8

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
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las ubicaciones')
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
        const mods = f.modulos.filter((m) => {
          if (!qn) return true
          return (
            (m.nombre ?? '').toLowerCase().includes(qn) ||
            m.codigo.toLowerCase().includes(qn)
          )
        })
        if (fundoMatch) {
          list.push({ kind: 'fundo', empresaId: e.id, empresaNombre: e.razon_social, data: f })
          for (const m of mods) {
            list.push({
              kind: 'modulo',
              fundoId: f.id,
              empresaNombre: e.razon_social,
              fundoNombre: f.nombre,
              data: m,
            })
          }
        } else {
          for (const m of mods) {
            list.push({
              kind: 'modulo',
              fundoId: f.id,
              empresaNombre: e.razon_social,
              fundoNombre: f.nombre,
              data: m,
            })
          }
        }
      }
    }
    return list
  }, [arbol, empresaId, fundoId, q])

  const page = paginate(rows, skip, limit)

  function openNuevoFundo() {
    const defaultEmpresa = empresaId
      ? Number(empresaId)
      : arbol[0]?.id ?? 0
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

  return (
    <div>
      <PageHeader
        title="Ubicaciones"
        description="Empresa → Fundo → Módulo → Turno → Lotes"
        actions={
          <Button leftIcon={<Plus className="size-4" />} onClick={openNuevoFundo}>
            Nuevo fundo
          </Button>
        }
      />

      <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted">
        <span className="text-olive-900">Empresa</span>
        <ChevronRight className="size-3.5" />
        <span className="text-olive-900">Fundo</span>
        <ChevronRight className="size-3.5" />
        <span>Módulo</span>
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
              title="Sin ubicaciones"
              description="No hay fundos o módulos con los filtros actuales."
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
                                <Button variant="ghost" size="sm" leftIcon={<Eye className="size-3.5" />}>
                                  Ver
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                leftIcon={<Pencil className="size-3.5" />}
                                onClick={() =>
                                  setFundoForm({
                                    id: row.data.id,
                                    empresaId: row.empresaId,
                                    nombre: row.data.nombre,
                                    domicilio: row.data.domicilio ?? '',
                                    activo: row.data.activo,
                                  })
                                }
                              >
                                Editar
                              </Button>
                            </div>
                          </Td>
                        </Tr>
                      ) : (
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
                            <Button
                              variant="ghost"
                              size="sm"
                              leftIcon={<Pencil className="size-3.5" />}
                              onClick={(e) => {
                                e.stopPropagation()
                                setModuloForm({
                                  id: row.data.id,
                                  fundoId: row.fundoId,
                                  codigo: row.data.codigo,
                                  nombre: row.data.nombre ?? '',
                                  activo: row.data.activo,
                                })
                              }}
                            >
                              Editar
                            </Button>
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
                  onClick={() =>
                    setModuloForm({
                      fundoId: selected.data.id,
                      codigo: '',
                      nombre: '',
                      activo: true,
                    })
                  }
                >
                  Nuevo módulo
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-2 text-sm">
              <p className="font-display text-lg text-olive-950">
                {selected.data.codigo}
                {selected.data.nombre ? ` · ${selected.data.nombre}` : ''}
              </p>
              <p className="text-muted">{selected.fundoNombre}</p>
              <p className="text-xs text-muted">{selected.data.turnos.length} turno(s)</p>
              <StatusPill activo={selected.data.activo} />
            </div>
          )}
        </aside>
      </div>

      <FundoFormModal
        open={!!fundoForm}
        form={fundoForm}
        empresas={empresasOpts}
        onClose={() => setFundoForm(null)}
        onSaved={async () => {
          setFundoForm(null)
          await load()
        }}
      />

      <ModuloFormModal
        open={!!moduloForm}
        form={moduloForm}
        fundos={allFundosFlat}
        onClose={() => setModuloForm(null)}
        onSaved={async () => {
          setModuloForm(null)
          await load()
        }}
      />
    </div>
  )
}

function FundoFormModal({
  open,
  form,
  empresas,
  onClose,
  onSaved,
}: {
  open: boolean
  form: FundoForm | null
  empresas: { value: number; label: string }[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const toast = useToast()
  const [empresaId, setEmpresaId] = useState('')
  const [nombre, setNombre] = useState('')
  const [domicilio, setDomicilio] = useState('')
  const [activo, setActivo] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!form) return
    setEmpresaId(String(form.empresaId))
    setNombre(form.nombre)
    setDomicilio(form.domicilio)
    setActivo(form.activo)
    setError('')
  }, [form])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) {
      setError('Ingrese el nombre')
      return
    }
    if (!empresaId) {
      setError('Seleccione una empresa')
      return
    }
    const body = {
      empresa_id: Number(empresaId),
      nombre: nombre.trim(),
      domicilio: domicilio.trim() || null,
      activo,
    }
    setSaving(true)
    try {
      if (form?.id) {
        await apiPatch(`/api/v1/fundos/${form.id}`, body)
        toast.success('Fundo actualizado')
      } else {
        await apiPost('/api/v1/fundos', body)
        toast.success('Fundo creado')
      }
      await onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={form?.id ? 'Editar fundo' : 'Nuevo fundo'}>
      <form onSubmit={submit} className="space-y-4">
        <Select
          label="Empresa"
          value={empresaId}
          onChange={(e) => setEmpresaId(e.target.value)}
          options={empresas}
        />
        <Input
          label="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          error={error}
        />
        <Input
          label="Domicilio"
          value={domicilio}
          onChange={(e) => setDomicilio(e.target.value)}
        />
        <Switch checked={activo} onChange={setActivo} label="Activo" />
        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function ModuloFormModal({
  open,
  form,
  fundos,
  onClose,
  onSaved,
}: {
  open: boolean
  form: ModuloForm | null
  fundos: { id: number; nombre: string; empresaId: number }[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const toast = useToast()
  const [fundoId, setFundoId] = useState('')
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [activo, setActivo] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!form) return
    setFundoId(String(form.fundoId))
    setCodigo(form.codigo)
    setNombre(form.nombre)
    setActivo(form.activo)
    setError('')
  }, [form])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!codigo.trim()) {
      setError('Ingrese el código')
      return
    }
    if (!fundoId) {
      setError('Seleccione un fundo')
      return
    }
    const body = {
      fundo_id: Number(fundoId),
      codigo: codigo.trim(),
      nombre: nombre.trim() || null,
      activo,
    }
    setSaving(true)
    try {
      if (form?.id) {
        await apiPatch(`/api/v1/modulos/${form.id}`, body)
        toast.success('Módulo actualizado')
      } else {
        await apiPost('/api/v1/modulos', body)
        toast.success('Módulo creado')
      }
      await onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={form?.id ? 'Editar módulo' : 'Nuevo módulo'}>
      <form onSubmit={submit} className="space-y-4">
        <Select
          label="Fundo"
          value={fundoId}
          onChange={(e) => setFundoId(e.target.value)}
          options={fundos.map((f) => ({ value: f.id, label: f.nombre }))}
        />
        <Input
          label="Código"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          error={error}
          placeholder="M-01"
        />
        <Input
          label="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Opcional"
        />
        <Switch checked={activo} onChange={setActivo} label="Activo" />
        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
