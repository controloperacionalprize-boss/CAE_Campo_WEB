import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import {
  EmptyState,
  ErrorBanner,
  PageHeader,
  SkeletonRows,
  StatusPill,
} from '../components/ui/Feedback'
import { Tabs } from '../components/ui/Overlay'
import { Table, TableShell, THead, Th, Td, Tr } from '../components/ui/Table'
import { apiGet } from '../lib/api'
import type { FundoDetalle } from '../types/api'

export function FundoDetallePage() {
  const { id } = useParams()
  const fundoId = Number(id)
  const [tab, setTab] = useState('modulos')
  const [data, setData] = useState<FundoDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!Number.isFinite(fundoId)) return
    setLoading(true)
    setError(null)
    try {
      // 1 sola llamada: GET /api/v1/fundos/{id}/detalle
      // (antes: 1 por módulo + 1 por turno — patrón N+1 eliminado)
      setData(await apiGet<FundoDetalle>(`/api/v1/fundos/${fundoId}/detalle`))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar fundo')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [fundoId])

  if (loading) {
    return (
      <div>
        <SkeletonRows rows={8} />
      </div>
    )
  }

  if (error) {
    return <ErrorBanner message={error} onRetry={load} />
  }

  if (!data) {
    return (
      <EmptyState
        title="Fundo no encontrado"
        description="El fundo no existe o no está disponible."
        action={
          <Link to="/ubicaciones" className="text-sm font-medium text-teal-800 hover:underline">
            Volver a ubicaciones
          </Link>
        }
      />
    )
  }

  const { fundo, empresa, modulos, turnos, lotes, grupos } = data

  return (
    <div>
      <Link
        to="/ubicaciones"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-olive-900"
      >
        <ChevronLeft className="size-4" />
        Ubicaciones
      </Link>

      <PageHeader
        title={fundo.nombre}
        description={`${empresa.razon_social} · ${fundo.domicilio ?? 'Sin domicilio'}`}
        actions={<StatusPill activo={fundo.activo} />}
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'modulos', label: `Módulos (${modulos.length})` },
          { id: 'turnos', label: `Turnos (${turnos.length})` },
          { id: 'lotes', label: `Lotes (${lotes.length})` },
          { id: 'grupos', label: `Grupos (${grupos.length})` },
        ]}
      />

      {tab === 'modulos' && (
        <TableShell>
          <Table>
            <THead>
              <Th>Código</Th>
              <Th>Nombre</Th>
              <Th>Estado</Th>
            </THead>
            <tbody>
              {modulos.map((m) => (
                <Tr key={m.id}>
                  <Td className="font-medium">{m.codigo}</Td>
                  <Td>{m.nombre ?? '—'}</Td>
                  <Td>
                    <StatusPill activo={m.activo} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableShell>
      )}

      {tab === 'turnos' && (
        <TableShell>
          <Table>
            <THead>
              <Th>Código</Th>
              <Th>Nombre</Th>
              <Th>Módulo</Th>
              <Th>Estado</Th>
            </THead>
            <tbody>
              {turnos.map((t) => {
                const mod = modulos.find((m) => m.id === t.modulo_id)
                return (
                  <Tr key={t.id}>
                    <Td className="font-medium">{t.codigo}</Td>
                    <Td>{t.nombre ?? '—'}</Td>
                    <Td className="text-muted">{mod?.codigo ?? '—'}</Td>
                    <Td>
                      <StatusPill activo={t.activo} />
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        </TableShell>
      )}

      {tab === 'lotes' && (
        <TableShell>
          <Table>
            <THead>
              <Th>Código</Th>
              <Th>Área (ha)</Th>
              <Th>Turno</Th>
              <Th>Estado</Th>
            </THead>
            <tbody>
              {lotes.length === 0 ? (
                <Tr>
                  <Td className="text-muted">Sin lotes</Td>
                  <Td />
                  <Td />
                  <Td />
                </Tr>
              ) : (
                lotes.map((l) => {
                  const turn = turnos.find((t) => t.id === l.turno_id)
                  return (
                    <Tr key={l.id}>
                      <Td className="font-medium">{l.codigo}</Td>
                      <Td>{Number(l.area_ha).toFixed(1)}</Td>
                      <Td className="text-muted">{turn?.codigo ?? '—'}</Td>
                      <Td>
                        <StatusPill activo={l.activo} />
                      </Td>
                    </Tr>
                  )
                })
              )}
            </tbody>
          </Table>
        </TableShell>
      )}

      {tab === 'grupos' && (
        <TableShell>
          <Table>
            <THead>
              <Th>Nombre</Th>
              <Th>Estado</Th>
            </THead>
            <tbody>
              {grupos.length === 0 ? (
                <Tr>
                  <Td className="text-muted">Sin grupos asignados a este fundo</Td>
                  <Td />
                </Tr>
              ) : (
                grupos.map((g) => (
                  <Tr key={g.id}>
                    <Td className="font-medium">{g.nombre}</Td>
                    <Td>
                      <StatusPill activo={g.activo} />
                    </Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </TableShell>
      )}
    </div>
  )
}
