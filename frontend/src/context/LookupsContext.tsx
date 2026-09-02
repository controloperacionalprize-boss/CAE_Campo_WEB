import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiGet, isAbortError } from '../lib/api'
import type { Area, Cargo, Chofer, Grupo, Proveedor, Rol } from '../types/api'

export type LookupKey = 'grupos' | 'roles' | 'cargos' | 'areas' | 'proveedores' | 'choferes'

type LookupsPayload = {
  grupos?: Grupo[]
  roles?: Rol[]
  cargos?: Cargo[]
  areas?: Area[]
  proveedores?: Proveedor[]
  choferes?: Chofer[]
}

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
  ensureLoaded: (keys: LookupKey[]) => void
}

const LiveEmpty: LookupKey[] = []

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
  const [wanted, setWanted] = useState<Set<LookupKey>>(new Set())

  const ensureLoaded = useCallback((keys: LookupKey[]) => {
    if (!keys.length) return
    setWanted((prev) => {
      let changed = false
      const next = new Set(prev)
      for (const key of keys) {
        if (!next.has(key)) {
          next.add(key)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [])

  const refresh = useCallback(() => {
    setNonce((n) => n + 1)
  }, [])

  useEffect(() => {
    if (wanted.size === 0) return
    const ac = new AbortController()
    setLoading(true)
    setError(null)
    const keys = [...wanted].join(',')

    apiGet<LookupsPayload>(
      '/api/v1/lookups',
      { keys, incluir_inactivos: true },
      ac.signal,
    )
      .then((data) => {
        if (ac.signal.aborted) return
        if (data.grupos) setGrupos(data.grupos)
        if (data.roles) setRoles(data.roles)
        if (data.cargos) setCargos(data.cargos)
        if (data.areas) setAreas(data.areas)
        if (data.proveedores) setProveedores(data.proveedores)
        if (data.choferes) setChoferes(data.choferes)
      })
      .catch((e) => {
        if (isAbortError(e)) return
        setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos de apoyo')
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

export function useLookups(keys: LookupKey[] = LiveEmpty) {
  const ctx = useContext(LookupsContext)
  if (!ctx) throw new Error('useLookups debe usarse dentro de LookupsProvider')
  const keyList = keys.join(',')
  useEffect(() => {
    if (!keyList) return
    ctx.ensureLoaded(keyList.split(',') as LookupKey[])
  }, [ctx.ensureLoaded, keyList])
  return ctx
}
