import type { GuiaIngreso } from '../types/api'

const SEARCH_FIELDS: Array<keyof GuiaIngreso> = [
  'codigo',
  'usuario_dni',
  'usuario_nombre',
  'fundo',
  'placa',
  'lote',
]

export type GuiaQueryFilters = {
  fecha?: string
  estado?: string
  q?: string
}

export function upsertGuia(items: GuiaIngreso[], guia: GuiaIngreso): GuiaIngreso[] {
  const idx = items.findIndex((x) => x.id === guia.id)
  if (idx < 0) return [guia, ...items]
  const current = items[idx]
  if (current.updated_at && guia.updated_at && current.updated_at > guia.updated_at) {
    return items
  }
  const next = items.slice()
  next[idx] = guia
  return next
}

export function sortGuiasByCodigoDesc(items: GuiaIngreso[]): GuiaIngreso[] {
  return [...items].sort((a, b) => b.codigo.localeCompare(a.codigo, 'es'))
}

export function applyGuiaForFecha(items: GuiaIngreso[], guia: GuiaIngreso, fecha: string): GuiaIngreso[] {
  if (guia.fecha !== fecha) return items.filter((x) => x.id !== guia.id)
  return upsertGuia(items, guia)
}

export function matchesGuiaQuery(guia: GuiaIngreso, filters: GuiaQueryFilters): boolean {
  if (filters.fecha && guia.fecha !== filters.fecha) return false
  if (filters.estado && guia.estado.toLowerCase() !== filters.estado.toLowerCase()) return false
  const q = filters.q?.trim().toLowerCase()
  if (q) {
    const hit = SEARCH_FIELDS.some((key) => String(guia[key] ?? '').toLowerCase().includes(q))
    if (!hit) return false
  }
  return true
}

export function applyGuiaWithQuery(
  items: GuiaIngreso[],
  total: number,
  guia: GuiaIngreso,
  filters: GuiaQueryFilters,
): { items: GuiaIngreso[]; total: number } {
  const existed = items.some((x) => x.id === guia.id)
  if (!matchesGuiaQuery(guia, filters)) {
    if (!existed) return { items, total }
    return { items: items.filter((x) => x.id !== guia.id), total: Math.max(0, total - 1) }
  }
  const next = sortGuiasByCodigoDesc(upsertGuia(items, guia))
  return { items: next, total: existed ? total : total + 1 }
}

export function overlayKnownGuias(
  pageItems: GuiaIngreso[],
  known: Iterable<GuiaIngreso>,
  apply: (items: GuiaIngreso[], guia: GuiaIngreso) => GuiaIngreso[],
): GuiaIngreso[] {
  let items = pageItems
  for (const guia of known) {
    items = apply(items, guia)
  }
  return items
}

export function pruneKnownGuias(pageItems: GuiaIngreso[], known: Map<number, GuiaIngreso>) {
  for (const [id, guia] of [...known.entries()]) {
    const row = pageItems.find((x) => x.id === id)
    if (row && row.updated_at >= guia.updated_at) known.delete(id)
  }
}
