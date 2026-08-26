import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { listAllItems } from '../lib/api'
import type { Area, Cargo, Chofer, Grupo, Proveedor, Rol } from '../types/api'

/**
 * Catálogos de referencia (grupos, roles, cargos, áreas, proveedores, choferes).
 * Cambian poco, así que se cargan UNA vez por sesión y se comparten entre
 * Personas, Flota, Ubicaciones, etc. — evita repetir las mismas llamadas
 * cada vez que el usuario visita una pantalla.
 */

type LookupsState = {
  grupos: Grupo[]
  roles: Rol[]
  cargos: Cargo[]
  areas: Area[]
  proveedores: Proveedor[]
  choferes: Chofer[]
  loading: boolean
  error: string | null
  refresh: () => void
}

const LookupsContext = createContext<LookupsState | null>(null)

export function LookupsProvider({ children }: { children: ReactNode }) {
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [roles, setRoles] = useState<Rol[]>([])
  const [cargos, setCargos] = useState<Cargo[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [choferes, setChoferes] = useState<Chofer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.allSettled([
      listAllItems<Grupo>('/api/v1/grupos', { incluirInactivos: true }),
      listAllItems<Rol>('/api/v1/roles', { incluirInactivos: true }),
      listAllItems<Cargo>('/api/v1/cargos', { incluirInactivos: true }),
      listAllItems<Area>('/api/v1/areas', { incluirInactivos: true }),
      listAllItems<Proveedor>('/api/v1/proveedores', { incluirInactivos: true }),
      listAllItems<Chofer>('/api/v1/choferes', { incluirInactivos: true }),
    ])
      .then((results) => {
        if (cancelled) return
        const value = <T,>(i: number, fallback: T[]): T[] =>
          results[i].status === 'fulfilled' ? (results[i] as PromiseFulfilledResult<T[]>).value : fallback
        setGrupos(value(0, []))
        setRoles(value(1, []))
        setCargos(value(2, []))
        setAreas(value(3, []))
        setProveedores(value(4, []))
        setChoferes(value(5, []))
        const failed = results.filter((r) => r.status === 'rejected')
        if (failed.length === results.length) {
          const first = failed[0] as PromiseRejectedResult
          setError(first.reason instanceof Error ? first.reason.message : 'No se pudieron cargar los datos de apoyo')
        } else if (failed.length) {
          setError('Algunos catálogos no se pudieron cargar. Recargue la página.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [nonce])

  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  const value = useMemo<LookupsState>(
    () => ({ grupos, roles, cargos, areas, proveedores, choferes, loading, error, refresh }),
    [grupos, roles, cargos, areas, proveedores, choferes, loading, error, refresh],
  )

  return <LookupsContext.Provider value={value}>{children}</LookupsContext.Provider>
}

export function useLookups() {
  const ctx = useContext(LookupsContext)
  if (!ctx) throw new Error('useLookups debe usarse dentro de LookupsProvider')
  return ctx
}
