import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { getMe } from '@/api/httpApi'
import { clearAuthToken, getAuthToken, isGuestMode } from '@/lib/authToken'
import { useAuthStore, type Role } from '@/store/authStore'

interface RequireRoleProps {
  roles: Role[]
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
 *    officer/exchange/citizen JWT (or the guest flag) is still sitting in localStorage. So on
 *    mount, if the store is empty, this rehydrates it: a stored bearer token means calling the
 *    real `GET /api/v1/me` to resolve `{email, role}` (an expired/invalid token clears itself
 *    and falls through to /login); no token but a persisted guest flag means `setGuest()`;
 *    neither means genuinely logged out.
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
  const [rehydrationFailed, setRehydrationFailed] = useState(false)

  useEffect(() => {
    if (alreadyIdentified) return

    const token = getAuthToken()
    if (token) {
      getMe(token)
        .then((me) => setIdentity(me.email, me.role))
        .catch(() => {
          clearAuthToken()
          setRehydrationFailed(true)
        })
        .finally(() => setRehydrating(false))
      return
    }

    if (isGuestMode()) {
      setGuest()
    }
    setRehydrating(false)
    // Deliberately run once on mount only -- `alreadyIdentified` flips to true as a result of
    // this effect's own setIdentity/setGuest call, which must not re-trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (rehydrating) {
    // Brief flash while GET /api/v1/me resolves after a hard refresh -- not worth a spinner
    // component for what's normally a single fast localhost round trip.
    return null
  }

  if (rehydrationFailed || (role === null && !isGuest)) {
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
        Your account doesn&rsquo;t have access to this part of KAIZEN.
      </p>
    </div>
  )
}

export { RequireRole }
