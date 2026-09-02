import type { EmpresaNodo } from '../types/api'

/** Etiqueta corta: código, o nombre si no hay código. Nunca ambos. */
export function labelCodigo(codigo: string, nombre?: string | null): string {
  const c = codigo.trim()
  if (c) return c
  return nombre?.trim() || '—'
}

/** Tooltip con el nombre cuando difiere del código mostrado. */
export function labelCodigoTitle(codigo: string, nombre?: string | null): string | undefined {
  const c = codigo.trim()
  const n = nombre?.trim()
  if (!n || !c) return undefined
  if (c.toLowerCase() === n.toLowerCase()) return undefined
  return n
}

export type TurnoContext = {
  turnoId: number
  turnoCodigo: string
  turnoNombre: string | null
  moduloId: number
  moduloCodigo: string
  moduloNombre: string | null
  fundoId: number
  fundoNombre: string
  empresaId: number
  empresaNombre: string
}

/** Mapa turno_id → jerarquía completa (empresa → fundo → módulo → turno) */
export function buildTurnoContextMap(arbol: EmpresaNodo[]): Map<number, TurnoContext> {
  const map = new Map<number, TurnoContext>()
  for (const e of arbol) {
    for (const f of e.fundos) {
      for (const m of f.modulos) {
        for (const t of m.turnos) {
          map.set(t.id, {
            turnoId: t.id,
            turnoCodigo: t.codigo,
            turnoNombre: t.nombre,
            moduloId: m.id,
            moduloCodigo: m.codigo,
            moduloNombre: m.nombre,
            fundoId: f.id,
            fundoNombre: f.nombre,
            empresaId: e.id,
            empresaNombre: e.razon_social,
          })
        }
      }
    }
  }
  return map
}

export function eligibleTurnoIds(
  arbol: EmpresaNodo[],
  filters: { empresaId?: string; fundoId?: string; moduloId?: string; turnoId?: string },
): number[] {
  const ids: number[] = []
  for (const e of arbol) {
    if (filters.empresaId && e.id !== Number(filters.empresaId)) continue
    for (const f of e.fundos) {
      if (filters.fundoId && f.id !== Number(filters.fundoId)) continue
      for (const m of f.modulos) {
        if (filters.moduloId && m.id !== Number(filters.moduloId)) continue
        for (const t of m.turnos) {
          if (filters.turnoId && t.id !== Number(filters.turnoId)) continue
          ids.push(t.id)
        }
      }
    }
  }
  return ids
}
