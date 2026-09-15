import type { ReactNode } from 'react'
import { ShieldAlert } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { Permiso } from '../lib/permisos'
import { EmptyState } from './ui/Feedback'

export function ProtectedRoute() {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ desde: location.pathname + location.search }} />
  return <Outlet />
}

/** Pantalla restringida por rol. Ocultar el menú no basta: también se protege la URL directa. */
export function RequierePermiso({ permiso, children }: { permiso: Permiso; children: ReactNode }) {
  const { puede } = useAuth()
  if (!puede(permiso)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Sin acceso a esta sección"
        description="Su rol no tiene permiso para ver esta pantalla. Si lo necesita, pida acceso al administrador."
      />
    )
  }
  return <>{children}</>
}
