import { useState } from 'react'
import { Tabs } from '../components/ui/Overlay'
import { Input } from '../components/ui/Form'
import { NombreActivoCrud, type ExtraColumn, type ExtraField } from '../components/maestros/NombreActivoCrud'
import { GruposCrud } from '../components/maestros/GruposCrud'
import { UsuariosPanel } from '../components/maestros/UsuariosPanel'
import { useLookups } from '../context/LookupsContext'

const TABS = [
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'grupos', label: 'Grupos' },
  { id: 'roles', label: 'Roles' },
  { id: 'cargos', label: 'Cargos' },
  { id: 'areas', label: 'Áreas' },
]

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
  const [tab, setTab] = useState('usuarios')
  const { refresh } = useLookups()

  return (
    <div>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'usuarios' && <UsuariosPanel />}
      {tab === 'grupos' && <GruposCrud onChanged={refresh} />}
      {tab === 'roles' && (
        <NombreActivoCrud
          title="Roles"
          description="Permisos de acceso al sistema."
          singular="rol"
          path="/api/v1/roles"
          onChanged={refresh}
        />
      )}
      {tab === 'cargos' && (
        <NombreActivoCrud
          title="Cargos"
          description="Puestos laborales del personal."
          singular="cargo"
          path="/api/v1/cargos"
          onChanged={refresh}
        />
      )}
      {tab === 'areas' && (
        <NombreActivoCrud
          title="Áreas"
          description="Áreas operativas. Un usuario puede tener un área o ninguna."
          singular="área"
          path="/api/v1/areas"
          onChanged={refresh}
          extraColumns={AREAS_EXTRA_COLUMNS}
          extraFields={AREAS_EXTRA_FIELDS}
        />
      )}
    </div>
  )
}
