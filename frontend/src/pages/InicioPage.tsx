import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, MapPinned, Truck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { apiGet } from '../lib/api'
import { formatFechaLarga } from '../lib/utils'
import { ErrorBanner, PageHeader, SkeletonRows } from '../components/ui/Feedback'
import type { DashboardResumen } from '../types/api'

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
      // 1 sola llamada: GET /api/v1/dashboard/resumen
      setData(await apiGet<DashboardResumen>('/api/v1/dashboard/resumen'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar resumen')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const cards = [
    { label: 'Empresas', value: data?.empresas, hint: 'activas' },
    { label: 'Fundos activos', value: data?.fundos, hint: 'en operación' },
    { label: 'Turnos', value: data?.turnos, hint: 'configurados' },
    { label: 'Vehículos disponibles', value: data?.vehiculos, hint: 'en flota' },
  ]

  return (
    <div>
      <PageHeader title={`Buen día, ${first}`} description={formatFechaLarga()} />

      {error && <ErrorBanner message={error} onRetry={load} />}

      <section
        className="overflow-hidden rounded-2xl border border-line bg-white"
        style={{
          backgroundImage:
            'linear-gradient(135deg, rgba(243,247,241,0.9) 0%, rgba(255,255,255,1) 40%)',
        }}
      >
        <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="border-b border-line p-6 lg:border-r lg:border-b-0">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">Resumen</p>
            {loading ? (
              <div className="mt-5">
                <SkeletonRows rows={4} />
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-8">
                {cards.map((k) => (
                  <div key={k.label}>
                    <p className="text-xs text-muted">{k.label}</p>
                    <p className="mt-1 font-display text-3xl text-olive-950">{k.value ?? '—'}</p>
                    <p className="mt-0.5 text-xs text-muted">{k.hint}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                to="/ubicaciones"
                className="inline-flex items-center gap-2 rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700"
              >
                <MapPinned className="size-4" />
                Ir a Ubicaciones
                <ArrowRight className="size-3.5 opacity-70" />
              </Link>
              <Link
                to="/flota"
                className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium text-olive-900 transition hover:bg-olive-50"
              >
                <Truck className="size-4" />
                Ir a Flota
              </Link>
            </div>
          </div>

          <div className="p-6">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">
              Resumen del día
            </p>
            {loading ? (
              <div className="mt-4">
                <SkeletonRows rows={5} />
              </div>
            ) : (
              <ul className="mt-4 space-y-4">
                {data?.empresas_muestra.map((e) => (
                  <li key={`emp-${e.id}`} className="flex gap-3">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-olive-500" />
                    <p className="text-sm text-olive-900">
                      {e.razon_social} · RUC {e.ruc}
                    </p>
                  </li>
                ))}
                {data?.vehiculos_muestra.map((v) => (
                  <li key={`veh-${v.id}`} className="flex gap-3">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-teal-700" />
                    <p className="text-sm text-olive-900">Vehículo {v.placa} disponible</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
