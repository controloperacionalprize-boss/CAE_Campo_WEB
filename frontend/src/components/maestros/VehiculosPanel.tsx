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
import { EditButton } from '../ui/TableActions'
import { Pagination, Table, TableShell, THead, Th, Td, Tr } from '../ui/Table'
import { apiPatch, apiPost, listPage } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { useLookups } from '../../context/LookupsContext'
import type { Chofer, Proveedor, Vehiculo } from '../../types/api'

export function VehiculosPanel() {
  const { proveedores, choferes, loading: lookupsLoading, error: lookupsError } = useLookups()
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
  const [total, setTotal] = useState(0)
  const [proveedorId, setProveedorId] = useState('')
  const [soloActivos, setSoloActivos] = useState(true)
  const [skip, setSkip] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Vehiculo | null>(null)
  const [creating, setCreating] = useState(false)
  const limit = 8

  async function loadVehiculos() {
    setLoading(true)
    setError(null)
    try {
      const page = await listPage<Vehiculo>('/api/v1/vehiculos', {
        incluirInactivos: !soloActivos,
        skip,
        limit,
        proveedor_id: proveedorId || undefined,
      })
      setVehiculos(page.items)
      setTotal(page.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los vehículos')
      setVehiculos([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadVehiculos()
  }, [skip, limit, soloActivos, proveedorId])

  function nombreProveedor(id: number) {
    return proveedores.find((p) => p.id === id)?.nombre ?? `#${id}`
  }
  function nombreChofer(id: number | null) {
    if (id == null) return 'Sin asignar'
    return choferes.find((c) => c.id === id)?.nombre ?? `#${id}`
  }

  return (
    <div>
      <PageHeader
        title="Vehículos"
        description="Placas, proveedores y choferes asignados."
        actions={
          <Button leftIcon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            Nuevo vehículo
          </Button>
        }
      />

      {(error || lookupsError) && (
        <ErrorBanner message={error ?? lookupsError ?? ''} onRetry={loadVehiculos} />
      )}

      <FilterBar>
        <div className="min-w-[200px] flex-1">
          <Select
            label="Proveedor"
            value={proveedorId}
            onChange={(e) => {
              setProveedorId(e.target.value)
              setSkip(0)
            }}
            placeholder={lookupsLoading ? 'Cargando…' : 'Todos'}
            options={proveedores.map((p) => ({ value: p.id, label: p.nombre }))}
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

      {loading ? (
        <SkeletonRows rows={5} />
      ) : total === 0 ? (
        <EmptyState title="Sin vehículos" description="No hay unidades con los filtros actuales." />
      ) : (
        <>
          <TableShell>
            <Table>
              <THead>
                <Th>Placa</Th>
                <Th>Proveedor</Th>
                <Th>Chofer</Th>
                <Th>Activo</Th>
                <Th />
              </THead>
              <tbody>
                {vehiculos.map((v) => (
                  <Tr key={v.id}>
                    <Td className="font-medium tracking-wide">{v.placa}</Td>
                    <Td>{nombreProveedor(v.proveedor_id)}</Td>
                    <Td className={v.chofer_id == null ? 'text-muted' : ''}>
                      {nombreChofer(v.chofer_id)}
                    </Td>
                    <Td>
                      <StatusPill activo={v.activo} />
                    </Td>
                    <Td className="text-right">
                      <EditButton onClick={() => setEditing(v)} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableShell>
          <Pagination skip={skip} limit={limit} total={total} onChange={setSkip} />
        </>
      )}

      <VehiculoFormDrawer
        open={creating}
        onClose={() => setCreating(false)}
        vehiculo={null}
        proveedores={proveedores.filter((p) => p.activo)}
        choferes={choferes.filter((c) => c.activo)}
        onSaved={async () => {
          setCreating(false)
          await loadVehiculos()
        }}
      />

      <VehiculoFormDrawer
        open={!!editing}
        onClose={() => setEditing(null)}
        vehiculo={editing}
        proveedores={proveedores.filter((p) => p.activo)}
        choferes={choferes.filter((c) => c.activo)}
        onSaved={async () => {
          setEditing(null)
          await loadVehiculos()
        }}
      />
    </div>
  )
}

function VehiculoFormDrawer({
  open,
  onClose,
  vehiculo,
  proveedores,
  choferes,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  vehiculo: Vehiculo | null
  proveedores: Proveedor[]
  choferes: Chofer[]
  onSaved: () => Promise<void>
}) {
  const toast = useToast()
  const isCreate = !vehiculo
  const [placa, setPlaca] = useState('')
  const [choferId, setChoferId] = useState('')
  const [proveedorId, setProveedorId] = useState('')
  const [activo, setActivo] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setPlaca(vehiculo?.placa ?? '')
    setChoferId(vehiculo?.chofer_id != null ? String(vehiculo.chofer_id) : '')
    setProveedorId(
      vehiculo ? String(vehiculo.proveedor_id) : proveedores[0] ? String(proveedores[0].id) : '',
    )
    setActivo(vehiculo?.activo ?? true)
    setError('')
  }, [open, vehiculo, proveedores])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!placa.trim()) {
      setError('Ingrese la placa')
      return
    }
    if (!proveedorId) {
      setError('Seleccione un proveedor')
      return
    }

    const body = {
      placa: placa.trim().toUpperCase(),
      proveedor_id: Number(proveedorId),
      chofer_id: choferId ? Number(choferId) : null,
      activo,
    }

    setSaving(true)
    try {
      if (isCreate) {
        await apiPost('/api/v1/vehiculos', body)
        toast.success('Vehículo creado')
      } else if (vehiculo) {
        await apiPatch(`/api/v1/vehiculos/${vehiculo.id}`, body)
        toast.success('Cambios guardados')
      }
      await onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title={isCreate ? 'Nuevo vehículo' : `Editar ${vehiculo?.placa}`}>
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Placa"
          value={placa}
          onChange={(e) => setPlaca(e.target.value.toUpperCase())}
          error={error}
          placeholder="ABC-123"
          maxLength={15}
        />
        <Select
          label="Proveedor"
          value={proveedorId}
          onChange={(e) => setProveedorId(e.target.value)}
          options={proveedores.map((p) => ({ value: p.id, label: p.nombre }))}
        />
        <Select
          label="Chofer"
          value={choferId}
          onChange={(e) => setChoferId(e.target.value)}
          placeholder="Sin asignar"
          options={choferes.map((c) => ({ value: c.id, label: `${c.nombre} (${c.dni})` }))}
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
    </Drawer>
  )
}
