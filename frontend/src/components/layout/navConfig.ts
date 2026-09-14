import type { LucideIcon } from 'lucide-react'
import { FolderOpen, Landmark, LayoutDashboard, Network, FileText, Route as RouteIcon } from 'lucide-react'
import { ROUTES } from '../../utils/constants'

export interface NavItem {
  key: string
  label: string
  icon: LucideIcon
  /** Present only for items with a real destination in the canonical route list. */
  to?: string
  /** Illustrative-only demo chrome count badge — no real data source yet. */
  badge?: string
}

/**
 * Sidebar nav. Only Dashboard and the case-workflow routes are "real" screens (Tasks 4-7)
 * and appear in the canonical route list (`utils/constants.ts` `ROUTES`). Cases / Trace /
 * Campaigns / Reports / Exchanges have no destination yet — they have no `to`, and the
 * Sidebar renders them as a "Coming in v2" toast (same pattern as Help & Support) instead of
 * routing to a placeholder screen that isn't part of the canonical route list.
 */
export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', to: ROUTES.dashboard, icon: LayoutDashboard },
  { key: 'cases', label: 'Cases', icon: FolderOpen, badge: '3' },
  { key: 'trace', label: 'Trace', icon: RouteIcon },
  { key: 'campaigns', label: 'Campaigns', icon: Network, badge: '1' },
  { key: 'reports', label: 'Reports', icon: FileText },
  { key: 'exchanges', label: 'Exchanges', icon: Landmark },
]
