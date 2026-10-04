import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { getAuthToken } from '@/lib/authToken'
import { getFlaggedWallets as getFlaggedWalletsHttp, type BackendFlaggedWallet } from '../api/httpApi'
import { getFlaggedWallets as getFlaggedWalletsMock } from '../api/mock'
import { ROUTES } from '../utils/constants'

/** `getFlaggedWallets` isn't part of the shared `AnveshakApi` mock/real switch (`api/index.ts`),
 * so this screen resolves the same one-env-var switch locally -- same pattern `Evidence.tsx`/
 * `RiskScore.tsx`/`MyComplaints.tsx` already use for their own standalone endpoint pairs. Real
 * bug fixed here (2026-09-28): this screen previously always called the real backend regardless
 * of `VITE_USE_MOCK`, so it showed a "session may have expired" error for every demo click. */
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
const fetchFlaggedWallets: (token: string) => Promise<BackendFlaggedWallet[]> = USE_MOCK
  ? getFlaggedWalletsMock
  : getFlaggedWalletsHttp

/** Officer-only screen (Task 11, unified-role-based-portal design) -- `GET
 * /flagged-wallets/all` (Task 6, `require_role("officer")`) is the system-wide, full-detail
 * flagged-wallet view, distinct from the unauthenticated VASP pull API at the bare
 * `/flagged-wallets` path (see that endpoint's own docstring in backend/app/api/v1/vasp_feed.py
 * for why it can't reuse the same path). No `id` field comes back on this schema, so rows key
 * off address+chain, and case-ID links route to the `/cases` registry (there is no canonical
 * single-case-detail route anywhere else in this app yet -- see Cases.tsx's own comment on
 * this) rather than to a specific case, since nothing here resolves a `caseId` to one. */
export default function FlaggedWallets() {
  const navigate = useNavigate()
  const [wallets, setWallets] = useState<BackendFlaggedWallet[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    const token = getAuthToken()
    if (!token) {
      setError('Your session may have expired — try signing in again.')
      return
    }
    fetchFlaggedWallets(token)
      .then((result) => {
        if (cancelled) return
        setWallets(result)
      })
      .catch(() => {
        if (cancelled) return
        setError('Could not load flagged wallets. Your session may have expired — try signing in again.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (!wallets) return []
    const q = query.trim().toLowerCase()
    if (!q) return wallets
    return wallets.filter(
      (w) =>
        w.address.toLowerCase().includes(q) ||
        w.chain.toLowerCase().includes(q) ||
        w.caseIds.some((id) => id.toLowerCase().includes(q)),
    )
  }, [wallets, query])

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-xl">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-foreground">
          Flagged wallets
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          DEMO DATA · every wallet ANVESHAK has flagged system-wide, across every case.
        </p>
      </header>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5 p-6 text-sm font-medium text-destructive">
          {error}
        </Card>
      )}

      {!error && (
        <Card className="flex flex-col gap-4 p-6">
          <div className="w-full sm:w-72">
            <Input
              placeholder="Search address, chain or case ID"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {!wallets ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center text-muted-foreground">
              <Spinner percent={70} label="Loading" />
              <p>Loading flagged wallets…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
              <IconTile color="vermillion">
                <ShieldAlert size={20} />
              </IconTile>
              <p>{wallets.length === 0 ? 'No wallets have been flagged yet.' : 'No wallets match this search.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Address
                    </th>
                    <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Chain
                    </th>
                    <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Risk
                    </th>
                    <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Related cases
                    </th>
                    <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Flagged
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((wallet) => {
                    const highRisk = wallet.riskScore >= 0.5
                    return (
                      <tr key={`${wallet.address}::${wallet.chain}`}>
                        <td className="border-b border-border px-3 py-3 font-[family-name:var(--font-mono)] text-sm text-foreground">
                          <span className="break-all">{wallet.address}</span>
                        </td>
                        <td className="whitespace-nowrap border-b border-border px-3 py-3 text-sm text-foreground">
                          {wallet.chain}
                        </td>
                        <td className="whitespace-nowrap border-b border-border px-3 py-3">
                          <Badge variant={highRisk ? 'vermillion' : 'secondary'}>
                            {(wallet.riskScore * 100).toFixed(0)}%
                          </Badge>
                        </td>
                        <td className="border-b border-border px-3 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {wallet.caseIds.length === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              wallet.caseIds.map((caseId) => (
                                <button
                                  key={caseId}
                                  type="button"
                                  onClick={() => navigate(ROUTES.cases)}
                                  className="rounded-full bg-muted px-2.5 py-1 font-[family-name:var(--font-mono)] text-xs font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                                >
                                  {caseId}
                                </button>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap border-b border-border px-3 py-3 text-sm text-muted-foreground">
                          {new Date(wallet.flaggedAt).toLocaleString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
