import { Bot, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import type { Case, TicketStatus } from '../../types'
import type { CaseReplyOut } from '../../api/httpApi'
import { COLOUR_SEMANTICS, type SemanticColour } from '../../utils/constants'
import { formatINR } from '../../utils/format'

/** Plain-English label + colour semantic for a case's real, persisted workflow status
 * (`backend/app/api/v1/cases.py`'s `VALID_STATUS_TRANSITIONS` keys) -- shared by
 * `MyComplaints.tsx` and `MyTicket.tsx`, the two citizen-facing screens that show one case's
 * own status/replies rather than the officer registry's separate `CaseStatus` display enum
 * (`Cases.tsx` already owns that one). */
const STATUS_LABEL: Record<TicketStatus, string> = {
  new: 'Received',
  in_progress: 'Being investigated',
  handled: 'Action taken',
}

const STATUS_COLOUR: Record<TicketStatus, SemanticColour> = {
  new: 'info',
  in_progress: 'exchange',
  handled: 'safe',
}

function StatusBadge({ status }: { status: TicketStatus | undefined }) {
  const resolved = status ?? 'new'
  return <Badge variant={COLOUR_SEMANTICS[STATUS_COLOUR[resolved]]}>{STATUS_LABEL[resolved]}</Badge>
}

/** One reply — visually distinguishes an officer's own words from the system's auto-generated
 * AI narrative (attached when a case moves to `'handled'`, see `cases.py`'s `update_case_status`)
 * so a citizen never mistakes one for the other (CLAUDE.md's "nothing is a black box" rule --
 * a citizen deserves to know which replies are a person's, not just an algorithm's). */
function ReplyRow({ reply }: { reply: CaseReplyOut }) {
  const isAi = reply.authoredBy === 'ai'
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          {isAi ? <Bot size={14} className="text-violet" /> : <ShieldCheck size={14} className="text-sky" />}
          {isAi ? 'AI-generated case summary' : 'Officer reply'}
        </span>
        <span className="text-xs text-muted-foreground">{new Date(reply.createdAt).toLocaleString()}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm text-foreground">{reply.message}</p>
    </div>
  )
}

export interface CaseTicketDetailProps {
  caseData: Case
  /** `null` while still loading, `undefined`/empty array once loaded with none, or an error
   * string if the replies fetch itself failed (kept separate from a genuinely-empty list so
   * a citizen isn't told "no updates yet" when the real reason is a failed request). */
  replies: CaseReplyOut[] | null
  repliesError?: string | null
}

/** One case's full citizen-facing detail — status + every reply. Factored out of
 * `MyComplaints.tsx`/`MyTicket.tsx` (Task 12 brief) since both screens show exactly this once
 * they've resolved a case, differing only in HOW they fetch it (bearer token vs. ticket token). */
export function CaseTicketDetail({ caseData, replies, repliesError }: CaseTicketDetailProps) {
  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              NCRP acknowledgement
            </p>
            <p className="font-[family-name:var(--font-mono)] text-base font-bold text-foreground">
              {caseData.ncrp || '—'}
            </p>
          </div>
          <StatusBadge status={caseData.status} />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Complainant</p>
            <p className="text-sm font-medium text-foreground">{caseData.complainant}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Amount lost</p>
            <p className="font-[family-name:var(--font-mono)] text-sm font-medium text-foreground">
              {formatINR(caseData.amountINR)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Fraud type</p>
            <p className="text-sm font-medium text-foreground">{caseData.fraudType}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Reported</p>
            <p className="text-sm font-medium text-foreground">
              {new Date(caseData.reportedAt).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Wallet reported</p>
            <p className="truncate font-[family-name:var(--font-mono)] text-sm font-medium text-foreground">
              {caseData.suspectWallet}
            </p>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-foreground">
          Updates on this case
        </h3>

        {replies === null && (
          <Card className="flex flex-col items-center gap-3 p-8 text-center text-muted-foreground">
            <Spinner percent={70} label="Loading" />
            <p className="text-sm">Loading updates…</p>
          </Card>
        )}

        {replies !== null && repliesError && (
          <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm font-medium text-destructive">
            {repliesError}
          </Card>
        )}

        {replies !== null && !repliesError && replies.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No updates yet — an officer will post here once your case is reviewed.
          </Card>
        )}

        {replies !== null &&
          !repliesError &&
          replies.length > 0 &&
          replies.map((reply) => <ReplyRow key={reply.id} reply={reply} />)}
      </div>
    </div>
  )
}
