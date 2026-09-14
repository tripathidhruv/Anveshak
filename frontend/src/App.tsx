import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { PageShell } from './components/layout'
import { ROUTES } from './utils/constants'
import Dashboard from './pages/Dashboard'
import NewCase from './pages/NewCase'
import Tracing from './pages/Tracing'
import RouteChoice from './pages/RouteChoice'
import ExchangeAttribution from './pages/ExchangeAttribution'
import RiskScore from './pages/RiskScore'
import Evidence from './pages/Evidence'
import CaseClosed from './pages/CaseClosed'
import Campaign from './pages/Campaign'

/**
 * Route tree per the Global Constraints route list (`docs/plans/react-migration-plan.md`) —
 * exactly these 9 routes, nothing else. `PageShell` is the layout route wrapping every real
 * page; each page is a Task 2 placeholder — Tasks 4-7 replace their contents in place, same
 * file, same route. Sidebar nav items with no destination in this list (Cases, Trace,
 * Campaigns, Reports, Exchanges) render a "Coming in v2" toast instead of routing anywhere —
 * see `components/layout/Sidebar.tsx`/`navConfig.ts`. Any other URL redirects to the
 * dashboard rather than rendering as a route, so refreshing on a bad/stale URL never
 * white-screens without adding to the canonical route list.
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
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

          <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
