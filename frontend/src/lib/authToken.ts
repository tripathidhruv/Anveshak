/** Officer JWT storage -- a per-viewer convenience token from E:/API's Lighthouse Auth API,
 * not shared/collaborative state, so localStorage is the right place per this project's own
 * storage conventions. Read by the route guard (components/auth/RequireAuth.tsx) and written
 * by pages/Login.tsx on a successful verifyOtp call. */
const STORAGE_KEY = 'kaizen_officer_token'

export function getAuthToken(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function setAuthToken(token: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, token)
  } catch {
    // localStorage can throw in a private window or with site data blocked -- the guard
    // will simply keep redirecting to /login, which is the safe failure mode here.
  }
}

export function clearAuthToken(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // see setAuthToken
  }
}

export function hasAuthToken(): boolean {
  return getAuthToken() !== null
}
