import { useState } from 'react'
import { Tabs } from '../components/ui/Overlay'
import { NombreActivoCrud } from '../components/maestros/NombreActivoCrud'
import { ChoferesCrud } from '../components/maestros/ChoferesCrud'
import { VehiculosPanel } from '../components/maestros/VehiculosPanel'
import { useLookups } from '../context/LookupsContext'

const TABS = [
  { id: 'vehiculos', label: 'Vehículos' },
  { id: 'choferes', label: 'Choferes' },
  { id: 'proveedores', label: 'Proveedores' },
]

export function FlotaPage() {
  const [tab, setTab] = useState('vehiculos')
  const { refresh } = useLookups()

  return (
    <div>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'vehiculos' && <VehiculosPanel />}
      {tab === 'choferes' && <ChoferesCrud onChanged={refresh} />}
      {tab === 'proveedores' && (
        <NombreActivoCrud
          title="Proveedores"
          description="Empresas de transporte y servicios de flota."
          singular="proveedor"
          path="/api/v1/proveedores"
          onChanged={refresh}
        />
      )}
    </div>
  )
}
