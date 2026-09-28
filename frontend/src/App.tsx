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
import FlaggedWallets from './pages/FlaggedWallets'
import OperatorFingerprint from './pages/OperatorFingerprint'
import SanctionsScreening from './pages/SanctionsScreening'
import AuditLog from './pages/AuditLog'
import InvertedIndex from './pages/InvertedIndex'
import NoticeDrafting from './pages/NoticeDrafting'
import FileComplaint from './pages/FileComplaint'
import MyComplaints from './pages/MyComplaints'
import MyTicket from './pages/MyTicket'
import ExchangePortal from './pages/ExchangePortal'

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

        {/* Unguarded (Task 12 / unified-role-based-portal design doc's "Guest citizens"
            section): a guest's own opaque guest_ticket_token in the URL is their auth, same
            convention as /vasp-portal/:token above -- deliberately public rather than inside the
            citizen RequireRole branch below, since a guest checking their ticket later may not
            even still have the isGuest flag in this browser (different device/session/cleared
            storage). Task 10 originally placed this as a placeholder inside the citizen branch;
            moved out here now that it has a real page. */}
        <Route path={ROUTES.myTicket(':token')} element={<MyTicket />} />

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
            <Route path={ROUTES.flaggedWallets} element={<FlaggedWallets />} />
            <Route path={ROUTES.operatorFingerprint} element={<OperatorFingerprint />} />
            <Route path={ROUTES.sanctionsScreening} element={<SanctionsScreening />} />
            <Route path={ROUTES.auditLog} element={<AuditLog />} />
            <Route path={ROUTES.invertedIndex} element={<InvertedIndex />} />
            <Route path={ROUTES.noticeNew(':caseId')} element={<NoticeDrafting />} />

            <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
          </Route>
        </Route>

        {/* Exchange branch -- login-based equivalent of the VASP portal. Deliberately NOT
            wrapped in PageShell (that shell's Sidebar/TopBar are officer chrome -- case-workflow
            rail, "Reset demo" -- which would misrepresent what an exchange contact actually has
            access to); ExchangePortal renders its own minimal header + logout instead. */}
        <Route element={<RequireRole roles={['exchange']} />}>
          <Route path={ROUTES.exchangeHome} element={<ExchangePortal />} />
        </Route>

        {/* Citizen branch -- complaint filing + status views (Task 12). A guest passes this
            guard too (RequireRole treats isGuest as citizen-tier) without ever having a `role`
            at all -- MyTicket above is deliberately NOT in this branch (see its own comment). */}
        <Route element={<RequireRole roles={['citizen']} />}>
          <Route path={ROUTES.citizenComplaintNew} element={<FileComplaint />} />
          <Route path={ROUTES.citizenMyComplaints} element={<MyComplaints />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
