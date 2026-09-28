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

/** Mirrors `backend/app/schemas.py`'s `BridgeLinkOut` exactly (`disclaimer` is
 * `app/bridge/linker.py`'s `BRIDGE_LINK_DISCLAIMER`, always present). */
interface BackendBridgeLink {
  sideATxHash: string
  sideAChain: string
  sideBTxHash: string
  sideBChain: string
  confidence: number
  disclaimer: string
}

/** Mirrors `backend/app/schemas.py`'s `SanctionsMatchOut` exactly. */
interface BackendSanctionsMatch {
  walletAddress: string
  chain: string
  listSource: string
  matchedAt: string
  listVersion: string
}

/** Mirrors `backend/app/schemas.py`'s `TraceOut` exactly (the shape `POST /{case_id}/trace`,
 * `backend/app/api/v1/traces.py`'s `run_trace`, actually returns) -- every field this endpoint
 * serves, not just the subset `toRoute()` originally copied out. `innocence`/`bridgeLinks`/
 * `sanctionsMatches` were already fetched off the wire before this fix but silently dropped on
 * the floor by `toRoute()` below; they're kept here and now actually copied through. */
interface BackendTraceOut {
  hops: BackendHop[]
  conservation: { incomingTotal: number; outgoingTotal: number; fees: number; remainder: number; reconciled: boolean }
  attribution: { walletAddress: string; chain: string; gatePassed: boolean; entityName: string; reasoning: string; limitations: string }
  innocence: { innocenceScore: number; factors: { check: string; description: string; supportsInnocence: boolean; weight: number }[] }
  unreportedVictims: { payerAddress: string; chain: string; totalAmount: number; transferCount: number; firstSeenAt: string }[]
  bridgeLinks: BackendBridgeLink[]
  sanctionsMatches: BackendSanctionsMatch[]
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
      stopReason: h.stopReason,
    })),
    // Previously fetched off the wire into `trace.innocence`/`trace.bridgeLinks` above but
    // never copied onto the `Route` components actually consume -- audit finding this task
    // fixes (see interface doc comment above).
    innocence: trace.innocence,
    bridgeLinks: trace.bridgeLinks,
    sanctionsMatches: trace.sanctionsMatches,
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

// --- Risk scoring, operator fingerprinting, campaigns, sanctions, audit log, evidence pack ---
// (audit finding: real backend endpoints with no client function at all). None of these routers
// have a `require_role`/`get_current_officer` dependency today (verified by reading each file
// below directly) -- only `cases.py` and `vasp_feed.py` do among `backend/app/api/v1/*` -- so
// none of these take a bearer token, unlike the officer-gated calls above.

/** Mirrors `backend/app/api/v1/risk.py`'s `RuleBasedScoreOut` exactly. */
export interface RuleBasedScoreOut {
  score: number
  breakdown: Record<string, number>
  reasoning: string
}

/** Mirrors `backend/app/api/v1/risk.py`'s `MlScoreOut` exactly. */
export interface MlScoreOut {
  score: number
  shapBreakdown: Record<string, number>
}

/** Mirrors `backend/app/api/v1/risk.py`'s `RiskScoreOut` exactly. `mlScore` is `null` whenever
 * `dataQualitySufficientForMl` is false (`app/risk/data_quality.py`'s gate) -- callers must
 * handle the null case rather than assuming the ML score always ran. `syntheticDataDisclosure`
 * is mandatory on every response (`app/risk/model.py`'s `SYNTHETIC_DATA_DISCLOSURE`), whether or
 * not the ML score actually ran, per that file's own doc comment. */
export interface RiskScoreOut {
  caseId: string
  walletAddress: string
  chain: string
  ruleBasedScore: RuleBasedScoreOut
  dataQualitySufficientForMl: boolean
  dataQualityReasons: string[]
  mlScore: MlScoreOut | null
  combinedScore: number
  syntheticDataDisclosure: string
}

/** `GET /api/v1/cases/{id}/score` (`backend/app/api/v1/risk.py`'s `get_risk_score`) -- runs a
 * full live trace again server-side (`_build_trace_features`) to build the rule-based +
 * (data-quality-gated) ML risk score for this case's suspect wallet. Not cached client-side the
 * way `getRoutes`/`startTrace` is -- a separate, deliberate call, not wired into that cache. */
export function getRiskScore(caseId: string): Promise<RiskScoreOut> {
  return request<RiskScoreOut>(`/api/v1/cases/${caseId}/score`)
}

/** Mirrors `backend/app/api/v1/operator_fingerprint.py`'s `SimilarOperatorResultOut` exactly. */
export interface SimilarOperatorResultOut {
  caseId: string
  similarityScore: number
  featureBreakdown: Record<string, unknown>
}

