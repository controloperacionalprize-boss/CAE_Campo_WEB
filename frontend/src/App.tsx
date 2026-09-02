import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { LookupsProvider } from './context/LookupsContext'
import { LiveEventsProvider } from './context/LiveEventsContext'
import { AppShell } from './components/layout/AppShell'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { InicioPage } from './pages/InicioPage'
import { UbicacionesPage } from './pages/UbicacionesPage'
import { FundoDetallePage } from './pages/FundoDetallePage'
import { PersonasPage } from './pages/PersonasPage'
import { FlotaPage } from './pages/FlotaPage'
import { DespachoPage } from './pages/DespachoPage'

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
                <Route index element={<InicioPage />} />
                <Route path="ubicaciones" element={<UbicacionesPage />} />
                <Route path="ubicaciones/fundos/:id" element={<FundoDetallePage />} />
                <Route path="personas" element={<PersonasPage />} />
                <Route path="flota" element={<FlotaPage />} />
                <Route path="despacho" element={<DespachoPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
