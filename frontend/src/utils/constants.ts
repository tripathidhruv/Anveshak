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
  // Unified role-based portal (Task 10 on): the login-based `exchange`-role landing view
  // (distinct from vaspPortal above, which needs no login at all -- see the design doc's
  // "existing public VASP token-link portal is kept, not replaced" section). Placeholder
  // route/page for now; Task 11 builds the real screen at this same path.
  exchangeHome: '/exchange',
  // The citizen/guest complaint-filing form (adapted from NewCase.tsx per the design doc).
  // The "Continue as guest" button on Login.tsx navigates straight here. Placeholder route/
  // page for now; Task 12 builds the real screen at this same path.
  citizenComplaintNew: '/complaint/new',
  // A logged-in citizen's own complaints list (keyed off their verified JWT email -- no
  // token needed, unlike the guest path below). Placeholder for now; Task 12 builds it.
  citizenMyComplaints: '/my-complaints',
  // A guest's own bookmarkable ticket-status page, keyed off the opaque guest_ticket_token
  // the backend issues on complaint submission -- same UX pattern as vaspPortal above, reused
  // rather than reinvented (design doc's "Guest citizens" section). Placeholder for now.
  myTicket: (token: string) => `/my-ticket/${token}`,
  // Notice-drafting page (Task 14, backend/app/api/v1/legal.py) -- officer-only, keyed off a
  // case id in the URL rather than needing Task 13's Cases/Tickets page to link to it first
  // (this page works standalone given a case id; cross-linking from a case detail view is a
  // small follow-up once that page exists).
  noticeNew: (caseId: string) => `/notices/new/${caseId}`,
  // Officer-only, system-wide flagged-wallet table (Task 11, `GET /flagged-wallets/all`).
  flaggedWallets: '/flagged-wallets',
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
