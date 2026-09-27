import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, FolderOpen, Search, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAuthToken } from '@/lib/authToken'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { IconTile } from '@/components/ui/icon-tile'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '../api'
import { ApiError } from '../api/client'
import { getCaseReplies, postCaseReply, updateCaseStatus } from '../api/httpApi'
import type { CaseReplyOut } from '../api/httpApi'
import { useUIStore } from '../store/uiStore'
import type { Case, RecentCase, RecoverabilityState, RiskBand, TicketStatus } from '../types'
import type { SemanticColour } from '../utils/constants'
import { COLOUR_SEMANTICS, ROUTES } from '../utils/constants'
import { formatINR, truncateAddress } from '../utils/format'

const RISK_COLOUR: Partial<Record<RiskBand, SemanticColour>> = {
  HIGH: 'criminal',
  MEDIUM: 'exchange',
  LOW: 'safe',
}

// Colour semantics per CLAUDE.md: gold = exchange, moss = safe/done, vermillion = criminal
// path/high risk. "Moving" money is still an active criminal flow (highest urgency, no
// confirmed resting point yet), so it borrows the criminal-path colour rather than a new one.
const RECOVERABILITY_COLOUR: Record<RecoverabilityState, SemanticColour> = {
  at_rest: 'safe',
  at_exchange: 'exchange',
  moving: 'criminal',
  unknown: 'info',
}

const RECOVERABILITY_LABEL: Record<RecoverabilityState, string> = {
  at_rest: 'At rest',
  at_exchange: 'At exchange',
  moving: 'Moving',
  unknown: 'Unknown',
}

/** Plain-English deadline text for a table cell — `null` means "don't show a deadline"
 * (state known but no fixed resting point to measure one against, or no signal at all). */
function formatRecoverabilityDeadline(minutes: number | null | undefined): string | null {
  if (minutes == null) return null
  if (minutes <= 0) return 'Window likely closed'
  const hours = minutes / 60
  return hours < 1 ? `~${Math.round(minutes)}m left` : `~${Math.round(hours)}h left`
}

/** Default sort: cases with a real deadline first (least time left = most urgent first),
 * then still-moving cases, then cases with no traceable state last — mirrors the backend's
 * own `_sort_key` in `backend/app/api/v1/cases.py` exactly (see that function's comment). */
function recoverabilitySortKey(row: RecentCase): [number, number] {
  const state = row.recoverabilityState ?? 'unknown'
  const deadline = row.recoverabilityDeadlineMinutes
  if (deadline != null) return [0, deadline]
  return [state === 'moving' ? 1 : 2, 0]
}

/** The case with full backing trace/risk/evidence data in this demo — see `mock.ts`. It also
 * gets a shortcut into the 7-step trace workflow from the detail dialog below, alongside the
 * real reply/status machinery every case now has. */
const FULL_DATA_CASE_ID = 'KZN-2026-0417'

/** The real, persisted workflow status (unified role-based portal, Task 3) -- the only three
 * states a case can be in, in this fixed order. A row whose `ticketStatus` wasn't populated
 * (mock mode, which has no persisted workflow to report) is treated as `'new'` for display. */
const TICKET_TABS: TicketStatus[] = ['new', 'in_progress', 'handled']

const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  new: 'New',
  in_progress: 'In Progress',
  handled: 'Handled',
}

const TICKET_STATUS_COLOUR: Record<TicketStatus, SemanticColour> = {
  new: 'info',
  in_progress: 'onchain',
  handled: 'safe',
}

/** The one forward-only move each status allows (mirrors `VALID_STATUS_TRANSITIONS` in
 * `backend/app/api/v1/cases.py` exactly — never skips a step, never moves backward). `null`
 * means this status is terminal and no transition button should render at all. */
const NEXT_STATUS_ACTION: Record<TicketStatus, { next: TicketStatus; label: string } | null> = {
  new: { next: 'in_progress', label: 'Start working on this' },
  in_progress: { next: 'handled', label: 'Mark handled' },
  handled: null,
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={cn('text-sm text-foreground', mono && 'font-[family-name:var(--font-mono)]')}>{value}</span>
    </div>
  )
}

