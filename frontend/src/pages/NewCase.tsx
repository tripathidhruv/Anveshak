import { useEffect, useState } from 'react'
import { ArrowLeft, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PlainWords } from '@/components/ui/plain-words'
import { api } from '../api'
import { useCaseStore } from '../store/caseStore'
import { useUIStore } from '../store/uiStore'
import { ROUTES } from '../utils/constants'
import type { Case } from '../types'

/** Cryptocurrency options for the segmented chip picker — each carries the chain it implies. */
const CRYPTO_OPTIONS = [
  { label: 'USDT (TRC-20)', chain: 'TRON' },
  { label: 'BTC', chain: 'Bitcoin' },
  { label: 'ETH', chain: 'Ethereum' },
] as const

const DISPLAY_MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
}

/**
 * Converts a `Case.incidentAt` value — which may be the demo seed's human display string
 * (e.g. `'02 Sep 2026, 19:42 IST'`, see `api/mock.ts`'s `DEMO.case.incidentAt`) or a real
 * backend response's ISO 8601 timestamp (which carries a timezone offset, e.g.
 * `'2026-09-02T19:42:00+00:00'`) — into the timezone-free `YYYY-MM-DDTHH:mm` shape a native
 * `datetime-local` input requires (it silently refuses to display a value with an offset).
 * Also safe to call on a value already in that shape (e.g. round-tripped from the input
 * itself) — `Date` parses it fine and re-formatting it is a no-op.
 */
function toDatetimeLocalValue(display: string): string {
  const demoMatch = /^(\d{2}) (\w{3}) (\d{4}), (\d{2}):(\d{2})/.exec(display.trim())
  if (demoMatch) {
    const [, day, monAbbr, year, hour, minute] = demoMatch
    const month = DISPLAY_MONTHS[monAbbr]
    if (month) return `${year}-${month}-${day}T${hour}:${minute}`
  }
  const parsed = new Date(display)
  if (Number.isNaN(parsed.getTime())) return display
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
}

/** A few plausible fraud types alongside the demo's pre-selected one. */
const FRAUD_TYPES = [
  'Task-based job scam (Telegram)',
  'Investment/trading scam',
  'Fake loan app fraud',
  'OTP/phishing fraud',
  'Romance scam',
  'Fake job offer scam',
]

interface FormState {
  complainant: string
  ncrp: string
  location: string
  phone: string
  amountINR: number
  amountCrypto: number
  cryptoLabel: string
  incidentAt: string
  fraudType: string
  suspectWallet: string
}

function toFormState(source: Case): FormState {
  const matchedCrypto = CRYPTO_OPTIONS.find((option) => option.label === source.asset)
  return {
    complainant: source.complainant,
    ncrp: source.ncrp,
    location: source.location,
    phone: source.phone,
    amountINR: source.amountINR,
    amountCrypto: source.amountCrypto,
    cryptoLabel: matchedCrypto?.label ?? CRYPTO_OPTIONS[0].label,
    incidentAt: toDatetimeLocalValue(source.incidentAt),
    fraudType: FRAUD_TYPES.includes(source.fraudType) ? source.fraudType : FRAUD_TYPES[0],
    suspectWallet: source.suspectWallet,
  }
}

const amountFormatter = new Intl.NumberFormat('en-IN')

/** A wallet address "looks valid" for this demo if it's non-empty and starts with a plausible prefix. */
function isPlausibleWalletAddress(addr: string): boolean {
  return addr.trim().length >= 8 && /^[A-Za-z0-9]/.test(addr.trim())
}

/**
 * Empty, submittable starting point for the intake form when no seed case is available
 * (e.g. `getCase('demo')` 404s in live mode — see the mount effect below). The form is still
 * fully usable from here; the officer just has to fill it in by hand instead of it being
 * pre-populated.
 */
function defaultFormState(): FormState {
  return {
    complainant: '',
    ncrp: '',
    location: '',
    phone: '',
    amountINR: 0,
    amountCrypto: 0,
    cryptoLabel: CRYPTO_OPTIONS[0].label,
    incidentAt: '',
    fraudType: FRAUD_TYPES[0],
    suspectWallet: '',
  }
}

