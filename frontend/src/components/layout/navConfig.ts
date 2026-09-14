import type { LucideIcon } from 'lucide-react'
import { FolderOpen, Landmark, LayoutDashboard, Network, FileText, Route as RouteIcon } from 'lucide-react'
import { ROUTES } from '../../utils/constants'

export interface NavItem {
  key: string
  label: string
  to: string
  icon: LucideIcon
  /** Illustrative-only demo chrome count badge — no real data source yet. */
  badge?: string
}

/**
 * Sidebar nav. Only Dashboard and the case-workflow routes are "real" screens (Tasks 4-7).
 * Cases / Trace / Campaigns / Reports / Exchanges are static demo chrome per the brief —
 * they still resolve to real routes (so the URL bar changes and refresh never white-screens),
 * but land on a lightweight "not part of this build" placeholder rather than inventing a
 * list-view data source that doesn't exist yet.
 */
export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', to: ROUTES.dashboard, icon: LayoutDashboard },
  { key: 'cases', label: 'Cases', to: '/cases', icon: FolderOpen, badge: '3' },
  { key: 'trace', label: 'Trace', to: '/trace', icon: RouteIcon },
  { key: 'campaigns', label: 'Campaigns', to: '/campaigns', icon: Network, badge: '1' },
  { key: 'reports', label: 'Reports', to: '/reports', icon: FileText },
  { key: 'exchanges', label: 'Exchanges', to: '/exchanges', icon: Landmark },
]
