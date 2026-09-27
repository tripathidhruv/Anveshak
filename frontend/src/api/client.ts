const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

/** Thrown for any non-2xx response, carrying the status so callers can branch on it. */
export class ApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  // Added for the VASP-replies internal view (first caller to need an Authorization header --
  // see pages/VaspReplies.tsx) -- additive, every existing call site omits it unchanged.
  headers?: Record<string, string>
}

/**
 * Thin fetch wrapper for the real backend — scaffolded now so `api/index.ts` can point at it
 * once Phase 2 fills in `httpApi`. Not used by the mock layer (`api/mock.ts`).
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, headers } = options

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    signal,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const isJson = response.headers.get('content-type')?.includes('application/json') ?? false
  const payload: unknown = isJson ? await response.json().catch(() => undefined) : undefined

  if (!response.ok) {
    throw new ApiError(`${method} ${path} failed with ${response.status}`, response.status, payload)
  }

  return payload as T
}
