import { BrowserRouter, Route, Routes } from 'react-router-dom'
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
import { NavStub } from './pages/NavStub'
import NotFound from './pages/NotFound'
import PrimitivesPreview from './pages/_PrimitivesPreview'

/**
 * Route tree per the Global Constraints route list (`docs/plans/react-migration-plan.md`).
 * `PageShell` is the layout route wrapping every real page; each page is a Task 2
 * placeholder — Tasks 4-7 replace their contents in place, same file, same route.
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

          {/* Sidebar demo chrome — not covered by any of the 8 build tasks, see NavStub. */}
          <Route path="/cases" element={<NavStub screenName="Cases" />} />
          <Route path="/trace" element={<NavStub screenName="Trace" />} />
          <Route path="/campaigns" element={<NavStub screenName="Campaigns" />} />
          <Route path="/reports" element={<NavStub screenName="Reports" />} />
          <Route path="/exchanges" element={<NavStub screenName="Exchanges" />} />

          <Route path="*" element={<NotFound />} />
        </Route>

        {/* Dev-only scratch page from Task 1 — not linked from any nav, kept reachable for QA. */}
        <Route path="/dev/primitives" element={<PrimitivesPreview />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