export default function NewCase() {
  const navigate = useNavigate()
  const setActiveCase = useCaseStore((s) => s.setActiveCase)
  const showToast = useUIStore((s) => s.showToast)

  const [seed, setSeed] = useState<Case | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    // The mock API ignores the id argument and always returns the single demo case — this is
    // purely the "pre-filled" seed data for the intake form. In live mode there is no case
    // literally named "demo" (cases get server-generated UUIDs), so this request 404s on every
    // fresh backend — that's an expected miss, not a fatal error, so we fall back to an empty
    // but fully submittable form instead of leaving the screen stuck on "Loading case intake…"
    // forever (an unhandled rejection here used to do exactly that).
    api
      .getCase('demo')
      .then((demoCase) => {
        if (cancelled) return
        setSeed(demoCase)
        setForm(toFormState(demoCase))
      })
      .catch(() => {
        if (cancelled) return
        setSeed(null)
        setForm(defaultFormState())
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!form) {
    return <Card className="p-6">Loading case intake…</Card>
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  function handleAmountChange(raw: string) {
    const digitsOnly = raw.replace(/[^\d]/g, '')
    updateField('amountINR', digitsOnly ? Number(digitsOnly) : 0)
  }

  function handleAmountCryptoChange(raw: string) {
    const numeric = raw.replace(/[^\d.]/g, '')
    updateField('amountCrypto', numeric ? Number(numeric) : 0)
  }

  function handleFillDemoData() {
    if (!seed) return
    setForm(toFormState(seed))
    showToast('Demo data restored')
  }

  const walletValid = isPlausibleWalletAddress(form.suspectWallet)
  // Used for the "Valid {chain} address" line below — the currently-selected chip, not the
  // (possibly absent) seed case, since the seed case's chain doesn't necessarily match whatever
  // the officer has selected in the cryptocurrency picker.
  const selectedCryptoChain = (CRYPTO_OPTIONS.find((option) => option.label === form.cryptoLabel) ?? CRYPTO_OPTIONS[0]).chain

  async function handleSubmit() {
    if (!form) return
    setSubmitting(true)
    try {
      const selectedCrypto = CRYPTO_OPTIONS.find((option) => option.label === form.cryptoLabel) ?? CRYPTO_OPTIONS[0]
      const createdCase = await api.createCase({
        complainant: form.complainant,
        ncrp: form.ncrp,
        location: form.location,
        phone: form.phone,
        // form.incidentAt holds whatever the datetime-local input naturally produces
        // (`YYYY-MM-DDTHH:mm`) — converted to a real ISO 8601 instant only here, at the
        // request-body boundary, not stored as ISO in form state.
        incidentAt: new Date(form.incidentAt).toISOString(),
        fraudType: form.fraudType,
        amountINR: form.amountINR,
        amountCrypto: form.amountCrypto,
        asset: selectedCrypto.label,
        // The backend's chain registry matches lowercase literals only ("tron", "ethereum",
        // "bitcoin") — the display label/chip text stays as-is for the user.
        chain: selectedCrypto.chain.toLowerCase(),
        suspectWallet: form.suspectWallet,
      })
      setActiveCase(createdCase)
      navigate(ROUTES.tracing(createdCase.id))
    } catch {
      setSubmitting(false)
      showToast('Could not start the trace — try again')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            aria-label="Back to dashboard"
            onClick={() => navigate(ROUTES.dashboard)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-foreground">New Case</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Pre-filled from the complaint already on file — every field stays editable.
            </p>
          </div>
          <button
            type="button"
            onClick={handleFillDemoData}
            className="whitespace-nowrap text-sm font-semibold text-sky hover:underline"
          >
            Fill demo data
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Who was defrauded?
            </span>

            <Input
              label="Complainant name"
              value={form.complainant}
              onChange={(e) => updateField('complainant', e.target.value)}
            />
            <Input
              label="NCRP acknowledgement number"
              className="font-[family-name:var(--font-mono)]"
              value={form.ncrp}
              onChange={(e) => updateField('ncrp', e.target.value)}
            />
            <Input
              label="State / district"
              value={form.location}
              onChange={(e) => updateField('location', e.target.value)}
            />
            <Input label="Contact" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
          </div>

          <div className="flex flex-col gap-4.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What was taken?
            </span>

            <div className="flex w-full flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="amountINR">
                Amount lost (₹)
              </label>
              <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 focus-within:ring-2 focus-within:ring-ring">
                <span className="font-[family-name:var(--font-mono)] text-sm text-muted-foreground">₹</span>
                <input
                  id="amountINR"
                  inputMode="numeric"
                  value={amountFormatter.format(form.amountINR)}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="w-full border-none bg-transparent font-[family-name:var(--font-mono)] text-sm text-foreground outline-none"
                />
              </div>
            </div>

            <div className="flex w-full flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="amountCrypto">
                Amount lost (crypto)
              </label>
              <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 focus-within:ring-2 focus-within:ring-ring">
                <input
                  id="amountCrypto"
                  inputMode="decimal"
                  value={form.amountCrypto}
                  onChange={(e) => handleAmountCryptoChange(e.target.value)}
                  className="w-full border-none bg-transparent font-[family-name:var(--font-mono)] text-sm text-foreground outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Cryptocurrency</span>
              <div className="flex flex-wrap gap-2.5">
                {CRYPTO_OPTIONS.map((option) => {
                  const selected = form.cryptoLabel === option.label
                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => updateField('cryptoLabel', option.label)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors',
                        selected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {selected && <Check size={13} />}
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <Input
              type="datetime-local"
              label="Date & time of transfer"
              value={form.incidentAt}
              onChange={(e) => updateField('incidentAt', e.target.value)}
            />

            <div className="flex w-full flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="fraudType">
                Fraud type
              </label>
              <select
                id="fraudType"
                value={form.fraudType}
                onChange={(e) => updateField('fraudType', e.target.value)}
                className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              >
                {FRAUD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="suspectWallet">
            The wallet address the money was sent to
          </label>
          <span className="-mt-1 text-xs text-muted-foreground">This is the only technical input required.</span>
          <div className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-card px-4.5 py-3 focus-within:ring-2 focus-within:ring-ring">
            <input
              id="suspectWallet"
              value={form.suspectWallet}
              onChange={(e) => updateField('suspectWallet', e.target.value)}
              spellCheck={false}
              className="min-w-0 flex-1 border-none bg-transparent font-[family-name:var(--font-mono)] text-base text-foreground outline-none"
            />
            {walletValid && (
              <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-moss">
                <Check size={15} /> Valid {selectedCryptoChain} address
              </span>
            )}
          </div>
        </div>

        <PlainWords>
          This is everything a police station already collects today. Nothing new is asked of the victim.
        </PlainWords>

        <div className="flex justify-end">
          <Button size="lg" onClick={handleSubmit} disabled={submitting || !walletValid}>
            {submitting ? 'Starting…' : 'Start tracing the money →'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
