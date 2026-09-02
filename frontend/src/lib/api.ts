import type { Paginated } from '../types/api'

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
const API_KEY = import.meta.env.VITE_API_KEY ?? ''
const FETCH_TIMEOUT_MS = 20_000

export class ApiError extends Error {
  status: number
  detail: unknown

  constructor(status: number, detail: unknown, message?: string) {
    super(message ?? `Error API ${status}`)
    this.status = status
    this.detail = detail
  }
}

export function isAbortError(e: unknown): boolean {
  return (
    (e instanceof DOMException && e.name === 'AbortError') ||
    (typeof e === 'object' && e !== null && 'name' in e && (e as { name: string }).name === 'AbortError')
  )
}

export function apiHeaders(withJsonBody = false): HeadersInit {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (withJsonBody) headers['Content-Type'] = 'application/json'
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

function composeSignal(external?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS)
  if (!external) return timeout
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([external, timeout])
  return external
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
  if (status === 403) return 'No tiene permiso para esta operación'
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
    /* cuerpo no JSON */
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

async function request<T>(url: URL, init: RequestInit, callerSignal?: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, { ...init, signal: composeSignal(callerSignal) })
  } catch (e) {
    if (isAbortError(e)) {
      if (callerSignal?.aborted) throw e
      throw new ApiError(0, e, 'La solicitud tardó demasiado. Intente de nuevo.')
    }
    throw new ApiError(0, e, 'No se pudo conectar con el servidor. Verifique su conexión.')
  }
  if (!res.ok) await parseError(res)
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, ParamValue>,
  signal?: AbortSignal,
): Promise<T> {
  return request<T>(buildUrl(path, params), { headers: apiHeaders(false) }, signal)
}

export async function apiPost<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return request<T>(
    buildUrl(path),
    { method: 'POST', headers: apiHeaders(true), body: JSON.stringify(body) },
    signal,
  )
}

export async function apiPatch<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return request<T>(
    buildUrl(path),
    { method: 'PATCH', headers: apiHeaders(true), body: JSON.stringify(body) },
    signal,
  )
}

export async function listPage<T>(
  path: string,
  opts: {
    incluirInactivos?: boolean
    skip?: number
    limit?: number
    q?: string
    signal?: AbortSignal
    [key: string]: ParamValue | AbortSignal | undefined
  } = {},
): Promise<Paginated<T>> {
  const { incluirInactivos = false, skip = 0, limit = 100, signal, ...rest } = opts
  const params: Record<string, ParamValue> = {}
  for (const [k, v] of Object.entries(rest)) {
    if (v instanceof AbortSignal) continue
    params[k] = v as ParamValue
  }
  return apiGet<Paginated<T>>(
    path,
    {
      ...params,
      incluir_inactivos: incluirInactivos || undefined,
      skip,
      limit,
    },
    signal,
  )
}

export async function listAllItems<T>(
  path: string,
  opts: { incluirInactivos?: boolean; limit?: number; signal?: AbortSignal; [key: string]: ParamValue | AbortSignal | undefined } = {},
): Promise<T[]> {
  const page = await listPage<T>(path, { ...opts, skip: 0, limit: (opts.limit as number | undefined) ?? 500 })
  return page.items
}

export { API_BASE }
