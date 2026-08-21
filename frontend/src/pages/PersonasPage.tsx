import { useState } from 'react'
import { Tabs } from '../components/ui/Overlay'
import { NombreActivoCrud } from '../components/maestros/NombreActivoCrud'
import { GruposCrud } from '../components/maestros/GruposCrud'
import { UsuariosPanel } from '../components/maestros/UsuariosPanel'
import { useLookups } from '../context/LookupsContext'

const TABS = [
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'grupos', label: 'Grupos' },
  { id: 'roles', label: 'Roles' },
  { id: 'cargos', label: 'Cargos' },
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
    </div>
  )
}
