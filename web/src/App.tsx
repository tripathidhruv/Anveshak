import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AppShell } from '@/app/AppShell'
import { Section } from '@/app/Section'
import Dashboard from '@/pages/Dashboard'
import Intake from '@/pages/Intake'
import Cases from '@/pages/Cases'
import Trace from '@/pages/Trace'
import Attribution from '@/pages/Attribution'
import AttributionIntel from '@/pages/AttributionIntel'
import Fingerprint from '@/pages/Fingerprint'
import Fiat from '@/pages/Fiat'
import Interdiction from '@/pages/Interdiction'
import NationalMemory from '@/pages/NationalMemory'
import Syndicates from '@/pages/Syndicates'
import Jurisdiction from '@/pages/Jurisdiction'
import Watchlists from '@/pages/Watchlists'
import RiskDiffusion from '@/pages/RiskDiffusion'
import Evidence from '@/pages/Evidence'
import CrossBorder from '@/pages/CrossBorder'
import Compliance from '@/pages/Compliance'
import Assurance from '@/pages/Assurance'
import Learning from '@/pages/Learning'
import Audit from '@/pages/Audit'

const to = (path: string) => <Navigate to={path} replace />

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'cases', element: <Section />, children: [{ index: true, element: <Cases /> }, { path: 'new', element: <Intake /> }] },
      { path: 'trace', element: <Trace /> },
      {
        path: 'attribution',
        element: <Section />,
        children: [
          { index: true, element: <Attribution /> },
          { path: 'intel', element: <AttributionIntel /> },
          { path: 'fingerprint', element: <Fingerprint /> },
        ],
      },
      { path: 'fiat', element: <Fiat /> },
      { path: 'interdiction', element: <Interdiction /> },
      {
        path: 'network',
        element: <Section />,
        children: [
          { index: true, element: <NationalMemory /> },
          { path: 'syndicates', element: <Syndicates /> },
          { path: 'dedup', element: <Jurisdiction /> },
        ],
      },
      { path: 'watchlists', element: <Section />, children: [{ index: true, element: <Watchlists /> }, { path: 'diffusion', element: <RiskDiffusion /> }] },
      {
        path: 'evidence',
        element: <Section />,
        children: [
          { index: true, element: <Evidence /> },
          { path: 'cross-border', element: <CrossBorder /> },
          { path: 'compliance', element: <Compliance /> },
        ],
      },
      {
        path: 'assurance',
        element: <Section />,
        children: [
          { index: true, element: <Assurance /> },
          { path: 'feedback', element: <Learning /> },
          { path: 'audit', element: <Audit /> },
        ],
      },
      // old paths → new homes
      { path: 'intake', element: to('/cases/new') },
      { path: 'syndicates', element: to('/network/syndicates') },
      { path: 'jurisdiction', element: to('/network/dedup') },
      { path: 'fingerprint', element: to('/attribution/fingerprint') },
      { path: 'compliance', element: to('/evidence/compliance') },
      { path: 'learning', element: to('/assurance/feedback') },
      { path: 'audit', element: to('/assurance/audit') },
      { path: '*', element: to('/') },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
