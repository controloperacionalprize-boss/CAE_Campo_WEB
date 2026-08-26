import type { Paginated } from '../types/api'

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
const API_KEY = import.meta.env.VITE_API_KEY ?? ''

export class ApiError extends Error {
  status: number
  detail: unknown

  constructor(status: number, detail: unknown, message?: string) {
    super(message ?? `Error API ${status}`)
    this.status = status
    this.detail = detail
  }
}

export function apiHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  if (API_KEY) headers['X-API-Key'] = API_KEY
  return headers
}

type ParamValue = string | number | boolean | null | undefined

function buildUrl(path: string, params?: Record<string, ParamValue>) {
  const base = API_BASE || window.location.origin
  const url = new URL(path.startsWith('/') ? path : `/${path}`, `${base}/`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return
      url.searchParams.set(k, String(v))
    })
  }
  return url
}

function messageFromDetail(detail: unknown, status: number): string {
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail)) {
    const parts = detail
      .map((d) => {
        if (typeof d === 'string') return d
        if (d && typeof d === 'object') {
          const o = d as { mensaje?: unknown; msg?: unknown; message?: unknown }
          const v = o.mensaje ?? o.msg ?? o.message
          return typeof v === 'string' ? v : undefined
        }
        return undefined
      })
      .filter((x): x is string => typeof x === 'string' && x.length > 0)
    if (parts.length) return parts.join(' ')
  }
  if (detail && typeof detail === 'object') {
    const obj = detail as { msg?: unknown; message?: unknown; detail?: unknown }
    const nested = obj.message ?? obj.msg ?? obj.detail
    if (typeof nested === 'string' && nested.trim()) return nested
  }
  if (status === 401) return 'No autorizado. Revise la clave de acceso'
  if (status === 404) return 'No se encontró el recurso solicitado'
  if (status === 409) return 'Conflicto con un registro existente'
  if (status === 422) return 'Hay datos inválidos en la solicitud'
  if (status === 429) return 'Demasiadas solicitudes. Espere un momento'
  if (status >= 500) return 'Error interno del servidor. Intente más tarde'
  return `Error ${status}`
}

async function parseError(res: Response): Promise<never> {
  let body: Record<string, unknown> | null = null
  try {
    body = (await res.json()) as Record<string, unknown>
  } catch {
    /* ignore */
  }
  const detail = body?.detail ?? body
  const fromErrors = Array.isArray(body?.errors)
    ? (body.errors as Array<{ mensaje?: string }>)
        .map((e) => e.mensaje)
        .filter((x): x is string => Boolean(x))
        .join(' ')
    : ''
  const msg =
    (typeof detail === 'string' && detail.trim() && detail) ||
    fromErrors ||
    messageFromDetail(detail, res.status)
  throw new ApiError(res.status, detail, msg)
}

export async function apiGet<T>(path: string, params?: Record<string, ParamValue>): Promise<T> {
  const res = await fetch(buildUrl(path, params), { headers: apiHeaders() })
  if (!res.ok) await parseError(res)
  return res.json() as Promise<T>
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) await parseError(res)
  return res.json() as Promise<T>
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: 'PATCH',
    headers: apiHeaders(),
    body: JSON.stringify(body),
  })
  if (!res.ok) await parseError(res)
  return res.json() as Promise<T>
}

/**
 * Lista paginada — SIEMPRE 1 sola llamada HTTP.
 * `incluirInactivos: true` usa el parámetro `incluir_inactivos` del backend
 * (el propio servidor combina activos+inactivos); nunca dispares 2 fetch aquí.
 */
export async function listPage<T>(
  path: string,
  opts: {
    incluirInactivos?: boolean
    skip?: number
    limit?: number
    q?: string
    [key: string]: ParamValue
  } = {},
): Promise<Paginated<T>> {
  const { incluirInactivos = false, skip = 0, limit = 100, ...rest } = opts
  return apiGet<Paginated<T>>(path, {
    ...rest,
    incluir_inactivos: incluirInactivos || undefined,
    skip,
    limit,
  })
}

/** Trae todas las páginas de un catálogo pequeño (roles, cargos, etc.) en 1 llamada. */
export async function listAllItems<T>(
  path: string,
  opts: { incluirInactivos?: boolean; limit?: number; [key: string]: ParamValue } = {},
): Promise<T[]> {
  const page = await listPage<T>(path, { ...opts, skip: 0, limit: opts.limit ?? 500 })
  return page.items
}

export { API_BASE }
