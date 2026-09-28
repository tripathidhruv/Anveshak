import { useEffect, useState } from 'react'
import { Check, CheckCircle2, Database, Search, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { Input } from '@/components/ui/input'
import { PlainWords } from '@/components/ui/plain-words'
import { Spinner } from '@/components/ui/spinner'
import { Well } from '@/components/ui/well'
import { cn } from '@/lib/utils'
import { getAuthToken } from '@/lib/authToken'
import { getDepositIndexMatches as getDepositIndexMatchesHttp, type DepositIndexEntryOut } from '../api/httpApi'
import { getDepositIndexMatches as getDepositIndexMatchesMock } from '../api/mock'

/** Same locally-resolved one-env-var switch as `OperatorFingerprint.tsx`/`SanctionsScreening.tsx`
 * -- `getDepositIndexMatches` isn't part of the shared `KaizenApi` surface. Unlike those two,
 * the real endpoint is officer-gated (`require_role("officer")`, matching
 * `vasp_feed.py`'s `/replies` pattern -- see `backend/app/api/v1/deposit_index.py`'s own
 * docstring), so the http branch needs a bearer token the same way `FlaggedWallets.tsx` does;
 * the mock branch needs no token at all. */
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

function fetchDepositIndexMatches(chain: string, address: string): Promise<DepositIndexEntryOut[]> {
  if (USE_MOCK) return getDepositIndexMatchesMock(chain, address)
  const token = getAuthToken()
  if (!token) return Promise.reject(new Error('missing auth token'))
  return getDepositIndexMatchesHttp(chain, address, token)
}

const CHAIN_OPTIONS = [
  { label: 'TRON', value: 'tron' },
  { label: 'Ethereum', value: 'ethereum' },
  { label: 'Bitcoin', value: 'bitcoin' },
]

/** The one seeded DEMO address that hits the index in mock mode -- see `api/mock.ts`'s
 * `DEMO_DEPOSIT_INDEX_ENTRIES` -- reuses `DEMO.routeA`'s own consolidation-hub wallet, which in
 * the full demo trail pays directly into `DEMO.exchange`'s hot wallet. */
const DEMO_HIT_CHAIN = 'tron'
const DEMO_HIT_ADDRESS = 'TNh8yW5vC2mQ7fL4xK9pR'

function MatchCard({ match }: { match: DepositIndexEntryOut }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border-2 border-gold bg-gold/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconTile color="gold">
            <Database size={18} />
          </IconTile>
          <div>
            <p className="font-semibold text-foreground">{match.entityName}</p>
            <p className="text-xs text-muted-foreground">{match.chain}</p>
          </div>
        </div>
        <Badge variant="gold">Known deposit relationship</Badge>
      </div>
      <div className="grid grid-cols-1 gap-2 border-t border-gold/20 pt-3 text-sm sm:grid-cols-2">
        <div className="sm:col-span-2">
          <span className="text-xs text-muted-foreground">Exchange hot wallet it was seen paying into</span>
          <p className="break-all font-[family-name:var(--font-mono)] font-medium text-foreground">
            {match.hotWalletAddress}
          </p>
        </div>
        <div className="sm:col-span-2">
          <span className="text-xs text-muted-foreground">Indexed at</span>
          <p className="font-medium text-foreground">{new Date(match.indexedAt).toLocaleString()}</p>
        </div>
      </div>
    </div>
  )
}

/**
 * Inverted deposit index lookup -- surfaces `GET /api/v1/deposit-index/{chain}/{address}`
 * (`backend/app/api/v1/deposit_index.py`, wrapping `app/index/deposit_index.py`'s
 * `lookup_indexed_deposit`), previously only ever used silently inside `traces.py`'s own
 * hop-evaluation loop as an accelerant for live-trace attribution. This page makes that same
 * pre-built index directly queryable and visible on its own, standalone terms (same
 * standalone-route reasoning as `OperatorFingerprint.tsx`/`SanctionsScreening.tsx`: no case
 * workflow screen is in scope to cross-link from, so an officer pastes an address directly).
 *
 * The whole point of this screen is the distinction from a live trace: a live trace
 * (`Tracing.tsx`) walks the blockchain hop by hop, right now, for one case's suspect wallet.
 * This is the opposite motion -- an instant lookup against an index that was already built
 * OFFLINE, ahead of time, by backward-crawling every vetted exchange hot wallet's own inbound
 * history (`scripts/build_deposit_index.py`). No chain-API call happens when this page runs a
 * lookup; it is a plain database read, which is why it comes back instantly regardless of how
 * busy any blockchain explorer API currently is.
 */
