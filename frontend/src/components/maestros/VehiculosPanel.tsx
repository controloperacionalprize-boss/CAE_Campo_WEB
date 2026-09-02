import { useEffect, useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../ui/Button'
import { FormActions, FormSection, Input, SearchInput, Select, Switch } from '../ui/Form'
import {
  EmptyState,
  ErrorBanner,
  FilterBar,
  SkeletonRows,
  StatusPill,
} from '../ui/Feedback'
import { Drawer } from '../ui/Overlay'
import { EditButton } from '../ui/TableActions'
import { Pagination, Table, TableShell, THead, Th, Td, Tr } from '../ui/Table'
import { apiPatch, apiPost, isAbortError, listPage } from '../../lib/api'
import { useDebounce } from '../../hooks/useDebounce'
import { useToast } from '../../context/ToastContext'
import { useLookups } from '../../context/LookupsContext'
import type { Chofer, Proveedor, Vehiculo } from '../../types/api'

export function VehiculosPanel({ createSignal }: { createSignal?: number }) {
  const { proveedores, choferes, loading: lookupsLoading, error: lookupsError } = useLookups([
    'proveedores',
    'choferes',
  ])
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
  const [total, setTotal] = useState(0)
  const [proveedorId, setProveedorId] = useState('')
  const [q, setQ] = useState('')
  const debouncedQ = useDebounce(q)
  const [soloActivos, setSoloActivos] = useState(true)
  const [skip, setSkip] = useState(0)
  const [limit, setLimit] = useState(10)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Vehiculo | null>(null)
  const [creating, setCreating] = useState(false)

  const hasActiveFilters = !!proveedorId || !!q || !soloActivos

  function clearFilters() {
    setProveedorId('')
    setQ('')
    setSoloActivos(true)
    setSkip(0)
  }

  async function loadVehiculos(signal?: AbortSignal) {
    setLoading(true)
    setError(null)
    try {
      const page = await listPage<Vehiculo>('/api/v1/vehiculos', {
        incluirInactivos: !soloActivos,
        skip,
        limit,
        proveedor_id: proveedorId || undefined,
        q: debouncedQ || undefined,
        signal,
      })
      if (signal?.aborted) return
      setVehiculos(page.items)
      setTotal(page.total)
    } catch (e) {
      if (isAbortError(e)) return
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los vehículos')
      setVehiculos([])
      setTotal(0)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    const ac = new AbortController()
    void loadVehiculos(ac.signal)
    return () => ac.abort()
  }, [skip, limit, soloActivos, proveedorId, debouncedQ])

  function openCreate() {
    setEditing(null)
    setCreating(true)
  }

  useEffect(() => {
    if (!createSignal) return
    openCreate()
  }, [createSignal])

  function nombreProveedor(id: number) {
    return proveedores.find((p) => p.id === id)?.nombre ?? `#${id}`
  }
  function nombreChofer(id: number | null) {
    if (id == null) return 'Sin asignar'
    return choferes.find((c) => c.id === id)?.nombre ?? `#${id}`
  }

  return (
    <div>
      {(error || lookupsError) && (
        <ErrorBanner message={error ?? lookupsError ?? ''} onRetry={loadVehiculos} />
      )}

      <FilterBar onClear={clearFilters} hasActiveFilters={hasActiveFilters}>
        <div className="min-w-[160px] flex-1">
          <SearchInput
            label="Búsqueda"
            placeholder="Placa…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setSkip(0)
            }}
          />
        </div>
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
        <EmptyState
          title="Sin vehículos"
          description={hasActiveFilters ? 'No hay unidades con los filtros actuales.' : 'Aún no hay vehículos registrados.'}
          action={
            hasActiveFilters ? (
              <Button variant="secondary" onClick={clearFilters}>Limpiar filtros</Button>
            ) : (
              <Button leftIcon={<Plus className="size-4" />} onClick={openCreate}>Nuevo vehículo</Button>
            )
          }
        />
      ) : (
        <>
          <TableShell stickyHeader>
            <Table>
              <THead sticky>
                <Th>Placa</Th>
                <Th className="hidden sm:table-cell">Proveedor</Th>
                <Th className="hidden md:table-cell">Chofer</Th>
                <Th>Estado</Th>
                <Th className="text-right">Acciones</Th>
              </THead>
              <tbody>
                {vehiculos.map((v) => (
                  <Tr key={v.id}>
                    <Td className="font-medium tracking-wide">{v.placa}</Td>
                    <Td className="hidden sm:table-cell">{nombreProveedor(v.proveedor_id)}</Td>
                    <Td className={`hidden md:table-cell ${v.chofer_id == null ? 'text-muted' : ''}`}>
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
          <Pagination
            skip={skip}
            limit={limit}
            total={total}
            onChange={setSkip}
            onLimitChange={(n) => { setLimit(n); setSkip(0) }}
          />
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
        <FormSection title="Vehículo">
          <Input
            label="Placa"
            value={placa}
            onChange={(e) => setPlaca(e.target.value.toUpperCase())}
            error={error}
            placeholder="ABC-123"
            maxLength={15}
            required
          />
          <Select
            label="Proveedor"
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
            options={proveedores.map((p) => ({ value: p.id, label: p.nombre }))}
            required
          />
          <Select
            label="Chofer"
            value={choferId}
            onChange={(e) => setChoferId(e.target.value)}
            placeholder="Sin asignar"
            options={choferes.map((c) => ({ value: c.id, label: `${c.nombre} (${c.dni})` }))}
          />
        </FormSection>
        <Switch checked={activo} onChange={setActivo} label="Activo" />
        <FormActions onCancel={onClose} saving={saving} />
      </form>
    </Drawer>
  )
}
