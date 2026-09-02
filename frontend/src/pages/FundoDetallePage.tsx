import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button } from '../components/ui/Button'
import {
  Breadcrumbs,
  EmptyState,
  ErrorBanner,
  InfoBanner,
  LoadingBlock,
  PageHeader,
  StatusPill,
} from '../components/ui/Feedback'
import { Tabs } from '../components/ui/Overlay'
import { EditButton, RowActionsMenu } from '../components/ui/TableActions'
import { Table, TableShell, THead, Th, Td, Tr } from '../components/ui/Table'
import {
  LoteFormDrawer,
  ModuloFormDrawer,
  TurnoFormDrawer,
  type LoteForm,
  type ModuloForm,
  type TurnoForm,
} from '../components/ubicaciones/UbicacionForms'
import { apiGet, isAbortError } from '../lib/api'
import { useTabParam } from '../hooks/useTabParam'
import { useToast } from '../context/ToastContext'
import type { FundoDetalle } from '../types/api'

export function FundoDetallePage() {
  const toast = useToast()
  const { id } = useParams()
  const fundoId = Number(id)
  const [tab, setTab] = useTabParam('modulos', ['modulos', 'turnos', 'lotes', 'grupos'])
  const [data, setData] = useState<FundoDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [moduloForm, setModuloForm] = useState<ModuloForm | null>(null)
  const [turnoForm, setTurnoForm] = useState<TurnoForm | null>(null)
  const [loteForm, setLoteForm] = useState<LoteForm | null>(null)

  async function load(signal?: AbortSignal) {
    if (!Number.isFinite(fundoId)) return
    setLoading(true)
    setError(null)
    try {
      const next = await apiGet<FundoDetalle>(`/api/v1/fundos/${fundoId}/detalle`, undefined, signal)
      if (signal?.aborted) return
      setData(next)
    } catch (e) {
      if (isAbortError(e)) return
      setError(e instanceof Error ? e.message : 'Error al cargar fundo')
      setData(null)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    const ac = new AbortController()
    void load(ac.signal)
    return () => ac.abort()
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
    return <LoadingBlock label="Cargando fundo…" />
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

  const createAction =
    tab === 'modulos'
      ? { label: 'Nuevo módulo', onClick: openNuevoModulo }
      : tab === 'turnos'
        ? { label: 'Nuevo turno', onClick: () => openNuevoTurno() }
        : tab === 'lotes'
          ? { label: 'Nuevo lote', onClick: () => openNuevoLote() }
          : null

  return (
    <div>
      <PageHeader
        title={fundo.nombre}
        description={`${empresa.razon_social} · ${fundo.domicilio ?? 'Sin domicilio'}`}
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: 'Inicio', to: '/' },
              { label: 'Fundos', to: '/ubicaciones' },
              { label: fundo.nombre },
            ]}
          />
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill activo={fundo.activo} />
            {createAction && (
              <Button leftIcon={<Plus className="size-4" />} onClick={createAction.onClick}>
                {createAction.label}
              </Button>
            )}
          </div>
        }
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
        <section>
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
            <TableShell stickyHeader>
              <Table>
                <THead sticky>
                  <Th>Código</Th>
                  <Th className="hidden sm:table-cell">Nombre</Th>
                  <Th>Estado</Th>
                  <Th className="text-right">Acciones</Th>
                </THead>
                <tbody>
                  {modulos.map((m) => (
                    <Tr key={m.id}>
                      <Td className="font-medium">{m.codigo}</Td>
                      <Td className="hidden sm:table-cell">{m.nombre ?? '—'}</Td>
                      <Td>
                        <StatusPill activo={m.activo} />
                      </Td>
                      <Td className="text-right">
                        <RowActionsMenu
                          actions={[
                            {
                              label: 'Nuevo turno',
                              onClick: () => {
                                setTab('turnos')
                                openNuevoTurno(m.id)
                              },
                            },
                            {
                              label: 'Editar',
                              onClick: () =>
                                setModuloForm({
                                  id: m.id,
                                  fundoId,
                                  codigo: m.codigo,
                                  nombre: m.nombre ?? '',
                                  activo: m.activo,
                                }),
                            },
                          ]}
                        />
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
        <section>
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
            <TableShell stickyHeader>
              <Table>
                <THead sticky>
                  <Th>Código</Th>
                  <Th className="hidden sm:table-cell">Nombre</Th>
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
                        <Td className="hidden sm:table-cell">{t.nombre ?? '—'}</Td>
                        <Td className="text-muted">{mod?.codigo ?? '—'}</Td>
                        <Td>
                          <StatusPill activo={t.activo} />
                        </Td>
                        <Td className="text-right">
                          <RowActionsMenu
                            actions={[
                              {
                                label: 'Nuevo lote',
                                onClick: () => {
                                  setTab('lotes')
                                  openNuevoLote(t.id)
                                },
                              },
                              {
                                label: 'Editar',
                                onClick: () =>
                                  setTurnoForm({
                                    id: t.id,
                                    moduloId: t.modulo_id,
                                    codigo: t.codigo,
                                    nombre: t.nombre ?? '',
                                    activo: t.activo,
                                  }),
                              },
                            ]}
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

      {tab === 'lotes' && (
        <section>
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
        <>
          <InfoBanner message="Los grupos se asignan desde la sección Personas. Aquí solo se muestran los vinculados a este fundo." />
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
        </>
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
