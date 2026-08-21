import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  MapPinned,
  Users,
  Truck,
  ClipboardList,
  Menu,
  X,
  LogOut,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { cn } from '../../lib/utils'

const nav = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard, end: true },
  { to: '/ubicaciones', label: 'Ubicaciones', icon: MapPinned },
  { to: '/personas', label: 'Personas', icon: Users },
  { to: '/flota', label: 'Flota', icon: Truck },
  { to: '/despacho', label: 'Despacho', icon: ClipboardList },
]

function BrandMark({ compact }: { compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3', compact && 'gap-2')}>
      <div className="flex size-9 items-center justify-center rounded-lg bg-olive-800 text-olive-100">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
          <path d="M5 17c2.5-5 5-7.5 7-8.5 2 .8 4.5 3.5 7 8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="9" r="1.6" fill="#7dd3c7" />
        </svg>
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="font-display text-[15px] leading-tight text-olive-50">Despacho Campo</p>
          <p className="truncate text-[11px] text-olive-300">Aquanqa</p>
        </div>
      )}
    </div>
  )
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
      {nav.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition',
              isActive
                ? 'bg-olive-700/60 text-white'
                : 'text-olive-200 hover:bg-olive-800 hover:text-white',
            )
          }
        >
          <Icon className="size-4 shrink-0 opacity-80" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative min-h-screen lg:flex">
      {/* Ambient background — soft office, no purple */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-sand-50"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 80% 50% at 100% -10%, rgba(184,201,175,0.35), transparent), radial-gradient(ellipse 60% 40% at 0% 100%, rgba(13,92,99,0.06), transparent)',
        }}
      />

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-olive-900 lg:flex">
        <div className="border-b border-olive-800 px-4 py-5">
          <BrandMark />
        </div>
        <SidebarNav />
      </aside>

      {/* Mobile drawer */}
      <div
        className={cn(
          'fixed inset-0 z-40 lg:hidden',
          open ? 'pointer-events-auto' : 'pointer-events-none',
        )}
      >
        <button
          type="button"
          className={cn('absolute inset-0 bg-olive-950/40 transition', open ? 'opacity-100' : 'opacity-0')}
          onClick={() => setOpen(false)}
          aria-label="Cerrar menú"
        />
        <aside
          className={cn(
            'absolute inset-y-0 left-0 flex w-64 flex-col bg-olive-900 shadow-xl transition-transform',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <div className="flex items-center justify-between border-b border-olive-800 px-4 py-4">
            <BrandMark />
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-olive-200">
              <X className="size-5" />
            </button>
          </div>
          <SidebarNav onNavigate={() => setOpen(false)} />
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line/80 bg-sand-0/85 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-olive-800 hover:bg-olive-100 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu className="size-5" />
            </button>
            <div className="lg:hidden">
              <BrandMark compact />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-olive-950">{user?.nombre ?? 'Usuario'}</p>
              <p className="text-[11px] text-muted">DNI {user?.dni ?? '—'}</p>
            </div>
            <div className="flex size-9 items-center justify-center rounded-full bg-olive-200 text-xs font-semibold text-olive-900">
              {(user?.nombre ?? 'U')
                .split(' ')
                .slice(0, 2)
                .map((p) => p[0])
                .join('')}
            </div>
            <button
              type="button"
              title="Cerrar sesión"
              className="rounded-lg p-2 text-muted hover:bg-olive-100 hover:text-olive-900"
              onClick={() => {
                logout()
                navigate('/login')
              }}
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
