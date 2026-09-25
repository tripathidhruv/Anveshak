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
import Cases from './pages/Cases'
import Trace from './pages/Trace'
import Campaigns from './pages/Campaigns'
import Reports from './pages/Reports'
import Exchanges from './pages/Exchanges'

/**
 * Route tree per the Global Constraints route list (`docs/plans/react-migration-plan.md`),
 * extended with the 5 registry screens from `docs/plans/stub-screens-plan.md`. `PageShell` is
 * the layout route wrapping every real page. Any other URL redirects to the dashboard rather
 * than rendering as a route, so refreshing on a bad/stale URL never white-screens.
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
          <Route path={ROUTES.cases} element={<Cases />} />
          <Route path={ROUTES.trace} element={<Trace />} />
          <Route path={ROUTES.campaigns} element={<Campaigns />} />
          <Route path={ROUTES.reports} element={<Reports />} />
          <Route path={ROUTES.exchanges} element={<Exchanges />} />

          <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
