import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../ui/Button'
import { FormActions, Input, SearchInput, Switch } from '../ui/Form'
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
import { Pagination, Table, TableShell, THead, Th, Td, TdTruncate, Tr } from '../ui/Table'
import { apiPatch, apiPost, isAbortError, listPage } from '../../lib/api'
import { useDebounce } from '../../hooks/useDebounce'
import { useToast } from '../../context/ToastContext'

/** Registro mínimo con nombre + activo (cargos, roles, proveedores, etc.) */
export type NombreActivoItem = {
  id: number
  nombre: string
  activo: boolean
  [key: string]: unknown
}

export type ExtraField = {
  key: string
  label: string
  getValue: (item: NombreActivoItem | null) => string
  render: (value: string, onChange: (v: string) => void) => ReactNode
  validate?: (value: string) => string | null
  toBody: (value: string) => Record<string, unknown>
  beforeNombre?: boolean
}

export type ExtraColumn = {
  header: string
  render: (item: NombreActivoItem & Record<string, unknown>) => ReactNode
  beforeNombre?: boolean
  /** Ocultar en pantallas pequeñas */
  hideOnMobile?: boolean
}

type Props = {
  title: string
  description?: string
  singular: string
  path: string
  onChanged?: () => void
  extraFields?: ExtraField[]
  extraColumns?: ExtraColumn[]
  /** Sin título propio — para usar dentro de páginas con tabs */
  embedded?: boolean
  /** Incrementar para abrir el formulario de creación desde el header de la página */
  createSignal?: number
}

