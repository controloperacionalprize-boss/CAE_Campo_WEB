import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Breadcrumbs, PageHeader } from '../components/ui/Feedback'
import { Input } from '../components/ui/Form'
import { NombreActivoCrud, type ExtraColumn, type ExtraField } from '../components/maestros/NombreActivoCrud'
import { GruposCrud } from '../components/maestros/GruposCrud'
import { UsuariosPanel } from '../components/maestros/UsuariosPanel'
import { useLookups } from '../context/LookupsContext'
import { useTabParam } from '../hooks/useTabParam'

const TAB_IDS = ['usuarios', 'grupos', 'roles', 'cargos', 'areas'] as const

const TAB_LABELS: Record<(typeof TAB_IDS)[number], string> = {
  usuarios: 'Usuarios',
  grupos: 'Grupos',
  roles: 'Roles',
  cargos: 'Cargos',
  areas: 'Áreas',
}

const CREATE_LABELS: Record<(typeof TAB_IDS)[number], string> = {
  usuarios: 'Nuevo usuario',
  grupos: 'Nuevo grupo',
  roles: 'Nuevo rol',
  cargos: 'Nuevo cargo',
  areas: 'Nueva área',
}

const AREAS_EXTRA_COLUMNS: ExtraColumn[] = [
  {
    header: 'Prefijo',
    beforeNombre: true,
    render: (item) => String(item.prefijo ?? '—'),
  },
]

const AREAS_EXTRA_FIELDS: ExtraField[] = [
  {
    key: 'prefijo',
    label: 'Prefijo',
    beforeNombre: true,
    getValue: (item) => (item?.prefijo != null ? String(item.prefijo) : ''),
    render: (value: string, onChange: (v: string) => void) => (
      <Input
        label="Prefijo"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
        hint="Único, 1–10 letras o números (ej. CS, PR)"
      />
    ),
    validate: (value: string) =>
      /^[A-Z0-9]{1,10}$/.test(value.trim().toUpperCase())
        ? null
        : 'Use 1 a 10 letras o números, sin espacios',
    toBody: (value: string) => ({ prefijo: value.trim().toUpperCase() }),
  },
]

export function PersonasPage() {
  const [tab] = useTabParam('usuarios', [...TAB_IDS])
  const { refresh } = useLookups()
  const [createSignal, setCreateSignal] = useState(0)
  const currentTab = tab as (typeof TAB_IDS)[number]
  const label = TAB_LABELS[currentTab] ?? 'Personas'

  return (
    <div>
      <PageHeader
        title={label}
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Inicio', to: '/' },
              { label: 'Personas', to: '/personas' },
              { label },
            ]}
          />
        }
        actions={
          <Button leftIcon={<Plus className="size-4" />} onClick={() => setCreateSignal((n) => n + 1)}>
            {CREATE_LABELS[currentTab]}
          </Button>
        }
      />

      {tab === 'usuarios' && <UsuariosPanel createSignal={createSignal} />}
      {tab === 'grupos' && <GruposCrud onChanged={refresh} createSignal={createSignal} />}
      {tab === 'roles' && (
        <NombreActivoCrud
          title="Roles"
          singular="rol"
          path="/api/v1/roles"
          onChanged={refresh}
          embedded
          createSignal={createSignal}
        />
      )}
      {tab === 'cargos' && (
        <NombreActivoCrud
          title="Cargos"
          singular="cargo"
          path="/api/v1/cargos"
          onChanged={refresh}
          embedded
          createSignal={createSignal}
        />
      )}
      {tab === 'areas' && (
        <NombreActivoCrud
          title="Áreas"
          singular="área"
          path="/api/v1/areas"
          onChanged={refresh}
          embedded
          createSignal={createSignal}
          extraColumns={AREAS_EXTRA_COLUMNS}
          extraFields={AREAS_EXTRA_FIELDS}
        />
      )}
    </div>
  )
}
