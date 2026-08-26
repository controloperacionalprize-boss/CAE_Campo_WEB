import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Plus } from 'lucide-react'
import { Button } from '../components/ui/Button'
import {
  EmptyState,
  ErrorBanner,
  PageHeader,
  SkeletonRows,
  StatusPill,
} from '../components/ui/Feedback'
import { Tabs } from '../components/ui/Overlay'
import { EditButton } from '../components/ui/TableActions'
import { Table, TableShell, THead, Th, Td, Tr } from '../components/ui/Table'
import {
  LoteFormDrawer,
  ModuloFormDrawer,
  TurnoFormDrawer,
  type LoteForm,
  type ModuloForm,
  type TurnoForm,
} from '../components/ubicaciones/UbicacionForms'
import { apiGet } from '../lib/api'
import { useToast } from '../context/ToastContext'
import type { FundoDetalle } from '../types/api'

export function FundoDetallePage() {
  const toast = useToast()
  const { id } = useParams()
  const fundoId = Number(id)
  const [tab, setTab] = useState('modulos')
  const [data, setData] = useState<FundoDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [moduloForm, setModuloForm] = useState<ModuloForm | null>(null)
  const [turnoForm, setTurnoForm] = useState<TurnoForm | null>(null)
  const [loteForm, setLoteForm] = useState<LoteForm | null>(null)

  async function load() {
    if (!Number.isFinite(fundoId)) return
    setLoading(true)
    setError(null)
    try {
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

  const modulosOpts = useMemo(
    () =>
      (data?.modulos ?? []).map((m) => ({
        id: m.id,
        codigo: m.codigo,
        nombre: m.nombre,
      })),
    [data],
  )

  const turnosOpts = useMemo(
    () =>
      (data?.turnos ?? []).map((t) => {
        const mod = data?.modulos.find((m) => m.id === t.modulo_id)
        return {
          id: t.id,
          codigo: t.codigo,
          nombre: t.nombre,
          moduloCodigo: mod?.codigo,
        }
      }),
    [data],
  )

  function openNuevoModulo() {
    setModuloForm({ fundoId, codigo: '', nombre: '', activo: true })
  }

  function openNuevoTurno(moduloId?: number) {
    const idMod = moduloId ?? data?.modulos[0]?.id
    if (!idMod) {
      toast.error('Cree un módulo antes de agregar un turno')
      setTab('modulos')
      return
    }
    setTurnoForm({ moduloId: idMod, codigo: '', nombre: '', activo: true })
  }

  function openNuevoLote(turnoId?: number) {
    const idTurno = turnoId ?? data?.turnos[0]?.id
    if (!idTurno) {
      toast.error('Cree un turno antes de agregar un lote')
      setTab('turnos')
      return
    }
    setLoteForm({ turnoId: idTurno, codigo: '', areaHa: '', activo: true })
  }

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
            Volver a fundos
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
        Fundos
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
        <section className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" leftIcon={<Plus className="size-3.5" />} onClick={openNuevoModulo}>
              Nuevo módulo
            </Button>
          </div>
          {modulos.length === 0 ? (
            <EmptyState
              title="Sin módulos"
              description="El módulo pertenece a este fundo. Créelo para poder agregar turnos."
              action={
                <Button leftIcon={<Plus className="size-4" />} onClick={openNuevoModulo}>
                  Nuevo módulo
                </Button>
              }
            />
          ) : (
            <TableShell>
              <Table>
                <THead>
                  <Th>Código</Th>
                  <Th>Nombre</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Acciones</Th>
                </THead>
                <tbody>
                  {modulos.map((m) => (
                    <Tr key={m.id}>
                      <Td className="font-medium">{m.codigo}</Td>
                      <Td>{m.nombre ?? '—'}</Td>
                      <Td>
                        <StatusPill activo={m.activo} />
                      </Td>
                      <Td className="text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<Plus className="size-3.5" />}
                            onClick={() => {
                              setTab('turnos')
                              openNuevoTurno(m.id)
                            }}
                          >
                            Turno
                          </Button>
                          <EditButton
                            onClick={() =>
                              setModuloForm({
                                id: m.id,
                                fundoId,
                                codigo: m.codigo,
                                nombre: m.nombre ?? '',
                                activo: m.activo,
                              })
                            }
                          />
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableShell>
          )}
        </section>
      )}

      {tab === 'turnos' && (
        <section className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" leftIcon={<Plus className="size-3.5" />} onClick={() => openNuevoTurno()}>
              Nuevo turno
            </Button>
          </div>
          {turnos.length === 0 ? (
            <EmptyState
              title="Sin turnos"
              description="El turno pertenece a un módulo de este fundo."
              action={
                <Button leftIcon={<Plus className="size-4" />} onClick={() => openNuevoTurno()}>
                  Nuevo turno
                </Button>
              }
            />
          ) : (
            <TableShell>
              <Table>
                <THead>
                  <Th>Código</Th>
                  <Th>Nombre</Th>
                  <Th>Módulo</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Acciones</Th>
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
                        <Td className="text-right">
                          <div className="inline-flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              leftIcon={<Plus className="size-3.5" />}
                              onClick={() => {
                                setTab('lotes')
                                openNuevoLote(t.id)
                              }}
                            >
                              Lote
                            </Button>
                            <EditButton
                              onClick={() =>
                                setTurnoForm({
                                  id: t.id,
                                  moduloId: t.modulo_id,
                                  codigo: t.codigo,
                                  nombre: t.nombre ?? '',
                                  activo: t.activo,
                                })
                              }
                            />
                          </div>
                        </Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </Table>
            </TableShell>
          )}
        </section>
      )}

      {tab === 'lotes' && (
        <section className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" leftIcon={<Plus className="size-3.5" />} onClick={() => openNuevoLote()}>
              Nuevo lote
            </Button>
          </div>
          {lotes.length === 0 ? (
            <EmptyState
              title="Sin lotes"
              description="El lote pertenece a un turno. Indique código y hectáreas."
              action={
                <Button leftIcon={<Plus className="size-4" />} onClick={() => openNuevoLote()}>
                  Nuevo lote
                </Button>
              }
            />
          ) : (
            <TableShell>
              <Table>
                <THead>
                  <Th>Código</Th>
                  <Th>Hectáreas</Th>
                  <Th>Turno</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Acciones</Th>
                </THead>
                <tbody>
                  {lotes.map((l) => {
                    const turn = turnos.find((t) => t.id === l.turno_id)
                    return (
                      <Tr key={l.id}>
                        <Td className="font-medium">{l.codigo}</Td>
                        <Td>{Number(l.area_ha).toFixed(2)}</Td>
                        <Td className="text-muted">{turn?.codigo ?? '—'}</Td>
                        <Td>
                          <StatusPill activo={l.activo} />
                        </Td>
                        <Td className="text-right">
                          <EditButton
                            onClick={() =>
                              setLoteForm({
                                id: l.id,
                                turnoId: l.turno_id,
                                codigo: l.codigo,
                                areaHa: String(l.area_ha),
                                activo: l.activo,
                              })
                            }
                          />
                        </Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </Table>
            </TableShell>
          )}
        </section>
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

      <ModuloFormDrawer
        open={!!moduloForm}
        form={moduloForm}
        fundos={[{ id: fundoId, nombre: fundo.nombre }]}
        onClose={() => setModuloForm(null)}
        onSaved={async () => {
          setModuloForm(null)
          await load()
        }}
      />
      <TurnoFormDrawer
        open={!!turnoForm}
        form={turnoForm}
        modulos={modulosOpts}
        onClose={() => setTurnoForm(null)}
        onSaved={async () => {
          setTurnoForm(null)
          await load()
        }}
      />
      <LoteFormDrawer
        open={!!loteForm}
        form={loteForm}
        turnos={turnosOpts}
        onClose={() => setLoteForm(null)}
        onSaved={async () => {
          setLoteForm(null)
          await load()
        }}
      />
    </div>
  )
}
