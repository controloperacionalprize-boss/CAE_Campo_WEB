import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Breadcrumbs, PageHeader } from '../components/ui/Feedback'
import { NombreActivoCrud } from '../components/maestros/NombreActivoCrud'
import { ChoferesCrud } from '../components/maestros/ChoferesCrud'
import { VehiculosPanel } from '../components/maestros/VehiculosPanel'
import { useLookups } from '../context/LookupsContext'
import { useTabParam } from '../hooks/useTabParam'

const TAB_IDS = ['vehiculos', 'choferes', 'proveedores'] as const

const TAB_LABELS: Record<(typeof TAB_IDS)[number], string> = {
  vehiculos: 'Vehículos',
  choferes: 'Choferes',
  proveedores: 'Proveedores',
}

const CREATE_LABELS: Record<(typeof TAB_IDS)[number], string> = {
  vehiculos: 'Nuevo vehículo',
  choferes: 'Nuevo chofer',
  proveedores: 'Nuevo proveedor',
}

export function FlotaPage() {
  const [tab] = useTabParam('vehiculos', [...TAB_IDS])
  const { refresh } = useLookups()
  const [createSignal, setCreateSignal] = useState(0)
  const currentTab = tab as (typeof TAB_IDS)[number]
  const label = TAB_LABELS[currentTab] ?? 'Flota'

  return (
    <div>
      <PageHeader
        title={label}
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Inicio', to: '/' },
              { label: 'Flota', to: '/flota' },
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

      {tab === 'vehiculos' && <VehiculosPanel createSignal={createSignal} />}
      {tab === 'choferes' && <ChoferesCrud onChanged={refresh} createSignal={createSignal} />}
      {tab === 'proveedores' && (
        <NombreActivoCrud
          title="Proveedores"
          singular="proveedor"
          path="/api/v1/proveedores"
          onChanged={refresh}
          embedded
          createSignal={createSignal}
        />
      )}
    </div>
  )
}
