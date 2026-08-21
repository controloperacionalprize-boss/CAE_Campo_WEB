import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { listAllItems } from '../lib/api'
import type { Cargo, Chofer, Grupo, Proveedor, Rol } from '../types/api'

/**
 * Catálogos de referencia (grupos, roles, cargos, proveedores, choferes).
 * Cambian poco, así que se cargan UNA vez por sesión y se comparten entre
 * Personas, Flota, Ubicaciones, etc. — evita repetir las mismas 5 llamadas
 * cada vez que el usuario visita una pantalla.
 */

type LookupsState = {
  grupos: Grupo[]
  roles: Rol[]
  cargos: Cargo[]
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
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [choferes, setChoferes] = useState<Chofer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([
      listAllItems<Grupo>('/api/v1/grupos', { incluirInactivos: true }),
      listAllItems<Rol>('/api/v1/roles', { incluirInactivos: true }),
      listAllItems<Cargo>('/api/v1/cargos', { incluirInactivos: true }),
      listAllItems<Proveedor>('/api/v1/proveedores', { incluirInactivos: true }),
      listAllItems<Chofer>('/api/v1/choferes', { incluirInactivos: true }),
    ])
      .then(([g, r, c, p, ch]) => {
        if (cancelled) return
        setGrupos(g)
        setRoles(r)
        setCargos(c)
        setProveedores(p)
        setChoferes(ch)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos de apoyo')
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
    () => ({ grupos, roles, cargos, proveedores, choferes, loading, error, refresh }),
    [grupos, roles, cargos, proveedores, choferes, loading, error, refresh],
  )

  return <LookupsContext.Provider value={value}>{children}</LookupsContext.Provider>
}

export function useLookups() {
  const ctx = useContext(LookupsContext)
  if (!ctx) throw new Error('useLookups debe usarse dentro de LookupsProvider')
  return ctx
}
