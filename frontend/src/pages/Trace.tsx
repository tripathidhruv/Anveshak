import { useEffect, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { IconTile } from '@/components/ui/icon-tile'
import { PlainWords } from '@/components/ui/plain-words'
import { Badge } from '@/components/ui/badge'
import { api } from '../api'
import { useCaseStore } from '../store/caseStore'
import { useUIStore } from '../store/uiStore'
import { ROUTES } from '../utils/constants'
import type { Case } from '../types'

/** A wallet address "looks valid" for this demo if it's non-empty and starts with a plausible prefix. */
function isPlausibleWalletAddress(addr: string): boolean {
  return addr.trim().length >= 8 && /^[A-Za-z0-9]/.test(addr.trim())
}

/**
 * Trace — a quick-entry shortcut into the existing trace pipeline. Not a second tracing
 * engine: it pre-fills the same intake data New Case uses, lets the wallet be edited, then
 * calls the same api.createCase() and routes into the same Tracing screen New Case does.
 */
export default function Trace() {
  const navigate = useNavigate()
  const setActiveCase = useCaseStore((s) => s.setActiveCase)
  const showToast = useUIStore((s) => s.showToast)

  const [seed, setSeed] = useState<Case | null>(null)
  const [wallet, setWallet] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    // The mock API ignores the id argument and always returns the single demo case —
    // this only seeds the pre-filled wallet address and the rest of the intake payload.
    api.getCase('demo').then((demoCase) => {
      if (cancelled) return
      setSeed(demoCase)
      setWallet(demoCase.suspectWallet)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const walletValid = isPlausibleWalletAddress(wallet)

  async function handleStartTracing() {
    if (!seed) return
    setSubmitting(true)
    try {
      const createdCase = await api.createCase({
        complainant: seed.complainant,
        ncrp: seed.ncrp,
        location: seed.location,
        phone: seed.phone,
        incidentAt: seed.incidentAt,
        fraudType: seed.fraudType,
        amountINR: seed.amountINR,
        asset: seed.asset,
        chain: seed.chain,
        suspectWallet: wallet,
      })
      setActiveCase(createdCase)
      navigate(ROUTES.tracing(createdCase.id))
    } catch {
      setSubmitting(false)
      showToast('Could not start the trace — try again')
    }
  }

  if (!seed) {
    return <Card className="p-6">Loading trace entry point…</Card>
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <IconTile color="sky">
              <Search size={20} />
            </IconTile>
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-foreground">
                Trace a wallet
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                The fastest way in — paste the suspect wallet and jump straight into tracing.
              </p>
            </div>
          </div>
          <Badge variant="sky">DEMO DATA</Badge>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="traceWallet">
            The wallet address to trace
          </label>
          <span className="-mt-1 text-xs text-muted-foreground">
            Pre-filled with the demo wallet on file — edit it or paste a different one.
          </span>
          <div className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-card px-4.5 py-3 focus-within:ring-2 focus-within:ring-ring">
            <input
              id="traceWallet"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              spellCheck={false}
              className="min-w-0 flex-1 border-none bg-transparent font-[family-name:var(--font-mono)] text-base text-foreground outline-none"
            />
            {walletValid && (
              <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-moss">
                <Check size={15} /> Valid {seed.chain} address
              </span>
            )}
          </div>
        </div>

        <PlainWords>
          This starts the same trace the full case-intake form does — it just skips straight past the
          paperwork fields, using the complaint details already on file.
        </PlainWords>

        <div className="flex justify-end">
          <Button size="lg" onClick={handleStartTracing} disabled={submitting || !walletValid}>
            {submitting ? 'Starting…' : 'Start tracing →'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
