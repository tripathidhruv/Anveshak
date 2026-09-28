import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, LogOut, Plus, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { Spinner } from '@/components/ui/spinner'
import { clearAuthToken, clearGuestMode, getAuthToken } from '@/lib/authToken'
import { CaseTicketDetail } from '../components/case/CaseTicketDetail'
import { getCaseReplies as getCaseRepliesHttp, getMyCases as getMyCasesHttp, type CaseReplyOut } from '../api/httpApi'
import { getCaseReplies as getCaseRepliesMock, getMyCases as getMyCasesMock } from '../api/mock'
import { useAuthStore } from '../store/authStore'
import { ROUTES } from '../utils/constants'
import { COLOUR_SEMANTICS, type SemanticColour } from '../utils/constants'
import type { Case, TicketStatus } from '../types'
import { formatINR } from '../utils/format'

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

/** `getMyCases`/`getCaseReplies` aren't part of the shared `KaizenApi` mock/real switch
 * (`api/index.ts`), so this screen resolves the same one-env-var switch locally -- same pattern
 * `Evidence.tsx`/`RiskScore.tsx` already use for their own standalone endpoint pairs. Real bug
 * fixed here (2026-09-28): this screen previously always called the real backend regardless of
 * `VITE_USE_MOCK`, so it failed with a connection-refused error for every citizen demo click
 * (this is the Citizen role's default landing page on the instant role picker). */
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
const fetchMyCases: (token: string) => Promise<Case[]> = USE_MOCK ? getMyCasesMock : getMyCasesHttp
const fetchCaseReplies: (caseId: string, token: string) => Promise<CaseReplyOut[]> = USE_MOCK
  ? getCaseRepliesMock
  : getCaseRepliesHttp

/**
 * `/my-complaints` — a logged-in citizen's own filed cases (unified-role-based-portal design
 * doc). Guest-mode visitors never legitimately land here (they have no email/JWT to look
 * themselves up by; their equivalent is the ticket-token flow, `MyTicket.tsx`) — handled below
 * with an explanatory notice rather than a failed API call, in case someone reaches this route
 * directly (e.g. a stale bookmark from before "Continue as guest").
 */
export default function MyComplaints() {
  const navigate = useNavigate()
  const isGuest = useAuthStore((s) => s.isGuest)
  const email = useAuthStore((s) => s.email)
  const clearIdentity = useAuthStore((s) => s.clear)

  function handleLogout() {
    clearAuthToken()
    clearGuestMode()
    clearIdentity()
    navigate('/login', { replace: true })
  }

  const [cases, setCases] = useState<Case[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Case | null>(null)
  const [replies, setReplies] = useState<CaseReplyOut[] | null>(null)
  const [repliesError, setRepliesError] = useState<string | null>(null)

  useEffect(() => {
    if (isGuest) return
    let cancelled = false
    const token = getAuthToken()
    if (!token) {
      setListError('You need to be signed in to see your complaints.')
      return
    }
    fetchMyCases(token)
      .then((result) => {
        if (!cancelled) setCases(result)
      })
      .catch(() => {
        if (!cancelled) setListError('Could not load your complaints — your session may have expired.')
      })
    return () => {
      cancelled = true
    }
  }, [isGuest])

  function openCase(c: Case) {
    setSelected(c)
    setReplies(null)
    setRepliesError(null)
    const token = getAuthToken()
    if (!token) {
      setRepliesError('Your session has expired — sign in again to see updates.')
      setReplies([])
      return
    }
    fetchCaseReplies(c.id, token)
      .then(setReplies)
      .catch(() => {
        setRepliesError('Could not load updates for this case.')
        setReplies([])
      })
  }

  if (isGuest) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <button
          type="button"
          aria-label="Log out"
          title="Log out"
          onClick={handleLogout}
          className="absolute right-6 top-6 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-vermillion"
        >
          <LogOut size={16} />
        </button>
        <IconTile color="primary" size="lg">
          <UserRound size={24} />
        </IconTile>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
            You're browsing as a guest
          </h1>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            Guest complaints aren't tied to an account — use the private ticket link you were
            given after filing to check its status instead.
          </p>
        </div>
        <Button onClick={() => navigate(ROUTES.citizenComplaintNew)}>File a new complaint</Button>
      </div>
    )
  }

  if (selected) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="flex w-fit items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} /> Back to all complaints
        </button>
        <CaseTicketDetail caseData={selected} replies={replies} repliesError={repliesError} />
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-foreground">
            My complaints
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {email ? `Signed in as ${email}` : 'Every complaint filed under your account.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate(ROUTES.citizenComplaintNew)}>
            <Plus size={16} /> File a new complaint
          </Button>
          <button
            type="button"
            aria-label="Log out"
            title="Log out"
            onClick={handleLogout}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-vermillion"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {!cases && !listError && (
        <Card className="flex flex-col items-center gap-4 p-10 text-center text-muted-foreground">
          <Spinner percent={70} label="Loading" />
          <p>Loading your complaints…</p>
        </Card>
      )}

      {listError && (
        <Card className="border-destructive/40 bg-destructive/5 p-6 text-sm font-medium text-destructive">
          {listError}
        </Card>
      )}

      {cases && cases.length === 0 && (
        <Card className="flex flex-col items-center gap-3 p-10 text-center text-muted-foreground">
          <IconTile color="primary" size="lg">
            <FileText size={22} />
          </IconTile>
          <p className="text-sm">You haven't filed a complaint yet.</p>
        </Card>
      )}

      {cases && cases.length > 0 && (
        <div className="flex flex-col gap-3">
          {cases.map((c) => {
            const status = c.status ?? 'new'
            return (
              <Card
                key={c.id}
                onClick={() => openCase(c)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') openCase(c)
                }}
                className="flex cursor-pointer flex-col gap-2 p-5 transition-colors hover:bg-muted"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-[family-name:var(--font-mono)] text-sm font-semibold text-foreground">
                    {c.ncrp || c.id}
                  </p>
                  <Badge variant={COLOUR_SEMANTICS[STATUS_COLOUR[status]]}>{STATUS_LABEL[status]}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span>{c.fraudType}</span>
                  <span className="font-[family-name:var(--font-mono)]">{formatINR(c.amountINR)}</span>
                  <span>Filed {new Date(c.reportedAt).toLocaleDateString()}</span>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
