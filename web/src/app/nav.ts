import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  BadgeCheck,
  Brain,
  FileSignature,
  Fingerprint,
  FolderKanban,
  Gavel,
  Globe2,
  LayoutGrid,
  Map,
  Network,
  Orbit,
  Radar,
  Route,
  ScanText,
  ScrollText,
  ShieldAlert,
  Waypoints,
  Database,
  Radio,
} from 'lucide-react'
import { COUNTS } from '@/data/demo'

export type Tab = { to: string; label: string; tech: string; icon: LucideIcon; isNew?: boolean }

export type NavItem = {
  to: string
  label: string
  tech: string
  icon: LucideIcon
  badge?: string
  live?: boolean
  isNew?: boolean
  /** sub-screens rendered as tabs inside this section */
  tabs?: Tab[]
}
export type NavGroup = { label: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Command Center', tech: 'Operations overview', icon: LayoutGrid },
      {
        to: '/cases',
        label: 'Cases',
        tech: 'Queue · smart intake',
        icon: FolderKanban,
        badge: String(COUNTS.cases),
        tabs: [
          { to: '/cases', label: 'Case queue', tech: 'golden-hour first', icon: FolderKanban },
          { to: '/cases/new', label: 'Smart intake', tech: 'complaint → case automatically', icon: ScanText, isNew: true },
        ],
      },
    ],
  },
  {
    label: 'Investigate',
    items: [
      { to: '/trace', label: 'Live Trace', tech: 'Causal fund-flow tracing', icon: Route },
      {
        to: '/attribution',
        label: 'Attribution',
        tech: 'Which exchange · how sure',
        icon: Gavel,
        tabs: [
          { to: '/attribution', label: 'Exchange & risk', tech: 'explainable attribution', icon: Gavel },
          { to: '/attribution/intel', label: 'Travel Rule & OSINT', tech: 'compliance records · crowd reports', icon: Globe2, isNew: true },
          { to: '/attribution/fingerprint', label: 'Operator habits', tech: 'behavioural similarity', icon: Fingerprint },
        ],
      },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      {
        to: '/network',
        label: 'National Graph',
        tech: 'SAHYOG memory · syndicates',
        icon: Network,
        tabs: [
          { to: '/network', label: 'National memory', tech: 'every wallet ever submitted', icon: Database, isNew: true },
          { to: '/network/syndicates', label: 'Syndicates', tech: 'cross-case entity resolution', icon: Waypoints },
          { to: '/network/dedup', label: 'FIR dedup & routing', tech: 'multi-state case merge', icon: Map },
        ],
      },
      { to: '/interdiction', label: 'Pre-emptive Freeze', tech: 'Next-hop prediction', icon: Radar, badge: String(COUNTS.interdiction), live: true },
      {
        to: '/watchlists',
        label: 'Sanctions & Broadcast',
        tech: 'Risk diffusion · VASP feed',
        icon: ShieldAlert,
        tabs: [
          { to: '/watchlists', label: 'Broadcast & screening', tech: 'flagged-wallet feed to exchanges', icon: Radio },
          { to: '/watchlists/diffusion', label: 'Proximity risk', tech: 'sanctions risk diffusion', icon: Orbit, isNew: true },
        ],
      },
    ],
  },
  {
    label: 'Act & assure',
    items: [
      {
        to: '/evidence',
        label: 'Notices & Routing',
        tech: 'Evidence · MLAT routing · SLA',
        icon: FileSignature,
        badge: String(COUNTS.compliance),
        tabs: [
          { to: '/evidence', label: 'Evidence & notices', tech: 'hash-sealed pack · legal drafts', icon: FileSignature },
          { to: '/evidence/cross-border', label: 'Cross-border routing', tech: 'MLAT · INTERPOL · FIU channels', icon: Globe2, isNew: true },
          { to: '/evidence/compliance', label: 'Exchange compliance', tech: 'notice SLA tracker', icon: BadgeCheck },
        ],
      },
      {
        to: '/assurance',
        label: 'Assurance',
        tech: 'Accuracy · feedback · audit',
        icon: Activity,
        tabs: [
          { to: '/assurance', label: 'Accuracy & red team', tech: 'backtest · stress test', icon: Activity },
          { to: '/assurance/feedback', label: 'Officer feedback', tech: 'active learning', icon: Brain },
          { to: '/assurance/audit', label: 'Audit ledger', tech: 'hash-chained custody log', icon: ScrollText },
        ],
      },
    ],
  },
]

export const NAV_FLAT: NavItem[] = NAV.flatMap((g) => g.items)

/** every destination, tabs included (command palette) */
export const DESTINATIONS: { to: string; label: string; tech: string; icon: LucideIcon }[] = NAV_FLAT.flatMap((n) =>
  n.tabs ? n.tabs.map((t) => ({ ...t, label: t.to === n.to ? n.label : `${n.label} · ${t.label}` })) : [n],
)

export function sectionFor(pathname: string): NavItem | undefined {
  if (pathname === '/') return NAV_FLAT[0]
  return NAV_FLAT.filter((n) => n.to !== '/').find((n) => pathname === n.to || pathname.startsWith(n.to + '/'))
}

export function tabFor(pathname: string): Tab | undefined {
  const s = sectionFor(pathname)
  return s?.tabs?.find((t) => t.to === pathname) ?? s?.tabs?.[0]
}
