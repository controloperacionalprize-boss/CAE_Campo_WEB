import { useEffect, useMemo, useState } from 'react'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Form'
import { EmptyState, EstadoDespacho, FilterBar, PageHeader } from '../components/ui/Feedback'
import { Table, TableShell, THead, Th, Td, Tr } from '../components/ui/Table'
import { listAllItems } from '../lib/api'
import { useToast } from '../context/ToastContext'
import type { DespachoOrden, Fundo } from '../types/api'

/** Placeholder: aún no hay endpoint de despacho. Demo local con fundos reales. */
const DEMO: DespachoOrden[] = [
  {
    id: 1,
    codigo: 'DSP-DEMO-001',
    fundo_id: 0,
    fecha: new Date().toISOString().slice(0, 10),
    estado: 'Pendiente',
    placa: '—',
    chofer: '—',
    destino: 'Packing',
  },
  {
    id: 2,
    codigo: 'DSP-DEMO-002',
    fundo_id: 0,
    fecha: new Date().toISOString().slice(0, 10),
    estado: 'En ruta',
    placa: '—',
    chofer: '—',
    destino: 'Planta',
  },
]

export function DespachoPage() {
  const toast = useToast()
  const today = new Date().toISOString().slice(0, 10)
  const [fecha, setFecha] = useState(today)
  const [fundoId, setFundoId] = useState('')
  const [fundos, setFundos] = useState<Fundo[]>([])
  const [usarDemo, setUsarDemo] = useState(false)

  useEffect(() => {
    // 1 sola llamada, catálogo pequeño de fundos activos
    void listAllItems<Fundo>('/api/v1/fundos', { limit: 500 })
      .then(setFundos)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'No se pudieron cargar los fundos'))
  }, [])

  const fuente = useMemo(() => {
    if (!usarDemo) return [] as DespachoOrden[]
    const firstFundo = fundos[0]?.id ?? 0
    return DEMO.map((d, i) => ({
      ...d,
      fundo_id: fundos[i % Math.max(fundos.length, 1)]?.id ?? firstFundo,
      fecha,
    }))
  }, [usarDemo, fundos, fecha])

  const filtered = fuente.filter((d) => {
    if (d.fecha !== fecha) return false
    if (fundoId && d.fundo_id !== Number(fundoId)) return false
    return true
  })

  function nombreFundo(id: number) {
    return fundos.find((f) => f.id === id)?.nombre ?? '—'
  }

  return (
    <div>
      <PageHeader
        title="Despacho"
        description="Órdenes del día por fundo y estado."
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setUsarDemo((v) => !v)
              toast.success(usarDemo ? 'Ejemplo oculto' : 'Ejemplo cargado')
            }}
          >
            {usarDemo ? 'Ocultar ejemplo' : 'Ver ejemplo'}
          </Button>
        }
      />

      <FilterBar>
        <div className="min-w-[160px]">
          <Input label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="min-w-[200px] flex-1">
          <Select
            label="Fundo"
            value={fundoId}
            onChange={(e) => setFundoId(e.target.value)}
            placeholder="Todos los fundos"
            options={fundos.map((f) => ({ value: f.id, label: f.nombre }))}
          />
        </div>
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          title="Sin despachos para este día"
          description="No hay órdenes para esta fecha. Cuando el módulo de despacho esté activo, aparecerán aquí."
          action={
            <Button variant="secondary" onClick={() => setUsarDemo(true)}>
              Ver ejemplo
            </Button>
          }
        />
      ) : (
        <TableShell>
          <Table>
            <THead>
              <Th>Código</Th>
              <Th>Fundo</Th>
              <Th>Destino</Th>
              <Th>Vehículo</Th>
              <Th>Chofer</Th>
              <Th>Estado</Th>
            </THead>
            <tbody>
              {filtered.map((d) => (
                <Tr key={d.id}>
                  <Td className="font-medium">{d.codigo}</Td>
                  <Td>{nombreFundo(d.fundo_id)}</Td>
                  <Td>{d.destino}</Td>
                  <Td className="tracking-wide">{d.placa}</Td>
                  <Td>{d.chofer}</Td>
                  <Td>
                    <EstadoDespacho estado={d.estado} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableShell>
      )}
    </div>
  )
}