export default function InvertedIndex() {
  const [chain, setChain] = useState(DEMO_HIT_CHAIN)
  const [addressInput, setAddressInput] = useState(DEMO_HIT_ADDRESS)
  const [query, setQuery] = useState<{ chain: string; address: string }>({
    chain: DEMO_HIT_CHAIN,
    address: DEMO_HIT_ADDRESS,
  })
  const [matches, setMatches] = useState<DepositIndexEntryOut[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setMatches(null)
    setError(null)
    fetchDepositIndexMatches(query.chain, query.address)
      .then((result) => {
        if (cancelled) return
        setMatches(result)
      })
      .catch(() => {
        if (cancelled) return
        setError('Could not look this address up in the index right now. Try again in a moment.')
      })
    return () => {
      cancelled = true
    }
  }, [query])

  function handleLookup(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = addressInput.trim()
    if (!trimmed) return
    setQuery({ chain, address: trimmed })
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex max-w-2xl flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-foreground">
            Has this address ever paid into a known exchange?
          </h1>
          <Badge variant="outline">DEMO DATA</Badge>
        </div>
        <p className="text-[15px] text-muted-foreground">
          KAIZEN keeps a pre-built index of every address that has been directly observed sending funds into a
          vetted exchange's own wallet. Paste any address below and this checks that index instantly — no
          blockchain crawl runs while you wait.
        </p>
        <p className="text-xs text-muted-foreground">Technical name: inverted (backward-crawled) deposit index.</p>
      </header>

      <div className="flex items-start gap-3 rounded-xl border border-sky/30 bg-sky/5 p-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky/15 text-sky">
          <Zap size={16} />
        </span>
        <p className="text-sm leading-relaxed text-foreground">
          <strong>This is not a live trace.</strong> A live trace (the Trace screen) walks a wallet's transactions
          hop by hop, right now, over the network. This screen instead checks an index built ahead of time by
          scanning known exchange wallets' own deposit history — that's why it answers immediately, and why it can
          only ever answer about addresses that scan has already covered.
        </p>
      </div>

      <Card className="flex flex-col gap-4 p-6">
        <form onSubmit={handleLookup} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Chain</span>
            <div className="flex flex-wrap gap-2.5">
              {CHAIN_OPTIONS.map((option) => {
                const selected = chain === option.value
                return (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setChain(option.value)}
                    className={cn(selected ? 'border-primary bg-primary/10 text-primary hover:bg-primary/10' : 'text-muted-foreground')}
                  >
                    {selected && <Check size={13} />}
                    {option.label}
                  </Button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <Input
              label="Wallet address"
              subtitle="Case-sensitive on TRON/Bitcoin; not case-sensitive on Ethereum"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              wrapperClassName="w-full sm:w-96"
              className="font-[family-name:var(--font-mono)]"
            />
            <Button type="submit" variant="secondary">
              <Search size={16} />
              Look up
            </Button>
          </div>
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
          <p>Checking the index…</p>
        </Card>
      )}

      {!error && matches && (
        <div className="flex flex-col gap-4">
          {matches.length === 0 ? (
            <Card className="flex flex-col items-center gap-3 border-2 border-moss bg-moss/5 p-10 text-center">
              <IconTile color="moss">
                <CheckCircle2 size={20} />
              </IconTile>
              <p className="font-semibold text-foreground">No known deposit relationship found in the index</p>
              <p className="max-w-md text-sm text-muted-foreground">
                <span className="break-all font-[family-name:var(--font-mono)]">{query.address}</span> has not been
                seen paying directly into any of the exchange wallets this index currently covers. This is an
                honest "not found" — it does not mean the address is clean, only that this particular pre-built
                index has no record of it.
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {matches.map((match) => (
                <MatchCard key={`${match.chain}::${match.hotWalletAddress}`} match={match} />
              ))}
            </div>
          )}

          <PlainWords>
            {matches.length === 0
              ? 'This address has never been observed sending funds directly into a known exchange wallet, at least not one this index has scanned so far.'
              : `This address has been seen sending funds directly to ${matches.length > 1 ? 'known exchange wallets' : 'a known exchange wallet'} — found by pre-scanning exchange wallets' own deposit history ahead of time, rather than by live-tracing this address's transactions just now.`}
          </PlainWords>

          <Well className="text-sm text-muted-foreground">
            Built by walking each vetted exchange's own hot wallet backward through its inbound transfers
            (offline, ahead of time) and recording every distinct address that paid into it. A hit here is strong,
            real evidence of a deposit relationship — but it only reflects exchanges and depositors this index has
            already scanned, so an empty result is never proof an address is unconnected to any exchange.
          </Well>
        </div>
      )}
    </div>
  )
}
