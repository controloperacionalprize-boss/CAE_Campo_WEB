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

async function parseError(res: Response): Promise<never> {
  let detail: unknown = res.statusText
  try {
    const body = await res.json()
    detail = body.detail ?? body
  } catch {
    /* ignore */
  }
  const msg =
    typeof detail === 'string'
      ? detail
      : Array.isArray(detail)
        ? detail.map((d) => d.msg ?? JSON.stringify(d)).join('; ')
        : `Error ${res.status}`
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
