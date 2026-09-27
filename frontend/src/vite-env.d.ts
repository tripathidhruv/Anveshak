/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the real HTTP API (Phase 2). Unused while `VITE_USE_MOCK` is true. */
  readonly VITE_API_BASE_URL: string
  /** `'false'` switches `api/index.ts` from the mock implementation to the real HTTP client. */
  readonly VITE_USE_MOCK: string
  /** Base URL for E:/API's Lighthouse Auth API (officer email+OTP login) -- a separate FastAPI
   * process from KAIZEN's own backend, so it gets its own base URL/port. See src/pages/Login.tsx. */
  readonly VITE_AUTH_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
