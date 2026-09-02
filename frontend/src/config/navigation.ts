import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  MapPinned,
  Users,
  Truck,
  ClipboardList,
} from 'lucide-react'

export type NavChild = {
  label: string
  /** Si se omite, es la vista por defecto del grupo */
  tab?: string
}

export type NavEntry = {
  id: string
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  defaultTab?: string
  children?: NavChild[]
}

export const navigation: NavEntry[] = [
  { id: 'inicio', to: '/', label: 'Inicio', icon: LayoutDashboard, end: true },
  {
    id: 'ubicaciones',
    to: '/ubicaciones',
    label: 'Fundos',
    icon: MapPinned,
    defaultTab: 'fundos',
    children: [
      { label: 'Fundos', tab: 'fundos' },
      { label: 'Módulos', tab: 'modulos' },
      { label: 'Turnos', tab: 'turnos' },
      { label: 'Lotes', tab: 'lotes' },
    ],
  },
  {
    id: 'personas',
    to: '/personas',
    label: 'Personas',
    icon: Users,
    defaultTab: 'usuarios',
    children: [
      { label: 'Usuarios', tab: 'usuarios' },
      { label: 'Grupos', tab: 'grupos' },
      { label: 'Roles', tab: 'roles' },
      { label: 'Cargos', tab: 'cargos' },
      { label: 'Áreas', tab: 'areas' },
    ],
  },
  {
    id: 'flota',
    to: '/flota',
    label: 'Flota',
    icon: Truck,
    defaultTab: 'vehiculos',
    children: [
      { label: 'Vehículos', tab: 'vehiculos' },
      { label: 'Choferes', tab: 'choferes' },
      { label: 'Proveedores', tab: 'proveedores' },
    ],
  },
  { id: 'despacho', to: '/despacho', label: 'Despacho', icon: ClipboardList },
]

export function childHref(parentTo: string, defaultTab: string | undefined, tab?: string) {
  const t = tab ?? defaultTab
  if (!t || t === defaultTab) return parentTo
  return `${parentTo}?tab=${t}`
}

export function isNavGroupActive(pathname: string, entry: NavEntry): boolean {
  if (entry.end) return pathname === entry.to
  if (entry.to === '/ubicaciones') {
    return pathname === '/ubicaciones' || pathname.startsWith('/ubicaciones/')
  }
  return pathname === entry.to || pathname.startsWith(`${entry.to}/`)
}

export function isNavChildActive(
  pathname: string,
  entry: NavEntry,
  child: NavChild,
  currentTab: string | null,
): boolean {
  if (!isNavGroupActive(pathname, entry)) return false
  const childTab = child.tab ?? entry.defaultTab ?? ''
  const activeTab = currentTab ?? entry.defaultTab ?? ''
  return childTab === activeTab
}

export function pageTitleFromNav(pathname: string, tab: string | null): string {
  for (const entry of navigation) {
    if (!isNavGroupActive(pathname, entry)) continue
    if (entry.children?.length) {
      const activeTab = tab ?? entry.defaultTab ?? ''
      const child = entry.children.find((c) => (c.tab ?? entry.defaultTab) === activeTab)
      if (child) return child.label
    }
    return entry.label
  }
  if (pathname.startsWith('/ubicaciones/fundos/')) return 'Detalle de fundo'
  return 'Despacho Campo'
}
