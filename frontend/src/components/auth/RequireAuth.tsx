import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { hasAuthToken } from '@/lib/authToken'

/** Layout-route guard wrapping the existing app shell: redirects to /login when there's no
 * officer token in localStorage. Applied at the app-shell level (not per-API-call) -- see
 * docs/superpowers/specs/2026-09-27-auth-and-vasp-portal-design.md, Feature 1. `/login`
 * itself is mounted outside this guard (unguarded), so it's never caught in the redirect loop. */
function RequireAuth() {
  const location = useLocation()

  if (!hasAuthToken()) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

export { RequireAuth }
