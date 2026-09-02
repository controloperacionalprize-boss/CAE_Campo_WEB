import { useEffect, useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../ui/Button'
import { FormActions, Input, SearchInput, Switch } from '../ui/Form'
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
import { isValidDni } from '../../lib/utils'
import { useDebounce } from '../../hooks/useDebounce'
import { useToast } from '../../context/ToastContext'
import type { Chofer } from '../../types/api'

type Props = { onChanged?: () => void; createSignal?: number }

export function ChoferesCrud({ onChanged, createSignal }: Props) {
  const [items, setItems] = useState<Chofer[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const debouncedQ = useDebounce(q)
  const [incluirInactivos, setIncluirInactivos] = useState(false)
  const [skip, setSkip] = useState(0)
  const [limit, setLimit] = useState(10)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Chofer | null>(null)

  async function load(signal?: AbortSignal) {
    setLoading(true)
    setError(null)
    try {
      const page = await listPage<Chofer>('/api/v1/choferes', {
        incluirInactivos,
        skip,
        limit,
        q: debouncedQ || undefined,
        signal,
      })
      if (signal?.aborted) return
      setItems(page.items)
      setTotal(page.total)
    } catch (e) {
      if (isAbortError(e)) return
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los choferes')
      setItems([])
      setTotal(0)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    const ac = new AbortController()
    void load(ac.signal)
    return () => ac.abort()
  }, [skip, limit, debouncedQ, incluirInactivos])

  function openCreate() {
    setEditing(null)
    setDrawerOpen(true)
  }

  useEffect(() => {
    if (!createSignal) return
    openCreate()
  }, [createSignal])

  const hasActiveFilters = !!q || incluirInactivos

  function clearFilters() {
    setQ('')
    setIncluirInactivos(false)
    setSkip(0)
  }

  return (
    <div>
      {error && <ErrorBanner message={error} onRetry={load} />}

      <FilterBar onClear={clearFilters} hasActiveFilters={hasActiveFilters}>
        <div className="min-w-[180px] flex-1">
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
        <EmptyState
          title="Sin choferes"
          description={hasActiveFilters ? 'No hay coincidencias.' : 'Aún no hay choferes registrados.'}
          action={
            hasActiveFilters ? (
              <Button variant="secondary" onClick={clearFilters}>Limpiar filtros</Button>
            ) : (
              <Button leftIcon={<Plus className="size-4" />} onClick={openCreate}>
                Nuevo chofer
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
                <Th>Estado</Th>
                <Th className="text-right">Acciones</Th>
              </THead>
              <tbody>
                {items.map((c) => (
                  <Tr key={c.id}>
                    <Td className="font-medium tabular-nums">{c.dni}</Td>
                    <Td>{c.nombre}</Td>
                    <Td>
                      <StatusPill activo={c.activo} />
                    </Td>
                    <Td className="text-right">
                      <EditButton
                        onClick={() => {
                          setEditing(c)
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
            onLimitChange={(n) => { setLimit(n); setSkip(0) }}
          />
        </>
      )}

      <ChoferDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        chofer={editing}
        onSaved={async () => {
          setDrawerOpen(false)
          await load()
          onChanged?.()
        }}
      />
    </div>
  )
}

function ChoferDrawer({
  open,
  onClose,
  chofer,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  chofer: Chofer | null
  onSaved: () => Promise<void>
}) {
  const toast = useToast()
  const isCreate = !chofer
  const [dni, setDni] = useState('')
  const [nombre, setNombre] = useState('')
  const [activo, setActivo] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDni(chofer?.dni ?? '')
    setNombre(chofer?.nombre ?? '')
    setActivo(chofer?.activo ?? true)
    setErrors({})
  }, [open, chofer])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!isValidDni(dni)) next.dni = 'DNI de 8 dígitos'
    if (!nombre.trim()) next.nombre = 'Requerido'
    setErrors(next)
    if (Object.keys(next).length) return

    const body = { dni, nombre: nombre.trim(), activo }
    setSaving(true)
    try {
      if (isCreate) {
        await apiPost('/api/v1/choferes', body)
        toast.success('Chofer creado')
      } else if (chofer) {
        await apiPatch(`/api/v1/choferes/${chofer.id}`, body)
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
    <Drawer open={open} onClose={onClose} title={isCreate ? 'Nuevo chofer' : 'Editar chofer'}>
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="DNI"
          value={dni}
          onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
          error={errors.dni}
        />
        <Input
          label="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          error={errors.nombre}
        />
        <Switch checked={activo} onChange={setActivo} label="Activo" />
        <FormActions onCancel={onClose} saving={saving} />
      </form>
    </Drawer>
  )
}
