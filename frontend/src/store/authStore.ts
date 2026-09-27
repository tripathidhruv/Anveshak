import { create } from 'zustand'

/** The three real KAIZEN roles the backend's `UserRole` table can resolve an authenticated
 * email to (see `backend/app/auth/identity.py`'s `VALID_ROLES`). Guest is deliberately NOT a
 * member of this union -- a guest never has a role, they have `isGuest: true` instead (see
 * `isGuest` below), so `role` always answers "what did the backend say this verified email
 * is," never "what UI should render," which is `RequireRole`'s job. */
export type Role = 'officer' | 'exchange' | 'citizen'

interface AuthState {
  email: string | null
  role: Role | null
  /** True only for the no-login "Continue as guest" path (Task 10 brief / unified-role-based-
   * portal design doc's "Guest citizens" section) -- no email, no JWT, no `UserRole` row.
   * `role` stays `null` for a guest; `RequireRole` treats `isGuest` as citizen-tier instead of
   * folding it into the `Role` union, so every consumer that only cares about real backend
   * roles can keep switching on `role` without an extra `'guest'` case to handle. */
  isGuest: boolean
  /** Set after a successful OTP verify + `GET /api/v1/me` call resolves the real role. */
  setIdentity: (email: string, role: Role) => void
  /** Set by the Login page's "Continue as guest" button -- no API call. */
  setGuest: () => void
  /** Resets to the logged-out state (no email, no role, not a guest). */
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  email: null,
  role: null,
  isGuest: false,
  setIdentity: (email, role) => set({ email, role, isGuest: false }),
  setGuest: () => set({ email: null, role: null, isGuest: true }),
  clear: () => set({ email: null, role: null, isGuest: false }),
}))
