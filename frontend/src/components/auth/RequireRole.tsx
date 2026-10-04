import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { clearAuthToken, getAuthToken, isGuestMode } from '@/lib/authToken'
import { useAuthStore, type Role } from '@/store/authStore'

interface RequireRoleProps {
  roles: Role[]
}

const VALID_ROLES: readonly Role[] = ['officer', 'exchange', 'citizen']

function isRole(value: string): value is Role {
  return (VALID_ROLES as readonly string[]).includes(value)
}

/** The matching placeholder demo email for a role picked on the /login role-picker (see
 * pages/Login.tsx) -- reconstructed here rather than also persisted separately, since it's a
 * deterministic function of the role alone in this demo-only, no-real-auth deployment. */
function demoEmailFor(role: Role): string {
  return `${role}@anveshak.demo`
}

/**
 * The role-aware successor to `RequireAuth`: redirects to `/login` when nobody's signed in at
 * all, shows a "not authorized" state when someone IS signed in but their role isn't one this
 * branch of the route tree is for, and otherwise renders the branch (`<Outlet />`).
 *
 * `useAuthStore` is populated in two ways, and this guard has to handle both:
 * 1. Same-session: `pages/Login.tsx` already called `setIdentity`/`setGuest` right before
 *    navigating here, so `role`/`isGuest` are already set -- no extra work needed.
 * 2. Hard refresh: the zustand store is in-memory only and resets on reload, even though the
 *    chosen role (or the guest flag) is still sitting in localStorage. So on mount, if the store
 *    is empty, this rehydrates it directly from localStorage -- no network call, no real backend
 *    involved at all any more (this deployment retired the real OTP/JWT login against E:/API's
 *    Lighthouse Auth API entirely; see pages/Login.tsx). A stored role string means `setIdentity`
 *    with that role and its matching placeholder demo email; a corrupted/unrecognised stored
 *    value is discarded; no stored role but a persisted guest flag means `setGuest()`; neither
 *    means genuinely logged out.
 *
 * `isGuest` passes any guard whose `roles` list includes `'citizen'` -- guests get citizen-
 * tier UI (Task 10 brief), without `Role` itself needing a `'guest'` member.
 */
function RequireRole({ roles }: RequireRoleProps) {
  const location = useLocation()
  const role = useAuthStore((s) => s.role)
  const isGuest = useAuthStore((s) => s.isGuest)
  const setIdentity = useAuthStore((s) => s.setIdentity)
  const setGuest = useAuthStore((s) => s.setGuest)

  const alreadyIdentified = role !== null || isGuest
  const [rehydrating, setRehydrating] = useState(!alreadyIdentified)

  useEffect(() => {
    if (alreadyIdentified) return

    // Guest flag checked first, deliberately: `pages/Login.tsx`'s role-picker cards clear the
    // guest flag when a role is picked (see `selectRole`), but "Continue as guest" is untouched
    // by this task and doesn't clear a previously-picked role's stored value the other way --
    // so if both are somehow present (e.g. someone bounced back to /login without logging out
    // first), the most recently made choice is the guest flag, and it should win.
    if (isGuestMode()) {
      setGuest()
      setRehydrating(false)
      return
    }

    const storedRole = getAuthToken()
    if (storedRole && isRole(storedRole)) {
      setIdentity(demoEmailFor(storedRole), storedRole)
    } else if (storedRole) {
      // Corrupted/unrecognised value -- never trust it silently.
      clearAuthToken()
    }
    setRehydrating(false)
    // Deliberately run once on mount only -- `alreadyIdentified` flips to true as a result of
    // this effect's own setIdentity/setGuest call, which must not re-trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (rehydrating) {
    // Brief flash while the synchronous localStorage read above resolves -- not worth a spinner
    // component for what's a same-tick read, no network round trip involved.
    return null
  }

  if (role === null && !isGuest) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  const allowed = isGuest ? roles.includes('citizen') : role !== null && roles.includes(role)
  if (!allowed) {
    return <NotAuthorized />
  }

  return <Outlet />
}

/** Signed in, but with a role this part of the app isn't for -- e.g. a citizen hitting an
 * officer-only URL directly. Deliberately not a redirect: silently bouncing to /login would
 * read as "you got logged out," which isn't what happened. */
function NotAuthorized() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background p-6 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
        Not authorized
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Your account doesn&rsquo;t have access to this part of ANVESHAK.
      </p>
    </div>
  )
}

export { RequireRole }