export function NombreActivoCrud({
  title,
  description,
  singular,
  path,
  onChanged,
  extraFields = [],
  extraColumns = [],
  embedded,
  createSignal,
}: Props) {
  const [items, setItems] = useState<(NombreActivoItem & Record<string, unknown>)[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const debouncedQ = useDebounce(q)
  const [incluirInactivos, setIncluirInactivos] = useState(false)
  const [skip, setSkip] = useState(0)
  const [limit, setLimit] = useState(10)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<(NombreActivoItem & Record<string, unknown>) | null>(null)

  const hasActiveFilters = !!q || incluirInactivos

  function clearFilters() {
    setQ('')
    setIncluirInactivos(false)
    setSkip(0)
  }

  async function load(signal?: AbortSignal) {
    setLoading(true)
    setError(null)
    try {
      const page = await listPage<NombreActivoItem & Record<string, unknown>>(path, {
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
      setError(e instanceof Error ? e.message : `No se pudo cargar ${title.toLowerCase()}`)
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
  }, [skip, limit, debouncedQ, incluirInactivos, path])

  function openCreate() {
    setEditing(null)
    setDrawerOpen(true)
  }

  useEffect(() => {
    if (!createSignal) return
    openCreate()
  }, [createSignal])

  const createButton = (
    <Button leftIcon={<Plus className="size-4" />} onClick={openCreate}>
      Nuevo {singular}
    </Button>
  )

  return (
    <div>
      {!embedded && <PageHeader title={title} description={description} actions={createButton} />}

      {error && <ErrorBanner message={error} onRetry={load} />}

      <FilterBar onClear={clearFilters} hasActiveFilters={hasActiveFilters}>
        <div className="min-w-[180px] flex-1">
          <SearchInput
            label="Búsqueda"
            placeholder="Nombre…"
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
          title={`Sin ${title.toLowerCase()}`}
          description={
            hasActiveFilters
              ? 'No hay coincidencias con los filtros actuales.'
              : `Aún no hay ${title.toLowerCase()} registrados.`
          }
          action={
            hasActiveFilters ? (
              <Button variant="secondary" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            ) : (
              <Button leftIcon={<Plus className="size-4" />} onClick={openCreate}>
                Nuevo {singular}
              </Button>
            )
          }
        />
      ) : (
        <>
          <TableShell stickyHeader>
            <Table>
              <THead sticky>
                {extraColumns
                  .filter((c) => c.beforeNombre)
                  .map((c) => (
                    <Th key={c.header} className={c.hideOnMobile ? 'hidden md:table-cell' : undefined}>
                      {c.header}
                    </Th>
                  ))}
                <Th>Nombre</Th>
                {extraColumns
                  .filter((c) => !c.beforeNombre)
                  .map((c) => (
                    <Th key={c.header} className={c.hideOnMobile ? 'hidden md:table-cell' : undefined}>
                      {c.header}
                    </Th>
                  ))}
                <Th>Estado</Th>
                <Th className="text-right">Acciones</Th>
              </THead>
              <tbody>
                {items.map((item) => (
                  <Tr key={item.id}>
                    {extraColumns
                      .filter((c) => c.beforeNombre)
                      .map((c) => (
                        <Td key={c.header} className={c.hideOnMobile ? 'hidden md:table-cell' : undefined}>
                          {c.render(item)}
                        </Td>
                      ))}
                    <TdTruncate className="font-medium" maxWidth="240px">
                      {item.nombre}
                    </TdTruncate>
                    {extraColumns
                      .filter((c) => !c.beforeNombre)
                      .map((c) => (
                        <Td key={c.header} className={c.hideOnMobile ? 'hidden md:table-cell' : undefined}>
                          {c.render(item)}
                        </Td>
                      ))}
                    <Td>
                      <StatusPill activo={item.activo} />
                    </Td>
                    <Td className="text-right">
                      <EditButton
                        onClick={() => {
                          setEditing(item)
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

      <NombreActivoDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        singular={singular}
        path={path}
        item={editing}
        extraFields={extraFields}
        onSaved={async () => {
          setDrawerOpen(false)
          await load()
          onChanged?.()
        }}
      />
    </div>
  )
}

function NombreActivoDrawer({
  open,
  onClose,
  singular,
  path,
  item,
  extraFields,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  singular: string
  path: string
  item: (NombreActivoItem & Record<string, unknown>) | null
  extraFields: ExtraField[]
  onSaved: () => Promise<void>
}) {
  const toast = useToast()
  const isCreate = !item
  const [nombre, setNombre] = useState('')
  const [activo, setActivo] = useState(true)
  const [extras, setExtras] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setNombre(item?.nombre ?? '')
    setActivo(item?.activo ?? true)
    const init: Record<string, string> = {}
    for (const f of extraFields) init[f.key] = f.getValue(item)
    setExtras(init)
    setErrors({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!nombre.trim()) next.nombre = 'Requerido'
    for (const f of extraFields) {
      const msg = f.validate?.(extras[f.key] ?? '')
      if (msg) next[f.key] = msg
    }
    setErrors(next)
    if (Object.keys(next).length) return

    let body: Record<string, unknown> = { nombre: nombre.trim(), activo }
    for (const f of extraFields) {
      body = { ...body, ...f.toBody(extras[f.key] ?? '') }
    }

    setSaving(true)
    try {
      if (isCreate) {
        await apiPost(path, body)
        toast.success(`${singular.charAt(0).toUpperCase()}${singular.slice(1)} creado`)
      } else if (item) {
        await apiPatch(`${path}/${item.id}`, body)
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
    <Drawer open={open} onClose={onClose} title={isCreate ? `Nuevo ${singular}` : `Editar ${singular}`}>
      <form onSubmit={submit} className="space-y-4">
        {extraFields
          .filter((f) => f.beforeNombre)
          .map((f) => (
            <div key={f.key}>
              {f.render(extras[f.key] ?? '', (v) => setExtras((prev) => ({ ...prev, [f.key]: v })))}
              {errors[f.key] && <p className="mt-1 text-xs text-danger">{errors[f.key]}</p>}
            </div>
          ))}
        <Input
          label="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          error={errors.nombre}
          required
        />
        {extraFields
          .filter((f) => !f.beforeNombre)
          .map((f) => (
            <div key={f.key}>
              {f.render(extras[f.key] ?? '', (v) => setExtras((prev) => ({ ...prev, [f.key]: v })))}
              {errors[f.key] && <p className="mt-1 text-xs text-danger">{errors[f.key]}</p>}
            </div>
          ))}
        <Switch checked={activo} onChange={setActivo} label="Activo" />
        <FormActions onCancel={onClose} saving={saving} />
      </form>
    </Drawer>
  )
}