/** Mirrors `backend/app/api/v1/operator_fingerprint.py`'s `SimilarOperatorsOut` exactly.
 * `disclaimer` is that module's `SIMILARITY_DISCLAIMER`, always present regardless of whether
 * `results` is empty (e.g. the target case has no fingerprint yet). */
export interface SimilarOperatorsOut {
  caseId: string
  results: SimilarOperatorResultOut[]
  disclaimer: string
}

/** `GET /api/v1/cases/{id}/similar-operators` (`backend/app/api/v1/operator_fingerprint.py`'s
 * `get_similar_operators`) -- behavioural-similarity ranking against every other case's
 * fingerprint (see `app/graph/operator_fingerprint.py`'s module docstring). */
export function getSimilarOperators(caseId: string): Promise<SimilarOperatorsOut> {
  return request<SimilarOperatorsOut>(`/api/v1/cases/${caseId}/similar-operators`)
}

/** Mirrors `backend/app/schemas.py`'s `CampaignOut` exactly (the H0-scaffolded shared shape
 * `backend/app/api/v1/campaigns.py`'s `list_campaigns` returns as-is). */
export interface CampaignOut {
  id: string
  hubAddress: string
  chain: string
  caseIds: string[]
  totalAmountINR: number
}

/** Mirrors `backend/app/api/v1/campaigns.py`'s `CampaignDetailOut` exactly -- `CampaignOut` plus
 * `statesTouched`, honestly derived from `Case.location`'s distinct values per cluster (that
 * file's own doc comment: never a fabricated administrative "state" field the data model
 * doesn't have). */
export interface CampaignDetailOut extends CampaignOut {
  statesTouched: string[]
}

/** `GET /api/v1/campaigns` (`backend/app/api/v1/campaigns.py`'s `list_campaigns`) -- every
 * consolidation cluster `app/graph/campaigns.py`'s `build_campaigns` currently finds. */
export function getCampaignsList(): Promise<CampaignOut[]> {
  return request<CampaignOut[]>('/api/v1/campaigns')
}

/** `GET /api/v1/campaigns/{id}` (`backend/app/api/v1/campaigns.py`'s `get_campaign`) -- 404s
 * (`ApiError`) if no built campaign has this id. */
export function getCampaignDetail(campaignId: string): Promise<CampaignDetailOut> {
  return request<CampaignDetailOut>(`/api/v1/campaigns/${campaignId}`)
}

/** Mirrors `backend/app/schemas.py`'s `SanctionsMatchOut` exactly -- same shape as
 * `BackendTraceOut.sanctionsMatches` above, kept as its own named export here since this is a
 * standalone endpoint response, not a nested trace field. */
export interface SanctionsMatchOut {
  walletAddress: string
  chain: string
  listSource: string
  matchedAt: string
  listVersion: string
}

/** `GET /api/v1/sanctions/matches/{case_id}` (`backend/app/api/v1/sanctions.py`'s
 * `get_case_sanctions_matches`) -- real path is `/api/v1/sanctions/matches/{case_id}`, NOT
 * `/api/v1/cases/{id}/sanctions` or similar (this router's prefix is `/api/v1/sanctions`, and
 * the route itself is `/matches/{case_id}`). Screens every persisted `Hop` for this case against
 * the OFAC SDN seed list on every call (`screen_case_hops`) -- not a cached read. */
export function getSanctionsMatches(caseId: string): Promise<SanctionsMatchOut[]> {
  return request<SanctionsMatchOut[]>(`/api/v1/sanctions/matches/${caseId}`)
}

/** Mirrors `backend/app/schemas.py`'s `AuditLogEntryOut` exactly. */
export interface AuditLogEntryOut {
  actor: string
  action: string
  objectType: string
  objectId: string
  hash: string
  createdAt: string
}

/** `GET /api/v1/audit` (`backend/app/api/v1/audit.py`'s `list_audit_entries`) -- every entry in
 * the hash-chained audit log, oldest first (`AuditLogEntry.id.asc()`). */
export function getAuditLog(): Promise<AuditLogEntryOut[]> {
  return request<AuditLogEntryOut[]>('/api/v1/audit')
}

/** Mirrors `backend/app/schemas.py`'s `AuditVerifyOut` exactly. `brokenAtEntryId` is `null` when
 * `valid` is true; otherwise the id of the first entry whose hash no longer matches. */
export interface AuditVerifyOut {
  valid: boolean
  brokenAtEntryId: number | null
  checkedEntries: number
}

/** `GET /api/v1/audit/verify` (`backend/app/api/v1/audit.py`'s `verify_audit_chain`) -- walks
 * the full chain from genesis (`app/audit/chain.py`'s `verify_chain`) and reports exactly where
 * it broke, if it did. */
