import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { LookupsProvider } from './context/LookupsContext'
import { LiveEventsProvider } from './context/LiveEventsContext'
import { AppShell } from './components/layout/AppShell'
import { ProtectedRoute, RequierePermiso } from './components/ProtectedRoute'
import { LoadingBlock } from './components/ui/Feedback'
import { LoginPage } from './pages/LoginPage'
import { PERMISOS, type Permiso } from './lib/permisos'

// Cada pantalla se descarga al abrirla: el login y el inicio cargan más rápido.
const InicioPage = lazy(() => import('./pages/InicioPage').then((m) => ({ default: m.InicioPage })))
const UbicacionesPage = lazy(() => import('./pages/UbicacionesPage').then((m) => ({ default: m.UbicacionesPage })))
const FundoDetallePage = lazy(() => import('./pages/FundoDetallePage').then((m) => ({ default: m.FundoDetallePage })))
const PersonasPage = lazy(() => import('./pages/PersonasPage').then((m) => ({ default: m.PersonasPage })))
const FlotaPage = lazy(() => import('./pages/FlotaPage').then((m) => ({ default: m.FlotaPage })))
const DespachoPage = lazy(() => import('./pages/DespachoPage').then((m) => ({ default: m.DespachoPage })))
const RecepcionPage = lazy(() => import('./pages/RecepcionPage').then((m) => ({ default: m.RecepcionPage })))
const ReportesPage = lazy(() => import('./pages/ReportesPage').then((m) => ({ default: m.ReportesPage })))
const ViajesPage = lazy(() => import('./pages/ViajesPage').then((m) => ({ default: m.ViajesPage })))

function Pantalla({ permiso, children }: { permiso: Permiso; children: ReactNode }) {
  return (
    <RequierePermiso permiso={permiso}>
      <Suspense fallback={<LoadingBlock label="Cargando pantalla…" />}>{children}</Suspense>
    </RequierePermiso>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route
                element={
                  <LookupsProvider>
                    <LiveEventsProvider>
                      <AppShell />
                    </LiveEventsProvider>
                  </LookupsProvider>
                }
              >
                <Route index element={<Pantalla permiso={PERMISOS.operacionVer}><InicioPage /></Pantalla>} />
                <Route path="despacho" element={<Pantalla permiso={PERMISOS.operacionVer}><DespachoPage /></Pantalla>} />
                <Route path="viajes" element={<Pantalla permiso={PERMISOS.operacionVer}><ViajesPage /></Pantalla>} />
                <Route path="recepcion" element={<Pantalla permiso={PERMISOS.operacionVer}><RecepcionPage /></Pantalla>} />
                <Route path="reportes" element={<Pantalla permiso={PERMISOS.reportesVer}><ReportesPage /></Pantalla>} />
                <Route path="ubicaciones" element={<Pantalla permiso={PERMISOS.maestrosVer}><UbicacionesPage /></Pantalla>} />
                <Route
                  path="ubicaciones/fundos/:id"
                  element={<Pantalla permiso={PERMISOS.maestrosVer}><FundoDetallePage /></Pantalla>}
                />
                <Route path="personas" element={<Pantalla permiso={PERMISOS.maestrosVer}><PersonasPage /></Pantalla>} />
                <Route path="flota" element={<Pantalla permiso={PERMISOS.maestrosVer}><FlotaPage /></Pantalla>} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