/**
 * Screen — `/cases`, the officer Tickets page. A full registry view of every case from
 * `api.listCases()`, tabbed by the real, persisted workflow status, with a search box
 * (client-side, no new API needed) and a per-case detail dialog carrying the reply thread and
 * status-transition actions (Task 13, unified role-based portal).
 */
export default function Cases() {
  const navigate = useNavigate()
  const showToast = useUIStore((s) => s.showToast)
  const [cases, setCases] = useState<RecentCase[] | null>(null)
  const [statusFilter, setStatusFilter] = useState<TicketStatus>('new')
  const [query, setQuery] = useState('')

  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [caseDetail, setCaseDetail] = useState<Case | null>(null)
  const [replies, setReplies] = useState<CaseReplyOut[] | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [repliesError, setRepliesError] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [transitioning, setTransitioning] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.listCases().then((result) => {
      if (!cancelled) setCases(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedCaseId) return
    let cancelled = false
    setDetailLoading(true)
    setDetailError(null)
    // Case fields and the reply thread are fetched independently (not `Promise.all`) so a
    // reply-thread failure (e.g. an expired token, or a transient backend error) never blanks
    // out the case fields that loaded fine — each surfaces its own scoped error instead.
    api
      .getCase(selectedCaseId)
      .then((detail) => {
        if (!cancelled) setCaseDetail(detail)
      })
      .catch(() => {
        if (!cancelled) setDetailError('Could not load this case. Your session may have expired — try signing in again.')
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedCaseId])

  useEffect(() => {
    if (!selectedCaseId) return
    let cancelled = false
    setReplies(null)
    setRepliesError(null)
    const token = getAuthToken()
    if (!token) {
      setRepliesError('Not authenticated — sign in again to see replies.')
      return
    }
    getCaseReplies(selectedCaseId, token)
      .then((replyList) => {
        if (!cancelled) setReplies(replyList)
      })
      .catch(() => {
        if (!cancelled) setRepliesError('Could not load replies for this case.')
      })
    return () => {
      cancelled = true
    }
  }, [selectedCaseId])

  const filtered = useMemo(() => {
    if (!cases) return []
    return cases
      .filter((row) => {
        const ticketStatus = row.ticketStatus ?? 'new'
        if (ticketStatus !== statusFilter) return false
        if (query.trim() && !row.id.toLowerCase().includes(query.trim().toLowerCase()) && !row.who.toLowerCase().includes(query.trim().toLowerCase())) return false
        return true
      })
      // Default sort — most recoverable / most urgent first (see recoverabilitySortKey).
      // The status filter above still narrows the rows; this only orders what's left.
      .slice()
      .sort((a, b) => {
        const [tierA, valueA] = recoverabilitySortKey(a)
        const [tierB, valueB] = recoverabilitySortKey(b)
        return tierA !== tierB ? tierA - tierB : valueA - valueB
      })
  }, [cases, statusFilter, query])

  function closeDialog() {
    setSelectedCaseId(null)
    setCaseDetail(null)
    setReplies(null)
    setReplyDraft('')
    setDetailError(null)
    setRepliesError(null)
  }

  async function handleSendReply() {
    if (!selectedCaseId || !replyDraft.trim()) return
    const token = getAuthToken()
    if (!token) {
      showToast('Not authenticated — sign in again to reply.')
      return
    }
    setSendingReply(true)
    try {
      const reply = await postCaseReply(selectedCaseId, replyDraft.trim(), token)
      setReplies((prev) => [...(prev ?? []), reply])
      setReplyDraft('')
    } catch {
      showToast('Could not send that reply. Try again.')
    } finally {
      setSendingReply(false)
    }
  }

  async function handleTransition() {
    if (!selectedCaseId || !caseDetail) return
    const currentStatus = caseDetail.status ?? 'new'
    const action = NEXT_STATUS_ACTION[currentStatus]
    if (!action) return
    const token = getAuthToken()
    if (!token) {
      showToast('Not authenticated — sign in again to update this case.')
      return
    }
    setTransitioning(true)
    try {
      const updated = await updateCaseStatus(selectedCaseId, action.next, token)
      setCaseDetail(updated)
      setCases((prev) =>
        prev?.map((row) => (row.id === selectedCaseId ? { ...row, ticketStatus: updated.status ?? action.next } : row)) ?? prev,
      )
      if (action.next === 'handled') {
        // A move to 'handled' may have appended an AI-authored narrative reply server-side
        // (only if the backend has an OpenAI key configured) -- re-fetch rather than assume
        // either way, so the reply thread never fabricates or omits it (CLAUDE.md's "nothing
        // is a black box" rule). The status transition above already succeeded and was
        // committed server-side by this point, so a failure in this re-fetch must never turn
        // that real success into a misleading error toast -- it's caught on its own, separate
        // from the outer try/catch below (which is for the transition call itself).
        try {
          const freshReplies = await getCaseReplies(selectedCaseId, token)
          const hadAiReply = (replies ?? []).some((r) => r.authoredBy === 'ai')
          const gotNewAiReply = freshReplies.some((r) => r.authoredBy === 'ai') && !hadAiReply
          setReplies(freshReplies)
          setRepliesError(null)
          showToast(gotNewAiReply ? 'Case marked handled — an AI narrative reply was added.' : 'Case marked handled.')
        } catch {
          setRepliesError('Could not refresh replies after this transition.')
          showToast('Case marked handled.')
        }
      } else {
        showToast(`Case moved to "${TICKET_STATUS_LABEL[action.next]}".`)
      }
    } catch (err) {
      const detail = err instanceof ApiError && err.body && typeof err.body === 'object' && 'detail' in err.body
        ? String((err.body as { detail: unknown }).detail)
        : 'Could not update this case’s status. Try again.'
      showToast(detail)
    } finally {
      setTransitioning(false)
    }
  }

  const currentStatus = caseDetail?.status ?? 'new'
  const transitionAction = NEXT_STATUS_ACTION[currentStatus]

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-xl">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-foreground">Cases</h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">Every registered complaint, in one registry.</p>
      </header>

      <Card className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as TicketStatus)}>
            <TabsList>
              {TICKET_TABS.map((status) => (
                <TabsTrigger key={status} value={status}>
                  {TICKET_STATUS_LABEL[status]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-64">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search case ID or complainant"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {!cases ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center text-muted-foreground">
            <Spinner percent={70} label="Loading" />
            <p>Loading cases…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <IconTile color="primary">
              <FolderOpen size={20} />
            </IconTile>
            <p>No cases in this tab.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Case ID</th>
                  <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Complainant</th>
                  <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Amount</th>
                  <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Chain</th>
                  <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Risk</th>
                  <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Recoverability</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const hasFullData = row.id === FULL_DATA_CASE_ID
                  const ticketStatus = row.ticketStatus ?? 'new'
                  return (
                    <tr
                      key={row.id}
                      className="cursor-pointer transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                      onClick={() => setSelectedCaseId(row.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setSelectedCaseId(row.id)
                      }}
                    >
                      <td className="whitespace-nowrap border-b border-border px-3 py-3 font-[family-name:var(--font-mono)] text-sm text-foreground">
                        {row.id}
                        {hasFullData && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-moss">Full trace demo</span>}
                      </td>
                      <td className="whitespace-nowrap border-b border-border px-3 py-3 text-sm text-foreground">{row.who}</td>
                      <td className="whitespace-nowrap border-b border-border px-3 py-3 font-[family-name:var(--font-mono)] text-sm text-foreground">{formatINR(row.amt)}</td>
                      <td className="whitespace-nowrap border-b border-border px-3 py-3 text-sm text-foreground">{row.chain}</td>
                      <td className="whitespace-nowrap border-b border-border px-3 py-3">
                        <Badge variant={COLOUR_SEMANTICS[TICKET_STATUS_COLOUR[ticketStatus]]}>{TICKET_STATUS_LABEL[ticketStatus]}</Badge>
                      </td>
                      <td className="whitespace-nowrap border-b border-border px-3 py-3">
                        {row.risk ? (
                          <Badge variant={COLOUR_SEMANTICS[RISK_COLOUR[row.risk]!]}>{row.risk}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap border-b border-border px-3 py-3">
                        {row.recoverabilityState ? (
                          <div className="flex flex-col gap-1">
                            <Badge variant={COLOUR_SEMANTICS[RECOVERABILITY_COLOUR[row.recoverabilityState]]}>
                              {RECOVERABILITY_LABEL[row.recoverabilityState]}
                            </Badge>
                            {formatRecoverabilityDeadline(row.recoverabilityDeadlineMinutes) && (
                              <span className="text-[11px] text-muted-foreground">
                                {formatRecoverabilityDeadline(row.recoverabilityDeadlineMinutes)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={selectedCaseId !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-[family-name:var(--font-mono)]">{selectedCaseId}</DialogTitle>
            <DialogDescription>Full case detail, reply thread, and status actions.</DialogDescription>
          </DialogHeader>

          {detailLoading && (
            <div className="flex flex-col items-center gap-4 py-10 text-center text-muted-foreground">
              <Spinner percent={70} label="Loading" size={120} />
              <p>Loading case…</p>
            </div>
          )}

          {!detailLoading && detailError && (
            <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm font-medium text-destructive">{detailError}</Card>
          )}

          {!detailLoading && !detailError && caseDetail && (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                <Field label="NCRP" value={caseDetail.ncrp} mono />
                <Field label="Complainant" value={caseDetail.complainant} />
                <Field label="Phone" value={caseDetail.phone} />
                <Field label="Location" value={caseDetail.location} />
                <Field label="Fraud type" value={caseDetail.fraudType} />
                <Field label="Filed by" value={caseDetail.filedByRole ?? '—'} />
                <Field label="Incident at" value={new Date(caseDetail.incidentAt).toLocaleString()} />
                <Field label="Reported at" value={new Date(caseDetail.reportedAt).toLocaleString()} />
                <Field label="Amount" value={`${formatINR(caseDetail.amountINR)} (${caseDetail.amountCrypto} ${caseDetail.asset})`} />
                <Field label="Chain" value={caseDetail.chain} />
                <Field label="Suspect wallet" value={truncateAddress(caseDetail.suspectWallet)} mono />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted p-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Current status</span>
                  <Badge variant={COLOUR_SEMANTICS[TICKET_STATUS_COLOUR[currentStatus]]}>{TICKET_STATUS_LABEL[currentStatus]}</Badge>
                </div>
                {transitionAction && (
                  <Button size="sm" onClick={handleTransition} disabled={transitioning}>
                    {transitioning ? 'Updating…' : transitionAction.label}
                  </Button>
                )}
              </div>

              {selectedCaseId === FULL_DATA_CASE_ID && (
                <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.newCase)}>
                  Open full trace workflow (demo)
                </Button>
              )}

              <div className="flex flex-col gap-3">
                <h3 className="font-[family-name:var(--font-display)] text-sm font-bold text-foreground">Replies</h3>

                {repliesError ? (
                  <p className="text-sm font-medium text-destructive">{repliesError}</p>
                ) : replies === null ? (
                  <p className="text-sm text-muted-foreground">Loading replies…</p>
                ) : replies.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No replies yet.</p>
                ) : (
                  <div className="flex max-h-64 flex-col gap-3 overflow-y-auto pr-1">
                    {replies.map((reply) => (
                      <div
                        key={reply.id}
                        className={cn('rounded-xl p-3 text-sm', reply.authoredBy === 'ai' ? 'bg-violet/10' : 'bg-muted')}
                      >
                        <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                          {reply.authoredBy === 'ai' ? (
                            <Bot size={14} className="text-violet" />
                          ) : (
                            <ShieldCheck size={14} className="text-primary" />
                          )}
                          <span>{reply.authoredBy === 'ai' ? 'AI narrative' : 'Officer'}</span>
                          <span className="ml-auto font-normal normal-case">{new Date(reply.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-foreground">{reply.message}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <textarea
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    placeholder="Write a reply to the complainant…"
                    rows={3}
                    className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={sendingReply}
                  />
                  <Button size="sm" className="self-end" onClick={handleSendReply} disabled={sendingReply || !replyDraft.trim()}>
                    {sendingReply ? 'Sending…' : 'Send reply'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
