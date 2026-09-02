import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown, Menu, X, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  childHref,
  isNavChildActive,
  isNavGroupActive,
  navigation,
  pageTitleFromNav,
  type NavEntry,
} from '../../config/navigation'
import { cn } from '../../lib/utils'

function BrandIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M12 3.2 20.2 7.6v8.8L12 20.8 3.8 16.4V7.6L12 3.2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M3.8 7.6 12 12l8.2-4.4M12 12v8.8" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  )
}

function BrandMark({ compact }: { compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3', compact && 'gap-2')}>
      <div className="flex size-9 items-center justify-center rounded-lg bg-olive-800 text-white">
        <BrandIcon className="size-5" />
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

function NavGroup({
  entry,
  currentTab,
  onNavigate,
}: {
  entry: NavEntry
  currentTab: string | null
  onNavigate?: () => void
}) {
  const { pathname } = useLocation()
  const Icon = entry.icon
  const groupActive = isNavGroupActive(pathname, entry)
  const hasChildren = !!entry.children?.length
  const [manualOpen, setManualOpen] = useState<boolean | null>(null)
  const open = manualOpen ?? groupActive

  useEffect(() => {
    if (groupActive) setManualOpen(null)
  }, [groupActive, pathname, currentTab])

  return (
    <div className="mb-0.5">
      <div
        className={cn(
          'flex items-center rounded-lg transition-colors',
          groupActive ? 'bg-olive-700/40' : 'hover:bg-olive-800/50',
        )}
      >
        <NavLink
          to={entry.to}
          end={entry.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition',
              isActive || groupActive ? 'text-white' : 'text-olive-200 hover:text-white',
            )
          }
        >
          <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
          <span className="truncate">{entry.label}</span>
        </NavLink>
        {hasChildren && (
          <button
            type="button"
            onClick={() => setManualOpen((v) => !(v ?? groupActive))}
            className="mr-1.5 rounded-md p-1.5 text-olive-300 transition hover:bg-olive-800 hover:text-white"
            aria-expanded={open}
            aria-label={open ? 'Contraer menú' : 'Expandir menú'}
          >
            <ChevronDown
              className={cn('size-4 transition-transform duration-200 ease-out', open && 'rotate-180')}
            />
          </button>
        )}
      </div>

      {hasChildren && (
        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-200 ease-out',
            open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden">
            <div className="mt-0.5 mb-1 ml-4 space-y-0.5 border-l border-olive-700/80 pl-2">
              {entry.children!.map((child, i) => {
                const href = childHref(entry.to, entry.defaultTab, child.tab)
                const childActive = isNavChildActive(pathname, entry, child, currentTab)
                return (
                  <NavLink
                    key={child.label}
                    to={href}
                    onClick={onNavigate}
                    style={{ transitionDelay: open ? `${i * 30}ms` : '0ms' }}
                    className={cn(
                      'block rounded-md px-2.5 py-1.5 text-xs transition-all duration-200 ease-out',
                      open ? 'translate-x-0 opacity-100' : '-translate-x-1 opacity-0',
                      childActive
                        ? 'bg-olive-800/90 font-medium text-white'
                        : 'text-olive-300 hover:bg-olive-800/50 hover:text-white',
                    )}
                    aria-current={childActive ? 'page' : undefined}
                  >
                    {child.label}
                  </NavLink>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const [searchParams] = useSearchParams()
  const currentTab = searchParams.get('tab')

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4" aria-label="Navegación principal">
      {navigation.map((entry) => (
        <NavGroup key={entry.id} entry={entry} currentTab={currentTab} onNavigate={onNavigate} />
      ))}
    </nav>
  )
}

export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const title = pageTitleFromNav(pathname, searchParams.get('tab'))

  return (
    <div className="relative min-h-screen lg:flex">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-sand-50"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 80% 50% at 100% -10%, rgba(0,102,204,0.08), transparent), radial-gradient(ellipse 60% 40% at 0% 100%, rgba(27,58,107,0.06), transparent)',
        }}
      />

      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-olive-900 lg:flex">
        <div className="border-b border-olive-800 px-4 py-5">
          <BrandMark />
        </div>
        <SidebarNav />
      </aside>

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
            'absolute inset-y-0 left-0 flex w-64 flex-col bg-olive-900 shadow-xl transition-transform duration-300 ease-out',
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
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-olive-800 hover:bg-olive-100 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu className="size-5" />
            </button>
            <div className="min-w-0 lg:hidden">
              <BrandMark compact />
            </div>
            <p className="hidden truncate text-sm font-medium text-olive-950 lg:block">{title}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-olive-950">{user?.nombre ?? 'Usuario'}</p>
              <p className="text-[11px] text-muted">DNI {user?.dni ?? '—'}</p>
            </div>
            <div
              className="flex size-9 items-center justify-center rounded-full bg-olive-200 text-xs font-semibold text-olive-900"
              title={user?.nombre}
            >
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
              <span className="sr-only">Cerrar sesión</span>
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
