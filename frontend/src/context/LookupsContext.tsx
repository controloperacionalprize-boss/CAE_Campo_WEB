import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isAbortError, listAllItems } from '../lib/api'
import type { Area, Cargo, Chofer, Grupo, Proveedor, Rol } from '../types/api'

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
  ensureLoaded: () => void
}

const LookupsContext = createContext<LookupsState | null>(null)

export function LookupsProvider({ children }: { children: ReactNode }) {
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [roles, setRoles] = useState<Rol[]>([])
  const [cargos, setCargos] = useState<Cargo[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [choferes, setChoferes] = useState<Chofer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const [wanted, setWanted] = useState(false)

  const ensureLoaded = useCallback(() => setWanted(true), [])
  const refresh = useCallback(() => {
    setWanted(true)
    setNonce((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!wanted) return
    const ac = new AbortController()
    setLoading(true)
    setError(null)

    Promise.allSettled([
      listAllItems<Grupo>('/api/v1/grupos', { incluirInactivos: true, signal: ac.signal }),
      listAllItems<Rol>('/api/v1/roles', { incluirInactivos: true, signal: ac.signal }),
      listAllItems<Cargo>('/api/v1/cargos', { incluirInactivos: true, signal: ac.signal }),
      listAllItems<Area>('/api/v1/areas', { incluirInactivos: true, signal: ac.signal }),
      listAllItems<Proveedor>('/api/v1/proveedores', { incluirInactivos: true, signal: ac.signal }),
      listAllItems<Chofer>('/api/v1/choferes', { incluirInactivos: true, signal: ac.signal }),
    ])
      .then((results) => {
        if (ac.signal.aborted) return
        const aborted = results.some(
          (r) => r.status === 'rejected' && isAbortError(r.reason),
        )
        if (aborted) return
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
        if (!ac.signal.aborted) setLoading(false)
      })

    return () => ac.abort()
  }, [wanted, nonce])

  const value = useMemo<LookupsState>(
    () => ({
      grupos,
      roles,
      cargos,
      areas,
      proveedores,
      choferes,
      loading,
      error,
      refresh,
      ensureLoaded,
    }),
    [grupos, roles, cargos, areas, proveedores, choferes, loading, error, refresh, ensureLoaded],
  )

  return <LookupsContext.Provider value={value}>{children}</LookupsContext.Provider>
}

export function useLookups() {
  const ctx = useContext(LookupsContext)
  if (!ctx) throw new Error('useLookups debe usarse dentro de LookupsProvider')
  useEffect(() => {
    ctx.ensureLoaded()
  }, [ctx.ensureLoaded])
  return ctx
}
