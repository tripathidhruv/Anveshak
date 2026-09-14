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
