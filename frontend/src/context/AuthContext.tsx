import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { apiPost, configurarSesion } from '../lib/api'
import type { Permiso } from '../lib/permisos'

export type AuthUser = {
  id: number
  dni: string
  nombre: string
  rol: string | null
}

export type Sesion = {
  token: string
  expira: number
  usuario: AuthUser
  permisos: string[]
  debe_cambiar_password: boolean
}

type AuthContextValue = {
  user: AuthUser | null
  sesion: Sesion | null
  puede: (permiso: Permiso) => boolean
  login: (dni: string, password: string) => Promise<Sesion>
  cambiarPassword: (actual: string, nueva: string) => Promise<void>
  logout: (motivo?: string) => void
  motivoSalida: string | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_KEY = 'dc_web_sesion'

function leerSesion(): Sesion | null {
  try {
    sessionStorage.removeItem('dc_web_user') // formato anterior, sin token
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Sesion
    if (!s?.token || !s.expira || s.expira * 1000 <= Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    return s
  } catch {
    return null
  }
}

function guardarSesion(s: Sesion | null) {
  try {
    if (s) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* almacenamiento no disponible: la sesión vive solo en memoria */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(leerSesion)
  const [motivoSalida, setMotivoSalida] = useState<string | null>(null)
  const sesionRef = useRef(sesion)
  sesionRef.current = sesion

  const logout = useCallback((motivo?: string) => {
    guardarSesion(null)
    sesionRef.current = null
    setSesion(null)
    setMotivoSalida(motivo ?? null)
  }, [])

  // Antes de que cualquier pantalla consulte la API: el token y la salida por 401.
  const configurado = useRef(false)
  if (!configurado.current) {
    configurarSesion(
      () => sesionRef.current?.token ?? null,
      () => logout('Su sesión venció. Inicie sesión nuevamente'),
    )
    configurado.current = true
  }

  // Cierre automático al vencer el token.
  useEffect(() => {
    if (!sesion) return
    const ms = sesion.expira * 1000 - Date.now()
    const id = window.setTimeout(() => logout('Su sesión venció. Inicie sesión nuevamente'), Math.max(ms, 0))
    return () => window.clearTimeout(id)
  }, [sesion, logout])

  const aplicar = useCallback((s: Sesion) => {
    guardarSesion(s)
    sesionRef.current = s
    setSesion(s)
    setMotivoSalida(null)
  }, [])

  const login = useCallback(
    async (dni: string, password: string) => {
      const s = await apiPost<Sesion>('/api/v1/auth/login', { dni, password })
      aplicar(s)
      return s
    },
    [aplicar],
  )

  const cambiarPassword = useCallback(
    async (actual: string, nueva: string) => {
      const s = await apiPost<Sesion>('/api/v1/auth/cambiar-password', { actual, nueva })
      aplicar(s)
    },
    [aplicar],
  )

  const value = useMemo<AuthContextValue>(() => {
    const permisos = new Set(sesion?.permisos ?? [])
    return {
      user: sesion?.usuario ?? null,
      sesion,
      puede: (p) => permisos.has(p),
      login,
      cambiarPassword,
      logout,
      motivoSalida,
    }
  }, [sesion, login, cambiarPassword, logout, motivoSalida])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}

/** Muestra su contenido solo si la sesión tiene el permiso. La API lo valida igualmente. */
export function ConPermiso({ permiso, children }: { permiso: Permiso; children: ReactNode }) {
  const { puede } = useAuth()
  return puede(permiso) ? <>{children}</> : null
}

/** Altas y cambios de catálogos (fundos, personas, flota): solo con permiso de edición. */
export function SoloEditores({ children }: { children: ReactNode }) {
  return <ConPermiso permiso="maestros.editar">{children}</ConPermiso>
}
