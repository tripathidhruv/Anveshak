import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, FileJson, Gavel, ScrollText, Send, ShieldAlert, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { IconTile } from '@/components/ui/icon-tile'
import { Spinner } from '@/components/ui/spinner'
import { Well } from '@/components/ui/well'
import { ApiError } from '../api/client'
import {
  approveNotice,
  createNotice,
  getLegalCitations,
  getSahyogPayload,
  listNoticesForCase,
  rejectNotice,
  sendLegalNotice,
  type LegalCitation,
  type LegalNoticeOut,
} from '../api/httpApi'
import { useAuthStore } from '../store/authStore'

/** Screen for Task 14 — the notice-drafting page for `backend/app/api/v1/legal.py`, which had
 * zero frontend caller before this task despite existing for a while (backlog item 4).
 *
 * Reached at `/notices/new/:caseId` (officer-only, see App.tsx's officer `RequireRole` branch).
 * Standalone given a case id in the URL — Task 13's Cases/Tickets page linking to this screen
 * from a case detail view is a small follow-up, not a blocker for this task (per brief).
 *
 * `legal.py` has NO auth dependency today (a disclosed, existing scope limit — see
 * `backend/app/legal/notice_fsm.py`'s own docstring) — every call here is unauthenticated,
 * matching that backend exactly rather than quietly bolting on a bearer header it doesn't
 * expect.
 *
 * DEMO DATA — every case this screen can be pointed at is KAIZEN's synthetic case data
 * (CLAUDE.md rule 1); the legal citations themselves are UNVERIFIED against real statute text
 * (CLAUDE.md "Known gaps" / `citations.py`'s own DISCLAIMER, rendered into every notice body).
 */
