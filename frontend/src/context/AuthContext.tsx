import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

type AuthUser = {
  id?: number
  dni: string
  nombre: string
}

type AuthContextValue = {
  user: AuthUser | null
  login: (user: AuthUser) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_KEY = 'dc_web_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as AuthUser) : null
    } catch {
      return null
    }
  })

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login: (next) => {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        setUser(next)
      },
      logout: () => {
        sessionStorage.removeItem(STORAGE_KEY)
        setUser(null)
      },
    }),
    [user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
