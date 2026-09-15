import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  MapPinned,
  Users,
  Truck,
  ClipboardList,
  Route,
  PackageCheck,
  BarChart3,
} from 'lucide-react'
import { PERMISOS, type Permiso } from '../lib/permisos'

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
  /** Permiso necesario para ver la entrada (y la ruta). */
  permiso: Permiso
}

export type NavSeparator = {
  id: string
  kind: 'separator'
}

export type NavItem = NavEntry | NavSeparator

export function isNavSeparator(item: NavItem): item is NavSeparator {
  return 'kind' in item && item.kind === 'separator'
}

export const navigation: NavItem[] = [
  { id: 'inicio', to: '/', label: 'Inicio', icon: LayoutDashboard, end: true, permiso: PERMISOS.operacionVer },
  { id: 'despacho', to: '/despacho', label: 'Despacho', icon: ClipboardList, permiso: PERMISOS.operacionVer },
  { id: 'viajes', to: '/viajes', label: 'Viajes', icon: Route, permiso: PERMISOS.operacionVer },
  { id: 'recepcion', to: '/recepcion', label: 'Recepción', icon: PackageCheck, permiso: PERMISOS.operacionVer },
  { id: 'reportes', to: '/reportes', label: 'Reportes', icon: BarChart3, permiso: PERMISOS.reportesVer },
  { id: 'sep-maestros', kind: 'separator' },
  {
    id: 'ubicaciones',
    to: '/ubicaciones',
    label: 'Fundos',
    icon: MapPinned,
    permiso: PERMISOS.maestrosVer,
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
    permiso: PERMISOS.maestrosVer,
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
    permiso: PERMISOS.maestrosVer,
    defaultTab: 'vehiculos',
    children: [
      { label: 'Vehículos', tab: 'vehiculos' },
      { label: 'Choferes', tab: 'choferes' },
      { label: 'Proveedores', tab: 'proveedores' },
    ],
  },
]

/** Entradas visibles para la sesión; los separadores sin entradas debajo se omiten. */
export function navegacionVisible(puede: (p: Permiso) => boolean): NavItem[] {
  const out: NavItem[] = []
  for (const item of navigation) {
    if (isNavSeparator(item)) {
      out.push(item)
      continue
    }
    if (puede(item.permiso)) out.push(item)
  }
  return out.filter((item, i) => !isNavSeparator(item) || (i > 0 && out[i + 1] !== undefined && !isNavSeparator(out[i + 1])))
}

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
  for (const item of navigation) {
    if (isNavSeparator(item)) continue
    if (!isNavGroupActive(pathname, item)) continue
    if (item.children?.length) {
      const activeTab = tab ?? item.defaultTab ?? ''
      const child = item.children.find((c) => (c.tab ?? item.defaultTab) === activeTab)
      if (child) return child.label
    }
    return item.label
  }
  if (pathname.startsWith('/ubicaciones/fundos/')) return 'Detalle de fundo'
  return 'Despacho Campo'
}
