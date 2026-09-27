import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { PageShell } from './components/layout'
import { RequireRole } from './components/auth/RequireRole'
import { ROUTES } from './utils/constants'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewCase from './pages/NewCase'
import Tracing from './pages/Tracing'
import RouteChoice from './pages/RouteChoice'
import ExchangeAttribution from './pages/ExchangeAttribution'
import RiskScore from './pages/RiskScore'
import Evidence from './pages/Evidence'
import CaseClosed from './pages/CaseClosed'
import Campaign from './pages/Campaign'
import Cases from './pages/Cases'
import Trace from './pages/Trace'
import Campaigns from './pages/Campaigns'
import Reports from './pages/Reports'
import Exchanges from './pages/Exchanges'
import VaspReplies from './pages/VaspReplies'
import VaspPortal from './pages/VaspPortal'

/** Placeholder landing screens for the two role branches whose real pages Tasks 11/12 build
 * (unified-role-based-portal design doc's "Frontend shape" section). Deliberately NOT wrapped
 * in `PageShell` -- that shell's Sidebar/TopBar are officer chrome ("Cyber Cell Console" nav,
 * case-workflow rail, "Reset demo"), which would misrepresent what an exchange contact or a
 * citizen/guest actually has access to. Inline here rather than as their own files/routes
 * this task doesn't own, so Task 11/12 can replace each with a real page at the same path
 * without touching this file's routing structure again. */
function ExchangePortalPlaceholder() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background p-6 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
        Exchange portal
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        DEMO DATA · your flagged wallets and replies will appear here. This screen is coming
        soon.
      </p>
    </div>
  )
}

function CitizenPortalPlaceholder() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background p-6 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
        File a complaint
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        DEMO DATA · the complaint-filing form and your ticket status will appear here. This
        screen is coming soon.
      </p>
    </div>
  )
}

/**
 * Route tree per the Global Constraints route list (`docs/plans/react-migration-plan.md`),
 * extended with the 5 registry screens from `docs/plans/stub-screens-plan.md`, and now branched
 * by role per `docs/superpowers/specs/2026-09-27-unified-role-based-portal-design.md`:
 * officer / exchange / citizen (a guest passes as citizen-tier, see `RequireRole`). `PageShell`
 * is the officer app shell, wrapping every officer-branch page as before -- unchanged from the
 * pre-role-tree version, since Tasks 11/12 haven't replaced the exchange/citizen placeholder
 * screens above with real ones yet. Any other URL redirects to the dashboard rather than
 * rendering as a route, so refreshing on a bad/stale URL never white-screens.
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Unguarded: nobody has to be signed in already to reach the login page. */}
        <Route path="/login" element={<Login />} />

        {/* Unguarded (VASP wallet-sharing portal, Feature 2): an external exchange visitor's
            own opaque access_token in the URL is their auth -- they were never asked to sign
            in, so this route deliberately sits outside RequireRole/PageShell. Kept exactly as
            it was; the login-based `exchange` role view below is an additional way to reach
            the same data, not a replacement (design doc's "existing public VASP token-link
            portal is kept, not replaced" section). */}
        <Route path="/vasp-portal/:token" element={<VaspPortal />} />

        {/* Officer branch -- every route that existed before this task, unchanged. */}
        <Route element={<RequireRole roles={['officer']} />}>
          <Route element={<PageShell />}>
            <Route path={ROUTES.dashboard} element={<Dashboard />} />
            <Route path={ROUTES.newCase} element={<NewCase />} />
            <Route path={ROUTES.tracing(':id')} element={<Tracing />} />
            <Route path={ROUTES.routes(':id')} element={<RouteChoice />} />
            <Route path={ROUTES.exchange(':id')} element={<ExchangeAttribution />} />
            <Route path={ROUTES.risk(':id')} element={<RiskScore />} />
            <Route path={ROUTES.evidence(':id')} element={<Evidence />} />
            <Route path={ROUTES.closed(':id')} element={<CaseClosed />} />
            <Route path={ROUTES.campaign(':id')} element={<Campaign />} />
            <Route path={ROUTES.cases} element={<Cases />} />
            <Route path={ROUTES.trace} element={<Trace />} />
            <Route path={ROUTES.campaigns} element={<Campaigns />} />
            <Route path={ROUTES.reports} element={<Reports />} />
            <Route path={ROUTES.exchanges} element={<Exchanges />} />
            <Route path={ROUTES.vaspReplies} element={<VaspReplies />} />

            <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
          </Route>
        </Route>

        {/* Exchange branch -- login-based equivalent of the VASP portal (Task 11 builds the
            real screen; placeholder for now). */}
        <Route element={<RequireRole roles={['exchange']} />}>
          <Route path={ROUTES.exchangeHome} element={<ExchangePortalPlaceholder />} />
        </Route>

        {/* Citizen branch -- complaint filing + status views (Task 12 builds the real screens;
            placeholders for now). A guest passes this guard too (RequireRole treats isGuest as
            citizen-tier) without ever having a `role` at all. */}
        <Route element={<RequireRole roles={['citizen']} />}>
          <Route path={ROUTES.citizenComplaintNew} element={<CitizenPortalPlaceholder />} />
          <Route path={ROUTES.citizenMyComplaints} element={<CitizenPortalPlaceholder />} />
          <Route path={ROUTES.myTicket(':token')} element={<CitizenPortalPlaceholder />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
