import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  MapPinned,
  Truck,
  Users,
  ClipboardList,
  Building2,
  LandPlot,
  Clock3,
  Bus,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiGet } from '../lib/api'
import { formatFechaLarga } from '../lib/utils'
import { ErrorBanner, SkeletonRows } from '../components/ui/Feedback'
import type { DashboardResumen } from '../types/api'

const accesos = [
  {
    to: '/ubicaciones',
    title: 'Fundos',
    desc: 'Fundo, módulo, turno y lotes',
    icon: MapPinned,
  },
  {
    to: '/personas',
    title: 'Personas',
    desc: 'Usuarios, grupos, roles y áreas',
    icon: Users,
  },
  {
    to: '/flota',
    title: 'Flota',
    desc: 'Vehículos y choferes',
    icon: Truck,
  },
  {
    to: '/despacho',
    title: 'Despacho',
    desc: 'Órdenes del día',
    icon: ClipboardList,
  },
]

export function InicioPage() {
  const { user } = useAuth()
  const first = user?.nombre?.split(' ')[0] ?? 'equipo'
  const [data, setData] = useState<DashboardResumen | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setData(await apiGet<DashboardResumen>('/api/v1/dashboard/resumen'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el resumen')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const kpis = [
    { label: 'Empresas', value: data?.empresas, hint: 'activas', icon: Building2 },
    { label: 'Fundos', value: data?.fundos, hint: 'en operación', icon: LandPlot },
    { label: 'Turnos', value: data?.turnos, hint: 'configurados', icon: Clock3 },
    { label: 'Vehículos', value: data?.vehiculos, hint: 'en flota', icon: Bus },
  ]

  return (
    <div className="space-y-8">
      {/* Hero — una composición, sin cards */}
      <section className="relative overflow-hidden rounded-2xl border border-line">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(125deg, #f5f5f5 0%, #ffffff 42%, #f0f0f0 100%)',
          }}
        />
        <div
          aria-hidden
          className="absolute -top-24 -right-16 size-72 rounded-full opacity-40"
          style={{
            background: 'radial-gradient(circle, rgba(0,102,204,0.12), transparent 70%)',
          }}
        />
        <div
          aria-hidden
          className="absolute -bottom-20 left-10 size-56 rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(27,58,107,0.12), transparent 70%)',
          }}
        />

        <div className="relative px-6 py-8 sm:px-8 sm:py-10">
          <p className="text-xs font-medium tracking-[0.16em] text-teal-800 uppercase">
            Despacho Campo
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-tight text-olive-950 sm:text-4xl">
            Buen día, {first}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted capitalize">{formatFechaLarga()}</p>
        </div>
      </section>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {/* KPIs — franja tipográfica, no grid de cards */}
      <section>
        <p className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">Indicadores</p>
        {loading ? (
          <SkeletonRows rows={2} />
        ) : (
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
            {kpis.map((k) => {
              const Icon = k.icon
              return (
                <div key={k.label} className="bg-sand-0 px-5 py-5">
                  <div className="flex items-center gap-2 text-olive-600">
                    <Icon className="size-4" />
                    <span className="text-xs font-medium tracking-wide uppercase">{k.label}</span>
                  </div>
                  <p className="mt-3 font-display text-3xl text-olive-950">{k.value ?? '—'}</p>
                  <p className="mt-1 text-xs text-muted">{k.hint}</p>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Accesos — contenedores interactivos */}
        <section>
          <p className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">Accesos</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {accesos.map((a) => {
              const Icon = a.icon
              return (
                <Link
                  key={a.to}
                  to={a.to}
                  className="group flex items-start gap-3 rounded-xl border border-line bg-sand-0 px-4 py-4 transition hover:border-olive-300 hover:bg-olive-50/60"
                >
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-olive-100 text-olive-800 transition group-hover:bg-teal-800 group-hover:text-white">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium text-olive-950">{a.title}</span>
                      <ArrowRight className="size-3.5 text-muted opacity-0 transition group-hover:opacity-100" />
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">{a.desc}</span>
                  </span>
                </Link>
              )
            })}
          </div>
        </section>

        {/* Muestra del catálogo */}
        <section>
          <p className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">En el sistema</p>
          <div className="rounded-xl border border-line bg-sand-0 px-5 py-4">
            {loading ? (
              <SkeletonRows rows={4} />
            ) : (
              <ul className="space-y-4">
                {data?.empresas_muestra.map((e) => (
                  <li key={`emp-${e.id}`} className="flex gap-3">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-olive-500" />
                    <div>
                      <p className="text-sm font-medium text-olive-950">{e.razon_social}</p>
                      <p className="text-xs text-muted">RUC {e.ruc}</p>
                    </div>
                  </li>
                ))}
                {data?.vehiculos_muestra.map((v) => (
                  <li key={`veh-${v.id}`} className="flex gap-3">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-teal-700" />
                    <div>
                      <p className="text-sm font-medium tracking-wide text-olive-950">{v.placa}</p>
                      <p className="text-xs text-muted">Vehículo disponible</p>
                    </div>
                  </li>
                ))}
                {!data?.empresas_muestra.length && !data?.vehiculos_muestra.length && (
                  <li className="text-sm text-muted">Aún no hay datos para mostrar.</li>
                )}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
