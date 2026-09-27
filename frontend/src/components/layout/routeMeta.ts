import { matchPath } from 'react-router-dom'
import { ROUTES } from '../../utils/constants'

/**
 * Route patterns that participate in the 7-step case workflow — the StepRail is visible
 * on exactly these, and nowhere else. Deliberately a single source of truth (an allowlist
 * of in-flow patterns) rather than a per-page flag, so Dashboard/CaseClosed/Campaign/the
 * nav-chrome stubs are excluded by construction instead of needing an exclusion list kept
 * in sync by hand.
 */
const RAIL_VISIBLE_PATTERNS: string[] = [
  ROUTES.newCase,
  ROUTES.tracing(':id'),
  ROUTES.routes(':id'),
  ROUTES.exchange(':id'),
  ROUTES.risk(':id'),
  ROUTES.evidence(':id'),
]

/** Maps a route pattern to the RAIL_STEPS key it represents (see utils/constants.ts). */
const RAIL_STEP_BY_PATTERN: Array<{ pattern: string; key: string }> = [
  { pattern: ROUTES.newCase, key: 'newcase' },
  { pattern: ROUTES.tracing(':id'), key: 'trace' },
  { pattern: ROUTES.routes(':id'), key: 'route' },
  { pattern: ROUTES.exchange(':id'), key: 'exchange' },
  { pattern: ROUTES.risk(':id'), key: 'risk' },
  { pattern: ROUTES.evidence(':id'), key: 'evidence' },
]

/** Human page titles for the TopBar, keyed by route pattern (supports dynamic `:id` segments). */
const PAGE_TITLES: Array<{ pattern: string; title: string }> = [
  { pattern: ROUTES.dashboard, title: 'Dashboard' },
  { pattern: ROUTES.newCase, title: 'New Case' },
  { pattern: ROUTES.tracing(':id'), title: 'Tracing the money' },
  { pattern: ROUTES.routes(':id'), title: 'Route' },
  { pattern: ROUTES.exchange(':id'), title: 'Exchange attribution' },
  { pattern: ROUTES.risk(':id'), title: 'Risk score' },
  { pattern: ROUTES.evidence(':id'), title: 'Evidence & action' },
  { pattern: ROUTES.closed(':id'), title: 'Case closed' },
  { pattern: ROUTES.campaign(':id'), title: 'Campaign' },
  { pattern: ROUTES.vaspReplies, title: 'VASP replies' },
]

export function isRailVisible(pathname: string): boolean {
  return RAIL_VISIBLE_PATTERNS.some((pattern) => matchPath(pattern, pathname) !== null)
}

export function getCurrentRailStepKey(pathname: string): string | null {
  const match = RAIL_STEP_BY_PATTERN.find(({ pattern }) => matchPath(pattern, pathname) !== null)
  return match ? match.key : null
}

export function getPageTitle(pathname: string): string {
  const match = PAGE_TITLES.find(({ pattern }) => matchPath(pattern, pathname) !== null)
  return match ? match.title : 'KAIZEN'
}