export default function NoticeDrafting() {
  const { caseId } = useParams<{ caseId: string }>()
  const officerEmail = useAuthStore((s) => s.email)

  const [citations, setCitations] = useState<LegalCitation[] | null>(null)
  const [notices, setNotices] = useState<LegalNoticeOut[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [selectedCitationId, setSelectedCitationId] = useState<string>('')
  const [exchangeName, setExchangeName] = useState('')
  const [exchangeJurisdiction, setExchangeJurisdiction] = useState('')
  const [creating, setCreating] = useState(false)
  const [gateMessage, setGateMessage] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  // Per-notice transient UI state, keyed by notice id.
  const [approvedByDrafts, setApprovedByDrafts] = useState<Record<string, string>>({})
  const [rejectReasonDrafts, setRejectReasonDrafts] = useState<Record<string, string>>({})
  const [busyNoticeId, setBusyNoticeId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<Record<string, string>>({})

  const [payloadNoticeId, setPayloadNoticeId] = useState<string | null>(null)
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null)
  const [payloadLoading, setPayloadLoading] = useState(false)
  const [payloadError, setPayloadError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!caseId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    Promise.all([getLegalCitations(), listNoticesForCase(caseId)])
      .then(([citationList, noticeList]) => {
        if (cancelled) return
        setCitations(citationList)
        setNotices(noticeList)
        setSelectedCitationId((prev) => prev || citationList[0]?.id || '')
      })
      .catch(() => {
        if (cancelled) return
        setLoadError('Could not load citations or existing notices for this case. Try refreshing.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [caseId])

  useEffect(() => load(), [load])

  async function handleCreate() {
    if (!caseId || !selectedCitationId || creating) return
    setCreating(true)
    setGateMessage(null)
    setCreateError(null)
    try {
      const notice = await createNotice({
        caseId,
        citationId: selectedCitationId,
        exchangeName: exchangeName.trim() || undefined,
        exchangeJurisdiction: exchangeJurisdiction.trim() || undefined,
      })
      setNotices((prev) => [notice, ...(prev ?? [])])
      setExchangeName('')
      setExchangeJurisdiction('')
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // The innocence gate fired — `err.body` is `{detail: string}`, a plain-English
        // reason already composed server-side (legal.py's INNOCENCE_GATE_THRESHOLD block).
        // Show that text directly rather than a raw error blob.
        const detail = (err.body as { detail?: string } | undefined)?.detail
        setGateMessage(detail ?? 'This case is blocked from drafting a notice right now.')
      } else if (err instanceof ApiError && err.status === 400) {
        const detail = (err.body as { detail?: string } | undefined)?.detail
        setCreateError(detail ?? 'That citation is not recognised.')
      } else if (err instanceof ApiError && err.status === 404) {
        setCreateError('This case could not be found.')
      } else {
        setCreateError('Could not create the notice draft. Please try again.')
      }
    } finally {
      setCreating(false)
    }
  }

  async function handleApprove(notice: LegalNoticeOut) {
    const approvedBy = (approvedByDrafts[notice.id] ?? officerEmail ?? '').trim()
    if (!approvedBy || busyNoticeId) return
    setBusyNoticeId(notice.id)
    setActionError((prev) => ({ ...prev, [notice.id]: '' }))
    try {
      const updated = await approveNotice(notice.id, approvedBy)
      setNotices((prev) => (prev ?? []).map((n) => (n.id === updated.id ? updated : n)))
    } catch {
      setActionError((prev) => ({ ...prev, [notice.id]: 'Could not approve this notice — it may have already moved on.' }))
    } finally {
      setBusyNoticeId(null)
    }
  }

  async function handleReject(notice: LegalNoticeOut) {
    if (busyNoticeId) return
    setBusyNoticeId(notice.id)
    setActionError((prev) => ({ ...prev, [notice.id]: '' }))
    try {
      const updated = await rejectNotice(notice.id, rejectReasonDrafts[notice.id]?.trim() || undefined)
      setNotices((prev) => (prev ?? []).map((n) => (n.id === updated.id ? updated : n)))
    } catch {
      setActionError((prev) => ({ ...prev, [notice.id]: 'Could not reject this notice — it may have already moved on.' }))
    } finally {
      setBusyNoticeId(null)
    }
  }

  async function handleSend(notice: LegalNoticeOut) {
    if (busyNoticeId) return
    setBusyNoticeId(notice.id)
    setActionError((prev) => ({ ...prev, [notice.id]: '' }))
    try {
      const updated = await sendLegalNotice(notice.id)
      setNotices((prev) => (prev ?? []).map((n) => (n.id === updated.id ? updated : n)))
    } catch {
      setActionError((prev) => ({ ...prev, [notice.id]: 'Could not send this notice — it must be approved first.' }))
    } finally {
      setBusyNoticeId(null)
    }
  }

  async function openPayload(notice: LegalNoticeOut) {
    setPayloadNoticeId(notice.id)
    setPayload(null)
    setPayloadError(null)
    setPayloadLoading(true)
    try {
      const result = await getSahyogPayload(notice.id)
      setPayload(result)
    } catch {
      setPayloadError('Could not load the SAHYOG-shaped payload for this notice.')
    } finally {
      setPayloadLoading(false)
    }
  }

  if (!caseId) {
    return (
      <Card className="mx-auto my-16 flex max-w-md flex-col items-center gap-3 p-10 text-center">
        <IconTile color="vermillion" size="lg">
          <AlertTriangle size={22} />
        </IconTile>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">
          No case selected
        </h2>
        <p className="text-sm text-muted-foreground">
          This page needs a case id in the URL, e.g. <code className="font-[family-name:var(--font-mono)]">/notices/new/&lt;case-id&gt;</code>.
        </p>
      </Card>
    )
  }

  const selectedCitation = citations?.find((c) => c.id === selectedCitationId) ?? null

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-foreground">
          Draft a legal notice
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          DEMO DATA · case <span className="font-[family-name:var(--font-mono)] text-foreground/80">{caseId}</span> —
          draft, approve, and send lawful-action notices to the attributed exchange.
        </p>
      </header>

      {loading && (
        <Card className="mx-auto flex max-w-md flex-col items-center gap-4 p-10 text-center text-muted-foreground">
          <Spinner percent={70} label="Loading" />
          <p>Loading citations and existing notices…</p>
        </Card>
      )}

      {!loading && loadError && (
        <Card className="border-destructive/40 bg-destructive/5 p-6 text-sm font-medium text-destructive">
          {loadError}
        </Card>
      )}

      {!loading && !loadError && (
        <>
          {/* Existing notices for this case */}
          {notices && notices.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">
                Notices for this case
              </h2>
              {notices.map((notice) => (
                <NoticeCard
                  key={notice.id}
                  notice={notice}
                  citation={citations?.find((c) => c.id === notice.citationId) ?? null}
                  officerEmail={officerEmail}
                  approvedByDraft={approvedByDrafts[notice.id] ?? ''}
                  onApprovedByChange={(v) => setApprovedByDrafts((prev) => ({ ...prev, [notice.id]: v }))}
                  rejectReasonDraft={rejectReasonDrafts[notice.id] ?? ''}
                  onRejectReasonChange={(v) => setRejectReasonDrafts((prev) => ({ ...prev, [notice.id]: v }))}
                  busy={busyNoticeId === notice.id}
                  error={actionError[notice.id]}
                  onApprove={() => handleApprove(notice)}
                  onReject={() => handleReject(notice)}
                  onSend={() => handleSend(notice)}
                  onViewPayload={() => openPayload(notice)}
                />
              ))}
            </div>
          )}

          {/* Draft a new notice */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScrollText size={18} />
                Draft a new notice
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {gateMessage && (
                <Well className="flex items-start gap-3 border border-vermillion/30 bg-vermillion/10 text-sm text-foreground">
                  <ShieldAlert size={18} className="mt-0.5 shrink-0 text-vermillion" />
                  <div>
                    <p className="font-semibold text-vermillion">Blocked by the innocence gate</p>
                    <p className="mt-1 text-foreground/90">{gateMessage}</p>
                  </div>
                </Well>
              )}

              {createError && (
                <Well className="border border-destructive/30 bg-destructive/5 text-sm font-medium text-destructive">
                  {createError}
                </Well>
              )}

              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Citation / template
                </span>
                <div className="flex flex-col gap-2">
                  {citations?.map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-3.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                    >
                      <input
                        type="radio"
                        name="citation"
                        className="mt-1"
                        checked={selectedCitationId === c.id}
                        onChange={() => setSelectedCitationId(c.id)}
                      />
                      <span className="flex flex-col gap-0.5">
                        <span className="font-semibold text-foreground">
                          {c.statute} — {c.section}
                        </span>
                        <span className="text-muted-foreground">{c.title}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {selectedCitation?.unverified && (
                  <p className="flex items-center gap-1.5 text-xs text-gold">
                    <AlertTriangle size={13} />
                    Section number and wording are UNVERIFIED against current statute text — confirm before real use.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-foreground">Exchange name (optional)</span>
                  <input
                    className="rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={exchangeName}
                    onChange={(e) => setExchangeName(e.target.value)}
                    placeholder="Falls back to the confirmed attribution's entity name"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium text-foreground">Exchange jurisdiction (optional)</span>
                  <input
                    className="rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={exchangeJurisdiction}
                    onChange={(e) => setExchangeJurisdiction(e.target.value)}
                    placeholder="e.g. Singapore"
                  />
                </label>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleCreate} disabled={!selectedCitationId || creating}>
                  <Gavel size={16} />
                  {creating ? 'Creating…' : 'Create draft'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={payloadNoticeId != null} onOpenChange={(open) => !open && setPayloadNoticeId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson size={18} />
              SAHYOG-shaped payload
            </DialogTitle>
          </DialogHeader>
          {payloadLoading && (
            <div className="flex items-center justify-center gap-3 p-8 text-sm text-muted-foreground">
              <Spinner percent={70} label="Loading" size={64} strokeWidth={8} />
              Loading payload…
            </div>
          )}
          {!payloadLoading && payloadError && (
            <p className="rounded-lg bg-destructive/5 p-4 text-sm font-medium text-destructive">{payloadError}</p>
          )}
          {!payloadLoading && !payloadError && payload && (
            <div className="flex flex-col gap-3">
              <p className="rounded-lg bg-gold/10 px-3.5 py-2.5 text-xs font-semibold text-gold">
                Shaped for a future real SAHYOG/I4C integration — NOT verified against SAHYOG's actual published
                API. Confirm field names, authentication, and transport before any real submission.
              </p>
              <pre className="max-h-[420px] overflow-auto rounded-xl border border-border bg-muted p-4 font-[family-name:var(--font-mono)] text-xs leading-relaxed text-foreground">
                {JSON.stringify(payload, null, 2)}
              </pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

const STATE_BADGE: Record<LegalNoticeOut['state'], { label: string; variant: 'secondary' | 'gold' | 'moss' | 'vermillion' }> = {
  draft: { label: 'DRAFT', variant: 'gold' },
  approved: { label: 'APPROVED', variant: 'secondary' },
  sent: { label: 'SENT', variant: 'moss' },
  rejected: { label: 'REJECTED', variant: 'vermillion' },
}

interface NoticeCardProps {
  notice: LegalNoticeOut
  citation: LegalCitation | null
  officerEmail: string | null
  approvedByDraft: string
  onApprovedByChange: (v: string) => void
  rejectReasonDraft: string
  onRejectReasonChange: (v: string) => void
  busy: boolean
  error: string | undefined
  onApprove: () => void
  onReject: () => void
  onSend: () => void
  onViewPayload: () => void
}

/** One notice's state, body, and the FSM action(s) valid from its current state — matches
 * `notice_fsm.py`'s `ALLOWED_TRANSITIONS` exactly: draft -> {approved, rejected}; approved ->
 * {sent, rejected}; sent/rejected are terminal. */
function NoticeCard({
  notice,
  citation,
  officerEmail,
  approvedByDraft,
  onApprovedByChange,
  rejectReasonDraft,
  onRejectReasonChange,
  busy,
  error,
  onApprove,
  onReject,
  onSend,
  onViewPayload,
}: NoticeCardProps) {
  const badge = STATE_BADGE[notice.state]
  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-[family-name:var(--font-display)] text-base font-bold text-foreground">
            {citation ? `${citation.statute} — ${citation.section}` : notice.citationId}
          </p>
          {citation && <p className="text-xs text-muted-foreground">{citation.title}</p>}
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        Drafted {new Date(notice.createdAt).toLocaleString()}
        {notice.approvedBy && notice.approvedAt && (
          <> · approved by {notice.approvedBy} at {new Date(notice.approvedAt).toLocaleString()}</>
        )}
        {notice.sentAt && <> · sent {new Date(notice.sentAt).toLocaleString()}</>}
        {notice.rejectedReason && <> · rejected: {notice.rejectedReason}</>}
      </p>

      <textarea
        readOnly
        rows={8}
        value={notice.body}
        className="w-full resize-y rounded-xl border border-border bg-muted p-4 font-[family-name:var(--font-mono)] text-[12.5px] leading-relaxed text-foreground focus-visible:outline-none"
      />

      {error && <p className="text-xs font-medium text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        {notice.state === 'draft' && (
          <>
            <input
              className="min-w-[200px] flex-1 rounded-xl border border-border bg-card px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Approving officer's name/email"
              value={approvedByDraft || officerEmail || ''}
              onChange={(e) => onApprovedByChange(e.target.value)}
            />
            <Button size="sm" onClick={onApprove} disabled={busy || !(approvedByDraft || officerEmail || '').trim()}>
              <CheckCircle2 size={14} />
              {busy ? 'Approving…' : 'Approve'}
            </Button>
          </>
        )}

        {notice.state === 'approved' && (
          <Button size="sm" onClick={onSend} disabled={busy}>
            <Send size={14} />
            {busy ? 'Sending…' : 'Send'}
          </Button>
        )}

        {(notice.state === 'draft' || notice.state === 'approved') && (
          <>
            <input
              className="min-w-[160px] flex-1 rounded-xl border border-border bg-card px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Rejection reason (optional)"
              value={rejectReasonDraft}
              onChange={(e) => onRejectReasonChange(e.target.value)}
            />
            <Button size="sm" variant="outline" onClick={onReject} disabled={busy}>
              <XCircle size={14} />
              Reject
            </Button>
          </>
        )}

        <Button size="sm" variant="ghost" onClick={onViewPayload}>
          <FileJson size={14} />
          View SAHYOG payload
        </Button>
      </div>
    </Card>
  )
}
