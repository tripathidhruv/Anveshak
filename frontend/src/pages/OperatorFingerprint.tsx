import { useEffect, useState } from 'react'
import { Fingerprint, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { Input } from '@/components/ui/input'
import { PlainWords } from '@/components/ui/plain-words'
import { Spinner } from '@/components/ui/spinner'
import { Well } from '@/components/ui/well'
import {
  getSimilarOperators as getSimilarOperatorsHttp,
  type SimilarOperatorResultOut,
  type SimilarOperatorsOut,
} from '../api/httpApi'
import { getSimilarOperators as getSimilarOperatorsMock } from '../api/mock'

/** Resolves the same one-env-var switch locally, matching `api/index.ts`'s own `VITE_USE_MOCK`
 * handling -- `getSimilarOperators` isn't part of the shared `AnveshakApi` surface (same reasoning
 * as `Evidence.tsx`'s `getEvidencePack`/`Campaigns.tsx`'s `getCampaignsList`: a real endpoint with
 * no client function/mock at all until this task). */
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
const fetchSimilarOperators: (caseId: string) => Promise<SimilarOperatorsOut> = USE_MOCK
  ? getSimilarOperatorsMock
  : getSimilarOperatorsHttp

/** Only case in the DEMO dataset with any clustered siblings behind it (mirrors the same
 * `FULL_DATA_CASE_ID` convention `Reports.tsx`/`Cases.tsx` already use). */
const FULL_DATA_CASE_ID = 'ANV-2026-0417'

function similarityBadgeVariant(score: number): 'vermillion' | 'gold' | 'secondary' {
  if (score >= 0.8) return 'vermillion'
  if (score >= 0.5) return 'gold'
  return 'secondary'
}

function similarityIconColour(score: number): 'vermillion' | 'gold' | 'sky' {
  if (score >= 0.8) return 'vermillion'
  if (score >= 0.5) return 'gold'
  return 'sky'
}

/** One clustered case's behavioural feature breakdown -- a plain key/value dict on the wire
 * (`SimilarOperatorResultOut.featureBreakdown`, typed as `Record<string, unknown>` since the
 * backend never promises a closed set of feature names), rendered as small label/value chips. */
function FeatureBreakdown({ breakdown }: { breakdown: Record<string, unknown> }) {
  const entries = Object.entries(breakdown)
  if (entries.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="rounded-full bg-muted px-2.5 py-1 font-[family-name:var(--font-mono)] text-xs text-muted-foreground"
        >
          {key}: {String(value)}
        </span>
      ))}
    </div>
  )
}

function ResultRow({ result }: { result: SimilarOperatorResultOut }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconTile color={similarityIconColour(result.similarityScore)} size="sm">
            <Fingerprint size={16} />
          </IconTile>
          <span className="font-[family-name:var(--font-mono)] text-sm font-semibold text-foreground">
            {result.caseId}
          </span>
        </div>
        <Badge variant={similarityBadgeVariant(result.similarityScore)}>
          {(result.similarityScore * 100).toFixed(0)}% similar
        </Badge>
      </div>
      <FeatureBreakdown breakdown={result.featureBreakdown} />
    </div>
  )
}

/**
 * Operator fingerprinting page -- surfaces `GET /api/v1/cases/{id}/similar-operators`
 * (`app/graph/operator_fingerprint.py`), previously computed by the backend with no UI at all.
 * Standalone route (not `/case/:id/...`) with its own case-id field rather than a URL param:
 * Cases.tsx and the case-workflow screens are out of this task's edit scope to add a cross-link
 * from, so this works given any case id typed in directly, same spirit as `FlaggedWallets.tsx`
 * being reachable on its own.
 */
export default function OperatorFingerprint() {
  const [caseIdInput, setCaseIdInput] = useState(FULL_DATA_CASE_ID)
  const [queriedCaseId, setQueriedCaseId] = useState(FULL_DATA_CASE_ID)
  const [data, setData] = useState<SimilarOperatorsOut | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    fetchSimilarOperators(queriedCaseId)
      .then((result) => {
        if (cancelled) return
        setData(result)
      })
      .catch(() => {
        if (cancelled) return
        setError('Could not load operator-similarity results for this case. Try again in a moment.')
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
            Other cases that behave like the same operator
          </h1>
          <Badge variant="outline">DEMO DATA</Badge>
        </div>
        <p className="text-[15px] text-muted-foreground">
          ANVESHAK groups cases by how the money moved — sweep speed, number of hops, whether funds landed in a shared
          collection wallet — and flags the ones that look like the same person or group ran them, even without any
          shared wallet address between them.
        </p>
        <p className="text-xs text-muted-foreground">
          Technical name: unsupervised cosine-similarity clustering over behavioural features.
        </p>
      </header>

      <Card className="p-6">
        <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3">
          <Input
            label="Case ID"
            subtitle="Look up similar operators for a different case"
            value={caseIdInput}
            onChange={(e) => setCaseIdInput(e.target.value)}
            wrapperClassName="w-full sm:w-72"
          />
          <Button type="submit" variant="secondary">
            <Search size={16} />
            Look up
          </Button>
        </form>
      </Card>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5 p-6 text-sm font-medium text-destructive">
          {error}
        </Card>
      )}

      {!error && !data && (
        <Card className="mx-auto flex max-w-[420px] flex-col items-center gap-4 p-10 text-center text-muted-foreground">
          <Spinner percent={70} label="Loading" />
          <p>Comparing behavioural fingerprints…</p>
        </Card>
      )}

      {!error && data && (
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-4 p-6">
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-foreground">
              Results for {data.caseId}
            </h2>
            {data.results.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
                <IconTile color="sky">
                  <Fingerprint size={20} />
                </IconTile>
                <p>No similar operators found for this case yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {data.results.map((result) => (
                  <ResultRow key={result.caseId} result={result} />
                ))}
              </div>
            )}
          </Card>

          <PlainWords>{data.disclaimer}</PlainWords>

          <Well className="text-sm text-muted-foreground">
            This is a similarity ranking, not an identity match — no labelled training data confirms any of these
            cases share a real-world operator. Treat a high score as a lead worth an officer's manual review, never
            as proof on its own.
          </Well>
        </div>
      )}
    </div>
  )
}
