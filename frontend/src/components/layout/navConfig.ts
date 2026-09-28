import type { LucideIcon } from 'lucide-react'
import {
  Ban,
  Database,
  FolderOpen,
  Fingerprint,
  Landmark,
  LayoutDashboard,
  MessagesSquare,
  Network,
  FileText,
  Route as RouteIcon,
  ScrollText,
  ShieldAlert,
} from 'lucide-react'
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

/** Sidebar nav. Every item has a real destination in the canonical route list. */
export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', to: ROUTES.dashboard, icon: LayoutDashboard },
  { key: 'cases', label: 'Cases', to: ROUTES.cases, icon: FolderOpen, badge: '3' },
  { key: 'trace', label: 'Trace', to: ROUTES.trace, icon: RouteIcon },
  { key: 'campaigns', label: 'Campaigns', to: ROUTES.campaigns, icon: Network, badge: '1' },
  { key: 'reports', label: 'Reports', to: ROUTES.reports, icon: FileText },
  { key: 'exchanges', label: 'Exchanges', to: ROUTES.exchanges, icon: Landmark },
  { key: 'vaspReplies', label: 'VASP replies', to: ROUTES.vaspReplies, icon: MessagesSquare },
  { key: 'flaggedWallets', label: 'Flagged Wallets', to: ROUTES.flaggedWallets, icon: ShieldAlert },
  { key: 'operatorFingerprint', label: 'Operator Fingerprinting', to: ROUTES.operatorFingerprint, icon: Fingerprint },
  { key: 'sanctionsScreening', label: 'Sanctions Screening', to: ROUTES.sanctionsScreening, icon: Ban },
  { key: 'auditLog', label: 'Audit Log', to: ROUTES.auditLog, icon: ScrollText },
  { key: 'invertedIndex', label: 'Inverted Index', to: ROUTES.invertedIndex, icon: Database },
]
