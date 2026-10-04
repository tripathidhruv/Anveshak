/** Same-origin by default: Vite proxies `/api` to the FastAPI backend (see vite.config.ts). */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

/** Thrown for any non-2xx response, carrying the status and FastAPI's `detail` so screens can show it. */
export class ApiError extends Error {
  status: number
  detail: string | null

  constructor(message: string, status: number, detail: string | null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

type Init = { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; signal?: AbortSignal }

export async function request<T>(path: string, { method = 'GET', body, signal }: Init = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      signal,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError('The ANVESHAK server is not reachable. Is the backend running on port 8000?', 0, null)
  }
  const isJson = res.headers.get('content-type')?.includes('application/json') ?? false
  const payload: unknown = isJson ? await res.json().catch(() => null) : null
  if (!res.ok) {
    const d = (payload as { detail?: unknown } | null)?.detail
    // FastAPI 422s carry a list of {msg}; plain HTTPExceptions carry a string.
    const detail =
      typeof d === 'string' ? d : Array.isArray(d) ? d.map((x: { msg?: string }) => x.msg).filter(Boolean).join('; ') || null : null
    throw new ApiError(detail ?? `${method} ${path} failed (${res.status})`, res.status, detail)
  }
  return payload as T
}

/** Any thrown value → one plain-English line for the UI. */
export function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong.'
}
