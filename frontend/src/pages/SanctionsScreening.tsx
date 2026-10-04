import { useEffect, useState } from 'react'
import { Ban, Search, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { Input } from '@/components/ui/input'
import { PlainWords } from '@/components/ui/plain-words'
import { Spinner } from '@/components/ui/spinner'
import { getSanctionsMatches as getSanctionsMatchesHttp, type SanctionsMatchOut } from '../api/httpApi'
import { getSanctionsMatches as getSanctionsMatchesMock } from '../api/mock'

/** Same locally-resolved one-env-var switch as `OperatorFingerprint.tsx`/`Evidence.tsx`'s
 * `getEvidencePack` -- `getSanctionsMatches` isn't part of the shared `AnveshakApi` surface. */
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
const fetchSanctionsMatches: (caseId: string) => Promise<SanctionsMatchOut[]> = USE_MOCK
  ? getSanctionsMatchesMock
  : getSanctionsMatchesHttp

/** Same `FULL_DATA_CASE_ID` convention as `Reports.tsx`/`Cases.tsx` -- the one DEMO case with a
 * (synthetic) sanctions hit behind it in mock mode. */
const FULL_DATA_CASE_ID = 'ANV-2026-0417'

function MatchCard({ match }: { match: SanctionsMatchOut }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border-2 border-vermillion bg-vermillion/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconTile color="vermillion">
            <Ban size={18} />
          </IconTile>
          <div>
            <p className="font-[family-name:var(--font-mono)] text-sm font-semibold text-foreground">
              <span className="break-all">{match.walletAddress}</span>
            </p>
            <p className="text-xs text-muted-foreground">{match.chain}</p>
          </div>
        </div>
        <Badge variant="vermillion">Sanctions match</Badge>
      </div>
      <div className="grid grid-cols-1 gap-2 border-t border-vermillion/20 pt-3 text-sm sm:grid-cols-2">
        <div>
          <span className="text-xs text-muted-foreground">List source</span>
          <p className="font-medium text-foreground">{match.listSource}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">List version</span>
          <p className="font-medium text-foreground">{match.listVersion}</p>
        </div>
        <div className="sm:col-span-2">
          <span className="text-xs text-muted-foreground">Matched at</span>
          <p className="font-medium text-foreground">{new Date(match.matchedAt).toLocaleString()}</p>
        </div>
      </div>
    </div>
  )
}

/**
 * Sanctions screening page -- surfaces `GET /api/v1/sanctions/matches/{case_id}`
 * (`app/detectors`/OFAC SDN seed-list screening of every persisted hop for a case), previously
 * computed with no UI at all. Standalone route with an on-page case-id field, same reasoning as
 * `OperatorFingerprint.tsx` (Cases.tsx/the case workflow are out of this task's edit scope to
 * cross-link from). Any match gets deliberately high-visibility vermillion treatment per the
 * task brief and this project's colour semantics (vermillion = criminal path / high risk); the
 * no-match state is shown just as plainly, in moss, rather than looking like a loading state.
 */
export default function SanctionsScreening() {
  const [caseIdInput, setCaseIdInput] = useState(FULL_DATA_CASE_ID)
  const [queriedCaseId, setQueriedCaseId] = useState(FULL_DATA_CASE_ID)
  const [matches, setMatches] = useState<SanctionsMatchOut[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setMatches(null)
    setError(null)
    fetchSanctionsMatches(queriedCaseId)
      .then((result) => {
        if (cancelled) return
        setMatches(result)
      })
      .catch(() => {
        if (cancelled) return
        setError('Could not run sanctions screening for this case. Try again in a moment.')
      })
    return () => {
      cancelled = true
    }
  }, [queriedCaseId])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = caseIdInput.trim()
    if (!trimmed) return
    setQueriedCaseId(trimmed)
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex max-w-2xl flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-foreground">
            Is this wallet on a sanctions list?
          </h1>
          <Badge variant="outline">DEMO DATA</Badge>
        </div>
        <p className="text-[15px] text-muted-foreground">
          Every wallet this case's trace touched is checked against published international sanctions lists (e.g.
          OFAC's SDN list). A match here is a serious, independent red flag on top of ANVESHAK's own risk score.
        </p>
        <p className="text-xs text-muted-foreground">
          Technical name: sanctions/watchlist screening against the OFAC SDN seed list.
        </p>
      </header>

      <Card className="p-6">
        <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3">
          <Input
            label="Case ID"
            subtitle="Screen a different case's wallets"
            value={caseIdInput}
            onChange={(e) => setCaseIdInput(e.target.value)}
            wrapperClassName="w-full sm:w-72"
          />
          <Button type="submit" variant="secondary">
            <Search size={16} />
            Screen case
          </Button>
        </form>
      </Card>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5 p-6 text-sm font-medium text-destructive">
          {error}
        </Card>
      )}

      {!error && !matches && (
        <Card className="mx-auto flex max-w-[420px] flex-col items-center gap-4 p-10 text-center text-muted-foreground">
          <Spinner percent={70} label="Loading" />
          <p>Checking wallets against the sanctions list…</p>
        </Card>
      )}

      {!error && matches && (
        <div className="flex flex-col gap-4">
          {matches.length === 0 ? (
            <Card className="flex flex-col items-center gap-3 border-2 border-moss bg-moss/5 p-10 text-center">
              <IconTile color="moss">
                <ShieldCheck size={20} />
              </IconTile>
              <p className="font-semibold text-foreground">No sanctions matches found</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                None of the wallets in {queriedCaseId}'s trace appear on the screened sanctions lists as of now. This
                is not the same as the wallet being cleared — screening only covers what's on the list today.
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {matches.map((match) => (
                <MatchCard key={`${match.walletAddress}::${match.listSource}`} match={match} />
              ))}
            </div>
          )}

          <PlainWords>
            {matches.length === 0
              ? 'No wallet in this trace matched a published sanctions list at the time of this check.'
              : `${matches.length} wallet${matches.length > 1 ? 's' : ''} in this case's trace matched a published sanctions list — this is independent evidence, on top of the risk score, that this money needs urgent attention.`}
          </PlainWords>
        </div>
      )}
    </div>
  )
}
