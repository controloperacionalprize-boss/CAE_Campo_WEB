import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input, Switch } from '../ui/Form'
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
  /** Valor inicial al crear / editar */
  getValue: (item: NombreActivoItem | null) => string
  /** Render del control */
  render: (value: string, onChange: (v: string) => void) => ReactNode
  /** Validación opcional */
  validate?: (value: string) => string | null
  /** Incluir en body POST/PATCH */
  toBody: (value: string) => Record<string, unknown>
  /** Si es true, el campo va encima de Nombre (p. ej. prefijo de área) */
  beforeNombre?: boolean
}

export type ExtraColumn = {
  header: string
  render: (item: NombreActivoItem & Record<string, unknown>) => ReactNode
  /** Si es true, la columna va antes de Nombre */
  beforeNombre?: boolean
}

type Props = {
  title: string
  description: string
  singular: string
  path: string
  /** Tras crear/editar: refrescar LookupsContext u otros */
  onChanged?: () => void
  /** Columnas / campos extra además de nombre+activo */
  extraFields?: ExtraField[]
  extraColumns?: ExtraColumn[]
}

/**
 * CRUD reutilizable para maestros simples (nombre + activo [+ extras]).
 * Una sola lista paginada; create/edit vía drawer; 1 request por acción.
 */
export function NombreActivoCrud({
  title,
  description,
  singular,
  path,
  onChanged,
  extraFields = [],
  extraColumns = [],
}: Props) {
  const [items, setItems] = useState<(NombreActivoItem & Record<string, unknown>)[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [incluirInactivos, setIncluirInactivos] = useState(true)
  const [skip, setSkip] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<(NombreActivoItem & Record<string, unknown>) | null>(null)
  const limit = 10

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const page = await listPage<NombreActivoItem & Record<string, unknown>>(path, {
        incluirInactivos,
        skip,
        limit,
        q: q || undefined,
      })
      setItems(page.items)
      setTotal(page.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : `No se pudo cargar ${title.toLowerCase()}`)
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [skip, limit, q, incluirInactivos, path])

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button
            leftIcon={<Plus className="size-4" />}
            onClick={() => {
              setEditing(null)
              setDrawerOpen(true)
            }}
          >
            Nuevo {singular}
          </Button>
        }
      />

      {error && <ErrorBanner message={error} onRetry={load} />}

      <FilterBar>
        <div className="min-w-[180px] flex-1">
          <Input
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
        <EmptyState title={`Sin ${title.toLowerCase()}`} description="No hay coincidencias." />
      ) : (
        <>
          <TableShell>
            <Table>
              <THead>
                {extraColumns
                  .filter((c) => c.beforeNombre)
                  .map((c) => (
                    <Th key={c.header}>{c.header}</Th>
                  ))}
                <Th>Nombre</Th>
                {extraColumns
                  .filter((c) => !c.beforeNombre)
                  .map((c) => (
                    <Th key={c.header}>{c.header}</Th>
                  ))}
                <Th>Estado</Th>
                <Th />
              </THead>
              <tbody>
                {items.map((item) => (
                  <Tr key={item.id}>
                    {extraColumns
                      .filter((c) => c.beforeNombre)
                      .map((c) => (
                        <Td key={c.header}>{c.render(item)}</Td>
                      ))}
                    <Td className="font-medium">{item.nombre}</Td>
                    {extraColumns
                      .filter((c) => !c.beforeNombre)
                      .map((c) => (
                        <Td key={c.header}>{c.render(item)}</Td>
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
          <Pagination skip={skip} limit={limit} total={total} onChange={setSkip} />
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
    // extraFields es estable por pantalla; no incluirlo para evitar reset al tipear
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
