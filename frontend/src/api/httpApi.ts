import { request } from './client'
import { createKeyedPromiseCache } from './traceCache'
import type { Role } from '../store/authStore'
import type { Case, CaseInput, KaizenApi, RecentCase, RecoverabilityState, Route, TicketStatus, TraceResult } from '../types'

export interface MeResponse {
  email: string
  role: Role
}

/** `GET /api/v1/me` (Task 2, `backend/app/api/v1/me.py`) -- resolves the verified JWT's email
 * to its KAIZEN role. Called directly from `pages/Login.tsx` right after `verifyOtp` stores
 * the token, and again by `RequireRole` to rehydrate `useAuthStore` after a hard refresh
 * (the zustand store is in-memory only and doesn't survive a reload, unlike the token itself).
 * Not routed through the mock/real `api` switch in `api/index.ts` -- that switch is for the
 * case/trace data layer (`KaizenApi`), which stays mockable independent of identity, and this
 * only exists against the real backend either way (no mock identity concept). Matches the
 * bearer-attachment pattern `VaspReplies.tsx` already established for the one other endpoint
 * that needs `Authorization: Bearer <token>` today. */
export function getMe(token: string): Promise<MeResponse> {
  return request<MeResponse>('/api/v1/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

/** Mirrors `backend/app/schemas.py`'s `CaseReplyOut` exactly. `authoredBy` is `'officer'` for a
 * reply an officer typed through `POST /{case_id}/replies`, or `'ai'` for the auto-generated
 * narrative `update_case_status` attaches when a case moves to `'handled'` — the two need
 * visually distinct treatment wherever replies are shown (Task 12 brief). */
export interface CaseReplyOut {
  id: number
  caseId: string
  message: string
  authoredBy: string
  createdAt: string
}

/** `GET /api/v1/cases/mine` (Task 5) — a logged-in citizen's own cases, matched server-side by
 * their verified JWT email. Bearer-token pattern mirrors `getMe` above / `VaspReplies.tsx`.
 * Returns the shared `Case` type (its `status`/`filedByRole`/`guestTicketToken` fields, added
 * for the officer Tickets page, are exactly the `CaseOut` shape this endpoint returns too). */
export function getMyCases(token: string): Promise<Case[]> {
  return request<Case[]>('/api/v1/cases/mine', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

/** `GET /api/v1/cases/{id}/replies` (Task 5) — requires the citizen's own bearer token; the
 * backend checks `complainant_email` ownership itself (403s otherwise), so no client-side
 * ownership check is needed here. */
export function getCaseReplies(caseId: string, token: string): Promise<CaseReplyOut[]> {
  return request<CaseReplyOut[]>(`/api/v1/cases/${caseId}/replies`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

/** `GET /api/v1/cases/ticket/{token}` (Task 5) — no-auth lookup for a guest-filed case; the
 * opaque `guest_ticket_token` itself is the credential, same convention as `/vasp-portal/:token`. */
export function getCaseByTicket(token: string): Promise<Case> {
  return request<Case>(`/api/v1/cases/ticket/${token}`)
}

/** `GET /api/v1/cases/ticket/{token}/replies` (Task 5b) — the no-auth counterpart to
 * `getCaseReplies` above, for a guest who has no JWT to present. */
export function getTicketReplies(token: string): Promise<CaseReplyOut[]> {
  return request<CaseReplyOut[]>(`/api/v1/cases/ticket/${token}/replies`)
}

interface BackendHop {
  n: number
  addr: string
  role: string
  amt: number
  at: string
  flag: string | null
  chain: string
  stopReason: string | null
}

/** Mirrors `backend/app/api/v1/cases.py`'s `CaseListItemOut` (the `CaseOut` fields plus the
 * two recoverability additions) exactly. */
interface BackendCaseListItem {
  id: string
  ncrp: string
  complainant: string
  location: string
  phone: string
  incidentAt: string
  reportedAt: string
  fraudType: string
  amountINR: number
  amountCrypto: number
  asset: string
  chain: string
  suspectWallet: string
  status: TicketStatus
  recoverabilityState: RecoverabilityState
  recoverabilityDeadlineMinutes: number | null
}

// Unified role-based portal (Task 3) added a real, persisted `status` column -- the comment
// this replaced ("no persisted status column, always report 'New'") is stale as of that task.
// `RecentCase.status` (the older, four-value display enum -- also used by Dashboard.tsx's mock-
// only mini-table) is kept only because that field is mandatory on the shared `RecentCase`
// type; it is NOT a faithful rendering of the real three-value workflow, so it is never shown by
// the officer Tickets page (`Cases.tsx`) any more -- that screen reads `ticketStatus` (the real
// value, verbatim) instead. This mapping exists purely so the mandatory field is filled with
// something in the same spirit rather than a fabricated constant.
const LEGACY_STATUS_FOR_TICKET_STATUS: Record<TicketStatus, RecentCase['status']> = {
  new: 'New',
  in_progress: 'Traced',
  handled: 'Closed',
}

function toRecentCase(item: BackendCaseListItem): RecentCase {
  return {
    id: item.id,
    who: item.complainant,
    amt: item.amountINR,
    chain: item.chain,
    status: LEGACY_STATUS_FOR_TICKET_STATUS[item.status],
    // The real, persisted workflow status (Task 13) -- see the type's own doc comment.
    ticketStatus: item.status,
    // Real per-case risk scoring is a separate, expensive live trace + ML call
    // (GET /api/v1/risk/{caseId}/score) this list endpoint deliberately does not also run for
    // every case on every request -- `null` here is honest "not computed here", matching the
    // mock data's own `null` for cases that haven't been scored yet.
    risk: null,
    recoverabilityState: item.recoverabilityState,
    recoverabilityDeadlineMinutes: item.recoverabilityDeadlineMinutes,
  }
}

interface BackendTraceOut {
  hops: BackendHop[]
  conservation: { incomingTotal: number; outgoingTotal: number; fees: number; remainder: number; reconciled: boolean }
  attribution: { walletAddress: string; chain: string; gatePassed: boolean; entityName: string; reasoning: string; limitations: string }
  innocence: { innocenceScore: number; factors: { check: string; description: string; supportsInnocence: boolean; weight: number }[] }
  unreportedVictims: { payerAddress: string; chain: string; totalAmount: number; transferCount: number; firstSeenAt: string }[]
  bridgeLinks: { sideATxHash: string; sideAChain: string; sideBTxHash: string; sideBChain: string; confidence: number }[]
}

function toRoute(trace: BackendTraceOut): Route {
  return {
    label: trace.attribution.gatePassed ? trace.attribution.entityName : 'Unresolved',
    chain: trace.hops[0]?.chain,
    accent: trace.attribution.gatePassed ? 'moss' : 'gold',
    valueINR: 0, // provenance: live trace doesn't compute INR conversion yet — known gap, not hidden
    // The victim's originally reported amount — not a max over hop amounts, which could
    // pick up a consolidation-hub hop aggregating other victims' funds (see CLAUDE.md's
    // "Consolidation" thesis and the hub hop in api/mock.ts).
    valueCrypto: trace.conservation.incomingTotal,
    durationMin: 0,
    hops: trace.hops.length,
    trail: trace.hops.map((h) => ({
      n: h.n, addr: h.addr, role: h.role, amt: h.amt, at: h.at, flag: h.flag, chain: h.chain,
    })),
  }
}

/** Real HTTP implementation — covers what backend/ Sprint 1 (amended) actually serves.
 * Everything else stays `notImplemented` until the VASP feed / freeze / evidence-hash
 * sprints land (see docs/superpowers/plans/2026-09-25-backend-sprint1-multichain.md). */
export const httpApiPartial: Partial<KaizenApi> = {
  createCase: (input: CaseInput) => request<Case>('/api/v1/cases', { method: 'POST', body: input }),
  getCase: (id: string) => request<Case>(`/api/v1/cases/${id}`),
  listCases: async (): Promise<RecentCase[]> => {
    const items = await request<BackendCaseListItem[]>('/api/v1/cases')
    // The backend already returns these sorted by recoverability (most urgent/actionable
    // first) -- see cases.py's `list_cases` -- so this is a straight field mapping, no
    // client-side re-sort here.
    return items.map(toRecentCase)
  },
  startTrace: async (caseId: string): Promise<TraceResult> => {
    const trace = await request<BackendTraceOut>(`/api/v1/cases/${caseId}/trace`, { method: 'POST' })
    // routeB is an honest "not computed" placeholder — an independent literal, never a spread
    // of the real trace, so no real hop count/value ever sits next to the "Not yet computed"
    // label (see CLAUDE.md's "nothing is a black box" / honest-provenance rule).
    const routeB: Route = {
      label: 'Not yet computed',
      accent: 'sky',
      valueINR: 0,
      valueCrypto: 0,
      durationMin: 0,
      hops: 0,
      trail: [],
    }
    return { routeA: toRoute(trace), routeB }
  },
  getRoutes: (caseId: string) =>
    routesCache.get(caseId, () => (httpApiPartial.startTrace as (id: string) => Promise<TraceResult>)(caseId)),
}

// --- Legal notice drafting (Task 14, `backend/app/api/v1/legal.py`) ---------------------------
// This backend module has NO auth dependency today (see `notice_fsm.py`'s own docstring: no
// User model, no login, no session/token middleware anywhere in `app/` yet) -- a disclosed,
// existing scope limit per this project's conventions, not something to silently "fix" here by
// bolting on an Authorization header nothing else in this module expects.

export interface LegalCitation {
  id: string
  statute: string
  section: string
  title: string
  unverified: boolean
}

/** Mirrors `legal.py`'s `NoticeOut`. `state` is the draft->approve->(reject|send) FSM's
 * `NoticeState` value (`notice_fsm.py`). */
export interface LegalNoticeOut {
  id: string
  caseId: string
  citationId: string
  body: string
  state: 'draft' | 'approved' | 'sent' | 'rejected'
  createdAt: string
  approvedBy: string | null
  approvedAt: string | null
  rejectedReason: string | null
  sentAt: string | null
}

export interface CreateNoticeInput {
  caseId: string
  citationId: string
  exchangeName?: string
  exchangeJurisdiction?: string
}

/** `GET /api/v1/legal/citations` -- the real template/citation options (BNSS S94/S106, BNS
 * S223, BSA S63) for NoticeDrafting.tsx's picker. Fetched rather than hard-coded client-side:
 * the citation list/wording is `backend/app/legal/citations.py`'s to own (Architecture rule 1). */
export function getLegalCitations(): Promise<LegalCitation[]> {
  return request<LegalCitation[]>('/api/v1/legal/citations')
}

/** `POST /api/v1/legal/notices`. Can reject with a 409 `ApiError` whose `body` is
 * `{detail: string}` -- the case's suspect wallet cleared the innocence-gate threshold
 * (`legal.py`'s `INNOCENCE_GATE_THRESHOLD`, 0.6). Callers must show that `detail` string
 * (the plain-English reason, already composed server-side) rather than a raw error blob. */
export function createNotice(input: CreateNoticeInput): Promise<LegalNoticeOut> {
  return request<LegalNoticeOut>('/api/v1/legal/notices', { method: 'POST', body: input })
}

export function getNotice(noticeId: string): Promise<LegalNoticeOut> {
  return request<LegalNoticeOut>(`/api/v1/legal/notices/${noticeId}`)
}

/** `GET /api/v1/legal/cases/{caseId}/notices` -- every notice already drafted for this case,
 * so re-opening NoticeDrafting.tsx for a case shows its existing drafts instead of losing them. */
export function listNoticesForCase(caseId: string): Promise<LegalNoticeOut[]> {
  return request<LegalNoticeOut[]>(`/api/v1/legal/cases/${caseId}/notices`)
}

/** `POST /api/v1/legal/notices/{id}/approve`. `approvedBy` is a free-text name/id, not a real
 * identity check (see `notice_fsm.py`'s docstring) -- the FSM only enforces that *someone* is
 * named before a notice can be sent. Can 409 (`ApiError`) if the notice isn't in `draft` state. */
export function approveNotice(noticeId: string, approvedBy: string): Promise<LegalNoticeOut> {
  return request<LegalNoticeOut>(`/api/v1/legal/notices/${noticeId}/approve`, {
    method: 'POST',
    body: { approvedBy },
  })
}

/** `POST /api/v1/legal/notices/{id}/reject`. Can 409 if the notice is already `sent`/`rejected`. */
export function rejectNotice(noticeId: string, reason?: string): Promise<LegalNoticeOut> {
  return request<LegalNoticeOut>(`/api/v1/legal/notices/${noticeId}/reject`, {
    method: 'POST',
    body: { reason },
  })
}

/** `POST /api/v1/legal/notices/{id}/send`. Named `sendLegalNotice` (not `sendNotice`) to stay
 * distinct from the unrelated mock-only `KaizenApi.sendNotice(caseId, NoticeType)` already used
 * by `components/action/LawfulActionTab.tsx` -- same English verb, different notices/FSM
 * entirely. Never sends anything for real; only flips the in-memory FSM to `sent`, and only
 * succeeds if the notice was already `approved` (`legal.py`'s `send_notice` docstring). */
export function sendLegalNotice(noticeId: string): Promise<LegalNoticeOut> {
  return request<LegalNoticeOut>(`/api/v1/legal/notices/${noticeId}/send`, { method: 'POST' })
}

/** `GET /api/v1/legal/notices/{id}/sahyog-payload` -- a loosely-typed JSON export shown
 * read-only in NoticeDrafting.tsx. Per `backend/app/legal/sahyog_payload.py`'s own docstring,
 * this is "NOT verified against SAHYOG's actual published API" -- shaped from this project's
 * own schema, not a confirmed-compatible SAHYOG submission. */
export function getSahyogPayload(noticeId: string): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(`/api/v1/legal/notices/${noticeId}/sahyog-payload`)
}

/** Mirrors `backend/app/schemas.py`'s `FlaggedWalletOut` exactly -- the officer-facing,
 * system-wide flagged-wallet shape returned by `GET /flagged-wallets/all` (Task 6). No `id`
 * field (the schema never exposes one) -- callers correlate by address+chain instead. */
export interface BackendFlaggedWallet {
  address: string
  chain: string
  riskScore: number
  caseIds: string[]
  flaggedAt: string
  broadcastStatus: Record<string, unknown>
}

/** `GET /api/v1/vasp-feed/flagged-wallets/all` (Task 6, officer-gated via `require_role`) --
 * the system-wide flagged-wallet list behind Task 11's `FlaggedWallets.tsx` and behind
 * `VaspReplies.tsx`'s reply-detail dialog (correlating a reply's wallet with its risk score
 * and related case IDs, which `GET /replies` itself doesn't return). Takes the token as an
 * explicit param, matching `getMe`'s shape above, rather than reading `getAuthToken()` itself
 * -- every caller already holds the token from that same helper. */
export function getFlaggedWallets(token: string): Promise<BackendFlaggedWallet[]> {
  return request<BackendFlaggedWallet[]>('/api/v1/vasp-feed/flagged-wallets/all', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

// --- Officer Tickets page (Task 13) -------------------------------------------------------

/** `PATCH /api/v1/cases/{id}/status` (Task 3, officer-gated via `require_role`) -- the only
 * lifecycle move: `new -> in_progress -> handled`, one step at a time, enforced server-side
 * (`VALID_STATUS_TRANSITIONS` in `backend/app/api/v1/cases.py`). A transition to `'handled'`
 * may also append an AI-authored `CaseReply` server-side if `OPENAI_API_KEY` is configured --
 * this call's own response never carries that reply; callers should re-fetch replies
 * (`getCaseReplies`) after a successful `'handled'` transition to pick it up. Rejects with a
 * 409 `ApiError` on an invalid transition (e.g. `new` straight to `handled`); callers show
 * that case, never silently retry or reorder it. */
export function updateCaseStatus(caseId: string, status: TicketStatus, token: string): Promise<Case> {
  return request<Case>(`/api/v1/cases/${caseId}/status`, {
    method: 'PATCH',
    body: { status },
    headers: { Authorization: `Bearer ${token}` },
  })
}

/** `POST /api/v1/cases/{id}/replies` (Task 4, officer-gated via `require_role`) -- an officer's
 * own manual reply to a case. Always lands with `authoredBy: 'officer'` server-side (never
 * client-supplied); bearer-token pattern matches `getCaseReplies` above. */
export function postCaseReply(caseId: string, message: string, token: string): Promise<CaseReplyOut> {
  return request<CaseReplyOut>(`/api/v1/cases/${caseId}/replies`, {
    method: 'POST',
    body: { message },
    headers: { Authorization: `Bearer ${token}` },
  })
}

// `getRoutes` is called independently from up to 4 screens per case (Route Choice, Evidence,
// Case Closed, Reports — see task-G6-report.md) — each re-running the ENTIRE live backend trace
// from scratch for identical inputs otherwise. Cache the in-flight/most-recent promise per
// `caseId` so repeated screen loads for the SAME case within a session reuse one real request.
// Keyed by `caseId` (never global) so a different case, or a post-"Reset demo" new case (always
// a fresh backend-issued uuid — see backend/app/api/v1/cases.py's `create_case`), never reuses
// another case's cached result.
const routesCache = createKeyedPromiseCache<TraceResult>()
