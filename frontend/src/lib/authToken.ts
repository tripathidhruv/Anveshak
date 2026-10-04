/** Demo identity storage for ANVESHAK's standalone/EC2 demo deployment -- there is no real auth
 * microservice reachable here any more (E:/API's Lighthouse Auth API is a separate repo and
 * isn't deployed alongside ANVESHAK for this deployment target), so this now stores the plain
 * role string (`'officer' | 'exchange' | 'citizen'`) a visitor picked on the /login role-picker
 * screen (pages/Login.tsx), never a real JWT. A per-viewer convenience, not shared/collaborative
 * state, so localStorage is still the right place per this project's own storage conventions.
 *
 * The exported function names below (`getAuthToken`/`setAuthToken`/`clearAuthToken`/
 * `hasAuthToken`) are kept exactly as they were on purpose: several officer/citizen screens
 * outside this change's scope (Cases.tsx, MyComplaints.tsx, VaspReplies.tsx, FlaggedWallets.tsx,
 * InvertedIndex.tsx) already read a token through these exact functions to attach a Bearer
 * header to real-backend calls, and none of those screens needed to change for this task --
 * they keep working unchanged, they just carry a demo role string instead of a cryptographically
 * real bearer token now. (If a real backend were ever reachable in `VITE_USE_MOCK=false` mode,
 * `backend/app/auth/jwt.py`'s `get_current_officer` would correctly reject this value -- that's
 * expected and out of scope here; this deployment keeps `VITE_USE_MOCK=true` as the default.)
 * Read by the route guard (components/auth/RequireRole.tsx) and written by pages/Login.tsx's
 * role-picker buttons. */
const STORAGE_KEY = 'anveshak_demo_role'

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

/** Guest-mode flag -- a citizen who clicked "Continue as guest" (unified-role-based-portal
 * design doc's "Guest citizens" section) has no email, no OTP, no JWT at all, so there is no
 * token for `hasAuthToken()` to find. Persisting a plain marker in localStorage (same
 * mechanism as the officer token above, not sessionStorage/in-memory-only) means a guest who
 * refreshes the complaint-filing page mid-form stays a guest instead of being bounced back to
 * /login -- `RequireRole` reads this to rehydrate `useAuthStore`'s `isGuest` after a reload,
 * exactly like it reads `getAuthToken()` to rehydrate an officer/exchange/citizen's role. */
const GUEST_MODE_KEY = 'anveshak_guest_mode'

export function setGuestMode(): void {
  try {
    window.localStorage.setItem(GUEST_MODE_KEY, '1')
  } catch {
    // see setAuthToken -- worst case, a refresh mid-guest-session re-prompts /login
  }
}

export function isGuestMode(): boolean {
  try {
    return window.localStorage.getItem(GUEST_MODE_KEY) === '1'
  } catch {
    return false
  }
}

export function clearGuestMode(): void {
  try {
    window.localStorage.removeItem(GUEST_MODE_KEY)
  } catch {
    // see setAuthToken
  }
}
