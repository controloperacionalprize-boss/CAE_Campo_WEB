import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../ui/Button'
import { FormActions, FormSection, Input, SearchInput, Select, Switch } from '../ui/Form'
import {
  CollapsibleFilters,
  EmptyState,
  ErrorBanner,
  FilterBar,
  SkeletonRows,
  StatusPill,
} from '../ui/Feedback'
import { Drawer } from '../ui/Overlay'
import { EditButton } from '../ui/TableActions'
import { Pagination, Table, TableShell, THead, Th, Td, TdTruncate, Tr } from '../ui/Table'
import { apiPatch, apiPost, isAbortError, listPage } from '../../lib/api'
import { isValidDni } from '../../lib/utils'
import { useDebounce } from '../../hooks/useDebounce'
import { useToast } from '../../context/ToastContext'
import { useLookups } from '../../context/LookupsContext'
import type { Area, Cargo, Grupo, Rol, Usuario } from '../../types/api'

export function UsuariosPanel({ createSignal }: { createSignal?: number }) {
  const { grupos, roles, cargos, areas, loading: lookupsLoading, error: lookupsError } = useLookups([
    'grupos',
    'roles',
    'cargos',
    'areas',
  ])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [total, setTotal] = useState(0)
  const [incluirInactivos, setIncluirInactivos] = useState(false)
  const [grupoId, setGrupoId] = useState('')
  const [rolId, setRolId] = useState('')
  const [cargoId, setCargoId] = useState('')
  const [areaId, setAreaId] = useState('')
  const [q, setQ] = useState('')
  const debouncedQ = useDebounce(q)
  const [skip, setSkip] = useState(0)
  const [limit, setLimit] = useState(10)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Usuario | null>(null)

  async function loadUsuarios(signal?: AbortSignal) {
    setLoading(true)
    setError(null)
    try {
      const page = await listPage<Usuario>('/api/v1/usuarios', {
        incluirInactivos,
        skip,
        limit,
        q: debouncedQ || undefined,
        grupo_id: grupoId || undefined,
        rol_id: rolId || undefined,
        cargo_id: cargoId || undefined,
        area_id: areaId || undefined,
        signal,
      })
      if (signal?.aborted) return
      setUsuarios(page.items)
      setTotal(page.total)
    } catch (e) {
      if (isAbortError(e)) return
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los usuarios')
      setUsuarios([])
      setTotal(0)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    const ac = new AbortController()
    void loadUsuarios(ac.signal)
    return () => ac.abort()
  }, [skip, limit, debouncedQ, grupoId, rolId, cargoId, areaId, incluirInactivos])

  function openCreate() {
    setEditing(null)
    setDrawerOpen(true)
  }

  useEffect(() => {
    if (!createSignal) return
    openCreate()
  }, [createSignal])

  const hasActiveFilters = !!(grupoId || rolId || cargoId || areaId || q || incluirInactivos)

  function clearFilters() {
    setGrupoId('')
    setRolId('')
    setCargoId('')
    setAreaId('')
    setQ('')
    setIncluirInactivos(false)
    setSkip(0)
  }

  const grupoById = useMemo(() => new Map(grupos.map((g) => [g.id, g.nombre])), [grupos])
  const rolById = useMemo(() => new Map(roles.map((r) => [r.id, r.nombre])), [roles])
  const cargoById = useMemo(() => new Map(cargos.map((c) => [c.id, c.nombre])), [cargos])
  const areaById = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas])

  function nombreGrupo(id: number | null) {
    if (id == null) return '—'
    return grupoById.get(id) ?? `#${id}`
  }
  function nombreRol(id: number | null) {
    if (id == null) return '—'
    return rolById.get(id) ?? `#${id}`
  }
  function nombreCargo(id: number | null) {
    if (id == null) return '—'
    return cargoById.get(id) ?? `#${id}`
  }
  function nombreArea(id: number | null) {
    if (id == null) return '—'
    const a = areaById.get(id)
    return a ? `${a.prefijo} · ${a.nombre}` : `#${id}`
  }

  const areaOptions = useMemo(
    () => areas.map((a) => ({ value: a.id, label: `${a.prefijo} · ${a.nombre}` })),
    [areas],
  )

  return (
    <div>
      {(error || lookupsError) && (
        <ErrorBanner message={error ?? lookupsError ?? ''} onRetry={loadUsuarios} />
      )}

      <FilterBar onClear={clearFilters} hasActiveFilters={hasActiveFilters}>
        <div className="min-w-[160px] flex-1">
          <SearchInput
            label="Búsqueda"
            placeholder="DNI o nombre…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setSkip(0)
            }}
          />
        </div>
        <CollapsibleFilters label="Filtros avanzados">
          <div className="min-w-[140px] flex-1">
            <Select
              label="Grupo"
              value={grupoId}
              onChange={(e) => {
                setGrupoId(e.target.value)
                setSkip(0)
              }}
              placeholder={lookupsLoading ? 'Cargando…' : 'Todos'}
              options={grupos.map((g) => ({ value: g.id, label: g.nombre }))}
            />
          </div>
          <div className="min-w-[120px] flex-1">
            <Select
              label="Rol"
              value={rolId}
              onChange={(e) => {
                setRolId(e.target.value)
                setSkip(0)
              }}
              placeholder={lookupsLoading ? 'Cargando…' : 'Todos'}
              options={roles.map((r) => ({ value: r.id, label: r.nombre }))}
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <Select
              label="Cargo"
              value={cargoId}
              onChange={(e) => {
                setCargoId(e.target.value)
                setSkip(0)
              }}
              placeholder={lookupsLoading ? 'Cargando…' : 'Todos'}
              options={cargos.map((c) => ({ value: c.id, label: c.nombre }))}
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <Select
              label="Área"
              value={areaId}
              onChange={(e) => {
                setAreaId(e.target.value)
                setSkip(0)
              }}
              placeholder={lookupsLoading ? 'Cargando…' : 'Todas'}
              options={areaOptions}
            />
          </div>
          <div className="flex h-[42px] items-center sm:mb-0.5">
            <Switch
              checked={incluirInactivos}
              onChange={(v) => {
                setIncluirInactivos(v)
                setSkip(0)
              }}
              label="Incluir inactivos"
            />
          </div>
        </CollapsibleFilters>
      </FilterBar>

      {loading ? (
        <SkeletonRows rows={6} />
      ) : total === 0 ? (
        <EmptyState
          title="Sin usuarios"
          description={
            hasActiveFilters
              ? 'No hay coincidencias con los filtros actuales.'
              : 'Aún no hay usuarios registrados.'
          }
          action={
            hasActiveFilters ? (
              <Button variant="secondary" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            ) : (
              <Button leftIcon={<Plus className="size-4" />} onClick={openCreate}>
                Nuevo usuario
              </Button>
            )
          }
        />
      ) : (
        <>
          <TableShell stickyHeader>
            <Table>
              <THead sticky>
                <Th>DNI</Th>
                <Th>Nombre</Th>
                <Th className="hidden md:table-cell">Cargo</Th>
                <Th className="hidden lg:table-cell">Rol</Th>
                <Th className="hidden lg:table-cell">Grupo</Th>
                <Th className="hidden xl:table-cell">Área</Th>
                <Th className="hidden sm:table-cell">Estado</Th>
                <Th className="text-right">Acciones</Th>
              </THead>
              <tbody>
                {usuarios.map((u) => (
                  <Tr key={u.id}>
                    <Td className="font-medium tabular-nums">{u.dni}</Td>
                    <TdTruncate maxWidth="180px">{u.nombre}</TdTruncate>
                    <Td className="hidden md:table-cell">{nombreCargo(u.cargo_id)}</Td>
                    <Td className="hidden lg:table-cell">{nombreRol(u.rol_id)}</Td>
                    <Td className="hidden text-muted lg:table-cell">{nombreGrupo(u.grupo_id)}</Td>
                    <Td className="hidden text-muted xl:table-cell">{nombreArea(u.area_id)}</Td>
                    <Td className="hidden sm:table-cell">
                      <StatusPill activo={u.activo} />
                    </Td>
                    <Td className="text-right">
                      <EditButton
                        onClick={() => {
                          setEditing(u)
                          setDrawerOpen(true)
                        }}
                      />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableShell>
          <Pagination
            skip={skip}
            limit={limit}
            total={total}
            onChange={setSkip}
            onLimitChange={(n) => {
              setLimit(n)
              setSkip(0)
            }}
          />
        </>
      )}

      <UsuarioDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        usuario={editing}
        grupos={grupos}
        roles={roles}
        cargos={cargos}
        areas={areas}
        onSaved={async () => {
          setDrawerOpen(false)
          await loadUsuarios()
        }}
      />
    </div>
  )
}

function UsuarioDrawer({
  open,
  onClose,
  usuario,
  grupos,
  roles,
  cargos,
  areas,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  usuario: Usuario | null
  grupos: Grupo[]
  roles: Rol[]
  cargos: Cargo[]
  areas: Area[]
  onSaved: () => Promise<void>
}) {
  const toast = useToast()
  const isCreate = !usuario
  const [dni, setDni] = useState('')
  const [nombre, setNombre] = useState('')
  const [password, setPassword] = useState('')
  const [cargoId, setCargoId] = useState('')
  const [rolId, setRolId] = useState('')
  const [grupoId, setGrupoId] = useState('')
  const [areaId, setAreaId] = useState('')
  const [activo, setActivo] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const areaOptions = useMemo(() => {
    return areas
      .filter((a) => a.activo || a.id === usuario?.area_id)
      .map((a) => ({ value: a.id, label: `${a.prefijo} · ${a.nombre}` }))
  }, [areas, usuario?.area_id])

  useEffect(() => {
    if (!open) return
    setDni(usuario?.dni ?? '')
    setNombre(usuario?.nombre ?? '')
    setPassword('')
    setCargoId(usuario?.cargo_id != null ? String(usuario.cargo_id) : '')
    setRolId(usuario?.rol_id != null ? String(usuario.rol_id) : '')
    setGrupoId(usuario?.grupo_id != null ? String(usuario.grupo_id) : '')
    setAreaId(usuario?.area_id != null ? String(usuario.area_id) : '')
    setActivo(usuario?.activo ?? true)
    setErrors({})
  }, [open, usuario])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!isValidDni(dni)) next.dni = 'DNI debe tener 8 dígitos'
    if (!nombre.trim()) next.nombre = 'Requerido'
    if (isCreate && password.length < 4) {
      next.password = 'Ingrese una contraseña (mín. 4 caracteres)'
    }
    setErrors(next)
    if (Object.keys(next).length) return

    const body = {
      dni,
      nombre: nombre.trim(),
      cargo_id: cargoId ? Number(cargoId) : null,
      rol_id: rolId ? Number(rolId) : null,
      grupo_id: grupoId ? Number(grupoId) : null,
      area_id: areaId ? Number(areaId) : null,
      activo,
    }

    setSaving(true)
    try {
      if (isCreate) {
        await apiPost('/api/v1/usuarios', body)
        toast.success('Usuario creado')
      } else if (usuario) {
        await apiPatch(`/api/v1/usuarios/${usuario.id}`, body)
        toast.success('Usuario actualizado')
      }
      await onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title={isCreate ? 'Nuevo usuario' : 'Editar usuario'}>
      <form onSubmit={submit} className="space-y-4">
        <FormSection title="Identificación">
          <Input
            label="DNI"
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
            error={errors.dni}
            required
          />
          <Input
            label="Nombre completo"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            error={errors.nombre}
            required
          />
          {isCreate && (
            <Input
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              hint="Mínimo 4 caracteres"
              required
            />
          )}
        </FormSection>

        <FormSection title="Asignación">
          <Select
            label="Cargo"
            value={cargoId}
            onChange={(e) => setCargoId(e.target.value)}
            placeholder="Sin cargo"
            options={cargos.map((c) => ({ value: c.id, label: c.nombre }))}
          />
          <Select
            label="Rol"
            value={rolId}
            onChange={(e) => setRolId(e.target.value)}
            placeholder="Sin rol"
            options={roles.map((r) => ({ value: r.id, label: r.nombre }))}
          />
          <Select
            label="Grupo"
            value={grupoId}
            onChange={(e) => setGrupoId(e.target.value)}
            placeholder="Sin grupo"
            options={grupos.map((g) => ({ value: g.id, label: g.nombre }))}
          />
          <Select
            label="Área"
            value={areaId}
            onChange={(e) => setAreaId(e.target.value)}
            placeholder="Sin área"
            options={areaOptions}
          />
        </FormSection>

        <Switch checked={activo} onChange={setActivo} label="Usuario activo" />
        <FormActions onCancel={onClose} saving={saving} />
      </form>
    </Drawer>
  )
}
