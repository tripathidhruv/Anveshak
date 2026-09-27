import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { BookmarkCheck, ShieldCheck, TicketX } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { Spinner } from '@/components/ui/spinner'
import { PlainWords } from '@/components/ui/plain-words'
import { CaseTicketDetail } from '../components/case/CaseTicketDetail'
import { getCaseByTicket, getTicketReplies, type CaseReplyOut } from '../api/httpApi'
import type { Case } from '../types'

interface LocationState {
  justFiled?: boolean
}

/**
 * `/my-ticket/:token` — a guest's own bookmarkable, no-login case-status page (unified-role-
 * based-portal design doc's "Guest citizens" section). Deliberately public: mounted OUTSIDE
 * `RequireRole` in `App.tsx`, same convention as `/vasp-portal/:token` -- the opaque
 * `guest_ticket_token` in the URL is the only credential, since a guest checking back later may
 * not even still have the `isGuest` flag in this browser (different device/session/cleared
 * storage). Uses the ticket-scoped, no-auth endpoints (`getCaseByTicket`/`getTicketReplies`,
 * Task 5b) rather than the bearer-token ones `MyComplaints.tsx` uses.
 */
export default function MyTicket() {
  const { token } = useParams<{ token: string }>()
  const location = useLocation()
  const justFiled = (location.state as LocationState | null)?.justFiled === true

  const [caseData, setCaseData] = useState<Case | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [replies, setReplies] = useState<CaseReplyOut[] | null>(null)
  const [repliesError, setRepliesError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    getCaseByTicket(token)
      .then((result) => {
        if (cancelled) return
        setCaseData(result)
      })
      .catch(() => {
        if (!cancelled) setNotFound(true)
      })
    getTicketReplies(token)
      .then((result) => {
        if (!cancelled) setReplies(result)
      })
      .catch(() => {
        if (cancelled) return
        setRepliesError('Could not load updates for this case.')
        setReplies([])
      })
    return () => {
      cancelled = true
    }
  }, [token])

  if (!token || notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <IconTile color="vermillion" size="lg">
          <TicketX size={22} />
        </IconTile>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
            Ticket not found
          </h1>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            This link doesn't match any complaint on file. Check that you copied the full link
            you were given after filing.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center gap-3">
        <IconTile color="primary">
          <ShieldCheck size={20} />
        </IconTile>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-foreground">
            Your complaint status
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">DEMO DATA · no account needed — this link is your access.</p>
        </div>
      </header>

      <PlainWords>
        <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
          <BookmarkCheck size={15} /> Bookmark this page.
        </span>{' '}
        {justFiled
          ? "Your complaint has been submitted. This link is the only way to check back on its status later — there's no account to log into."
          : "This link is the only way to check back on this complaint's status — there's no account to log into."}
      </PlainWords>

      {!caseData ? (
        <Card className="flex flex-col items-center gap-4 p-10 text-center text-muted-foreground">
          <Spinner percent={70} label="Loading" />
          <p>Loading your complaint…</p>
        </Card>
      ) : (
        <CaseTicketDetail caseData={caseData} replies={replies} repliesError={repliesError} />
      )}
    </div>
  )
}
