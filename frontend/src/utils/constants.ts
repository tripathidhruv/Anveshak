/** react-router-dom route paths, named — used by every task from here on instead of raw strings. */
export const ROUTES = {
  dashboard: '/',
  newCase: '/case/new',
  tracing: (id: string) => `/case/${id}/tracing`,
  routes: (id: string) => `/case/${id}/routes`,
  exchange: (id: string) => `/case/${id}/exchange`,
  risk: (id: string) => `/case/${id}/risk`,
  evidence: (id: string) => `/case/${id}/evidence`,
  closed: (id: string) => `/case/${id}/closed`,
  campaign: (id: string) => `/campaign/${id}`,
  cases: '/cases',
  trace: '/trace',
  campaigns: '/campaigns',
  reports: '/reports',
  exchanges: '/exchanges',
  // VASP wallet-sharing portal (Feature 2): the internal, officer-only view of every reply
  // an external exchange has left via their own public portal link (vaspPortal below).
  vaspReplies: '/vasp-replies',
  // Public, unguarded route -- an external exchange visitor's own opaque access_token, never
  // an officer. Mounted OUTSIDE RequireAuth in App.tsx.
  vaspPortal: (token: string) => `/vasp-portal/${token}`,
} as const

export interface RailStep {
  key: string
  label: string
}

/** The persistent 7-step progress rail shown at the top of every workflow screen (UX law 4). */
export const RAIL_STEPS: RailStep[] = [
  { key: 'newcase', label: 'New Case' },
  { key: 'trace', label: 'Trace' },
  { key: 'route', label: 'Route' },
  { key: 'exchange', label: 'Exchange' },
  { key: 'risk', label: 'Risk' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'action', label: 'Action' },
]

export type SemanticColour = 'criminal' | 'exchange' | 'onchain' | 'bridge' | 'safe' | 'info'

export type AccentColour = 'vermillion' | 'gold' | 'teal' | 'violet' | 'moss' | 'sky'

/** Fixed colour semantics — never reused for a second meaning (Global Constraints). */
export const COLOUR_SEMANTICS: Record<SemanticColour, AccentColour> = {
  criminal: 'vermillion',
  exchange: 'gold',
  onchain: 'teal',
  bridge: 'violet',
  safe: 'moss',
  info: 'sky',
}
