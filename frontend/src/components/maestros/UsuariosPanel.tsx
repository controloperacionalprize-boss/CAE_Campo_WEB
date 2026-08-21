import { useEffect, useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input, Select, Switch } from '../ui/Form'
import {
  EmptyState,
  ErrorBanner,
  FilterBar,
  PageHeader,
  SkeletonRows,
  StatusPill,
} from '../ui/Feedback'
import { Drawer } from '../ui/Overlay'
import { Pagination, Table, TableShell, THead, Th, Td, Tr } from '../ui/Table'
import { apiPatch, apiPost, listPage } from '../../lib/api'
import { isValidDni } from '../../lib/utils'
import { useToast } from '../../context/ToastContext'
import { useLookups } from '../../context/LookupsContext'
import type { Cargo, Grupo, Rol, Usuario } from '../../types/api'

export function UsuariosPanel() {
  const { grupos, roles, cargos, loading: lookupsLoading, error: lookupsError } = useLookups()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [total, setTotal] = useState(0)
  const [incluirInactivos, setIncluirInactivos] = useState(true)
  const [grupoId, setGrupoId] = useState('')
  const [rolId, setRolId] = useState('')
  const [cargoId, setCargoId] = useState('')
  const [q, setQ] = useState('')
  const [skip, setSkip] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Usuario | null>(null)
  const limit = 8

  async function loadUsuarios() {
    setLoading(true)
    setError(null)
    try {
      const page = await listPage<Usuario>('/api/v1/usuarios', {
        incluirInactivos,
        skip,
        limit,
        q: q || undefined,
        grupo_id: grupoId || undefined,
        rol_id: rolId || undefined,
        cargo_id: cargoId || undefined,
      })
      setUsuarios(page.items)
      setTotal(page.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los usuarios')
      setUsuarios([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadUsuarios()
  }, [skip, limit, q, grupoId, rolId, cargoId, incluirInactivos])

  function nombreGrupo(id: number | null) {
    if (id == null) return '—'
    return grupos.find((g) => g.id === id)?.nombre ?? `#${id}`
  }
  function nombreRol(id: number | null) {
    if (id == null) return '—'
    return roles.find((r) => r.id === id)?.nombre ?? `#${id}`
  }
  function nombreCargo(id: number | null) {
    if (id == null) return '—'
    return cargos.find((c) => c.id === id)?.nombre ?? `#${id}`
  }

  return (
    <div>
      <PageHeader
        title="Usuarios"
        description="Cuentas de acceso y asignación de cargo, rol y grupo."
        actions={
          <Button
            leftIcon={<Plus className="size-4" />}
            onClick={() => {
              setEditing(null)
              setDrawerOpen(true)
            }}
          >
            Nuevo usuario
          </Button>
        }
      />

      {(error || lookupsError) && (
        <ErrorBanner message={error ?? lookupsError ?? ''} onRetry={loadUsuarios} />
      )}

      <FilterBar>
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
        <div className="min-w-[160px] flex-[1.2]">
          <Input
            label="Búsqueda"
            placeholder="DNI o nombre…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setSkip(0)
            }}
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
      </FilterBar>

      {loading ? (
        <SkeletonRows rows={6} />
      ) : total === 0 ? (
        <EmptyState title="Sin usuarios" description="No hay coincidencias con los filtros." />
      ) : (
        <>
          <TableShell>
            <Table>
              <THead>
                <Th>DNI</Th>
                <Th>Nombre</Th>
                <Th>Cargo</Th>
                <Th>Rol</Th>
                <Th>Grupo</Th>
                <Th>Activo</Th>
                <Th />
              </THead>
              <tbody>
                {usuarios.map((u) => (
                  <Tr key={u.id}>
                    <Td className="font-medium tabular-nums">{u.dni}</Td>
                    <Td>{u.nombre}</Td>
                    <Td>{nombreCargo(u.cargo_id)}</Td>
                    <Td>{nombreRol(u.rol_id)}</Td>
                    <Td className="text-muted">{nombreGrupo(u.grupo_id)}</Td>
                    <Td>
                      <StatusPill activo={u.activo} />
                    </Td>
                    <Td className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(u)
                          setDrawerOpen(true)
                        }}
                      >
                        Editar
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableShell>
          <Pagination skip={skip} limit={limit} total={total} onChange={setSkip} />
        </>
      )}

      <UsuarioDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        usuario={editing}
        grupos={grupos}
        roles={roles}
        cargos={cargos}
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
  onSaved,
}: {
  open: boolean
  onClose: () => void
  usuario: Usuario | null
  grupos: Grupo[]
  roles: Rol[]
  cargos: Cargo[]
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
  const [activo, setActivo] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDni(usuario?.dni ?? '')
    setNombre(usuario?.nombre ?? '')
    setPassword('')
    setCargoId(usuario?.cargo_id != null ? String(usuario.cargo_id) : '')
    setRolId(usuario?.rol_id != null ? String(usuario.rol_id) : '')
    setGrupoId(usuario?.grupo_id != null ? String(usuario.grupo_id) : '')
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
        <Input
          label="DNI"
          value={dni}
          onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
          error={errors.dni}
        />
        <Input
          label="Nombre completo"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          error={errors.nombre}
        />
        {isCreate && (
          <Input
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
        )}
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
        <Switch checked={activo} onChange={setActivo} label="Usuario activo" />
        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Drawer>
  )
}