export function verifyAuditChain(): Promise<AuditVerifyOut> {
  return request<AuditVerifyOut>('/api/v1/audit/verify')
}

/** Mirrors `backend/app/schemas.py`'s `EvidencePackOut` exactly. `manifestEntries` is `list[dict]`
 * server-side (untyped/free-form per source entry -- source URL, wallet address, chain, raw
 * response hash, fetched-at), so it's typed here as a loose record array rather than guessed
 * fields. */
export interface EvidencePackOut {
  caseId: string
  packHash: string
  manifestEntries: Record<string, unknown>[]
  createdAt: string
}

/** `GET /api/v1/evidence/{id}/pack` (`backend/app/api/v1/evidence.py`'s `get_evidence_pack`) --
 * builds (and persists a fresh `EvidenceManifest` row for) this case's canonical,
 * content-only-hashed evidence pack. Calling this again for the same case creates ANOTHER
 * manifest row (not idempotent/cached) -- `verifyEvidencePack` below always checks the most
 * recently created one. */
export function getEvidencePack(caseId: string): Promise<EvidencePackOut> {
  return request<EvidencePackOut>(`/api/v1/evidence/${caseId}/pack`)
}

/** Mirrors `backend/app/api/v1/evidence.py`'s own `EvidenceVerifyOut` exactly (defined in that
 * file, not `schemas.py`, per that file's own comment: Task H5's file scope excluded
 * `schemas.py`). `dataUnavailable` true forces `valid` false -- verification never claims success
 * on a source it couldn't actually re-fetch just now. */
export interface EvidenceVerifyOut {
  caseId: string
  valid: boolean
  packHashMatches: boolean
  sourcesChecked: number
  sourcesReproduced: number
  dataUnavailable: boolean
  details: Record<string, unknown>[]
}

/** `POST /api/v1/evidence/{id}/verify` (`backend/app/api/v1/evidence.py`'s
 * `verify_evidence_pack`) -- a real correctness check, not a comparison of stored hashes: it
 * re-fetches each of the case's most recent evidence manifest's recorded sources right now and
 * recomputes both the pack hash and each source's raw-response hash. Method is POST (not GET) --
 * this call re-runs live chain reads with side effects worth not caching/prefetching casually.
 * 404s (`ApiError`) if no evidence pack has ever been generated for this case. */
export function verifyEvidencePack(caseId: string): Promise<EvidenceVerifyOut> {
  return request<EvidenceVerifyOut>(`/api/v1/evidence/${caseId}/verify`, { method: 'POST' })
}

// --- Inverted deposit index lookup (standalone endpoint; the index itself already existed as
// a silent accelerant inside traces.py's live-trace hop loop -- this is that same read side,
// `app.index.deposit_index.lookup_indexed_deposit`, exposed as its own officer-facing feature.) --

/** Mirrors `backend/app/schemas.py`'s `DepositIndexEntryOut` exactly. */
export interface DepositIndexEntryOut {
  address: string
  chain: string
  hotWalletAddress: string
  entityName: string
  indexedAt: string
}

/** `GET /api/v1/deposit-index/{chain}/{address}` (`backend/app/api/v1/deposit_index.py`'s
 * `get_deposit_index_matches`, officer-gated via `require_role("officer")`) -- an INSTANT
 * reverse lookup against the offline, backward-crawled inverted deposit index, not a live
 * trace: no chain-API call happens on this request at all, it is a pure DB read against rows
 * `backend/scripts/build_deposit_index.py` already pre-computed. Returns `[]` (200, not 404)
 * when the address has no known deposit relationship in the index -- a genuine "we don't know
 * of one" answer, not an error. Bearer-token pattern matches `getFlaggedWallets` above (same
 * officer-only convention, same reason this needs a token: `require_role` gates it). */
export function getDepositIndexMatches(
  chain: string, address: string, token: string,
): Promise<DepositIndexEntryOut[]> {
  return request<DepositIndexEntryOut[]>(
    `/api/v1/deposit-index/${encodeURIComponent(chain)}/${encodeURIComponent(address)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
}

// `getRoutes` is called independently from up to 4 screens per case (Route Choice, Evidence,
// Case Closed, Reports — see task-G6-report.md) — each re-running the ENTIRE live backend trace
// from scratch for identical inputs otherwise. Cache the in-flight/most-recent promise per
// `caseId` so repeated screen loads for the SAME case within a session reuse one real request.
// Keyed by `caseId` (never global) so a different case, or a post-"Reset demo" new case (always
// a fresh backend-issued uuid — see backend/app/api/v1/cases.py's `create_case`), never reuses
// another case's cached result.
const routesCache = createKeyedPromiseCache<TraceResult>()
