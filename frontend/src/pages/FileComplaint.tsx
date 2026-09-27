import { useState } from 'react'
import { Check, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PlainWords } from '@/components/ui/plain-words'
import { IconTile } from '@/components/ui/icon-tile'
import { api } from '../api'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { ROUTES } from '../utils/constants'

/** Same segmented cryptocurrency picker as `NewCase.tsx` -- duplicated here rather than
 * imported, since `NewCase.tsx` stays the officer-filling-out-for-complainant flow (this task's
 * brief says not to modify it) and doesn't export any of its internals for reuse. */
const CRYPTO_OPTIONS = [
  { label: 'USDT (TRC-20)', chain: 'TRON' },
  { label: 'BTC', chain: 'Bitcoin' },
  { label: 'ETH', chain: 'Ethereum' },
] as const

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

function emptyForm(): FormState {
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

const amountFormatter = new Intl.NumberFormat('en-IN')

/** A wallet address "looks valid" for this demo if it's non-empty and starts with a plausible
 * prefix -- identical rule to `NewCase.tsx`'s own check. */
function isPlausibleWalletAddress(addr: string): boolean {
  return addr.trim().length >= 8 && /^[A-Za-z0-9]/.test(addr.trim())
}

/**
 * Citizen/guest-facing complaint intake — `/complaint/new` (unified-role-based-portal design
 * doc). Same field set and validation as `NewCase.tsx` (the officer's own intake form), but a
 * NEW page: this one starts blank (no seeded demo case to pre-fill from -- there is no
 * complaint "already on file" for someone filing their own), and its copy speaks to the
 * complainant directly rather than to an officer.
 *
 * On success: a guest (no bearer token at all -- `_resolve_filer` in `cases.py` treats a
 * missing/invalid token as guest) gets back a `guestTicketToken` and is sent to their own
 * bookmarkable ticket page; a logged-in citizen (has `useAuthStore` email) has no ticket token
 * at all and is sent to their complaints list instead, where the same case now shows up.
 */
export default function FileComplaint() {
  const navigate = useNavigate()
  const showToast = useUIStore((s) => s.showToast)
  const isGuest = useAuthStore((s) => s.isGuest)

  const [form, setForm] = useState<FormState>(emptyForm())
  const [submitting, setSubmitting] = useState(false)
  // Fallback success state for a guest submission that came back with no guestTicketToken at
  // all (e.g. mock mode, which has no guest/citizen concept) -- an honest "it worked, but we
  // have nowhere bookmarkable to send you" outcome rather than a silent no-op navigate.
  const [filedWithNoTicket, setFiledWithNoTicket] = useState(false)

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleAmountChange(raw: string) {
    const digitsOnly = raw.replace(/[^\d]/g, '')
    updateField('amountINR', digitsOnly ? Number(digitsOnly) : 0)
  }

  function handleAmountCryptoChange(raw: string) {
    const numeric = raw.replace(/[^\d.]/g, '')
    updateField('amountCrypto', numeric ? Number(numeric) : 0)
  }

  const walletValid = isPlausibleWalletAddress(form.suspectWallet)
  const requiredFieldsFilled =
    form.complainant.trim() !== '' &&
    form.ncrp.trim() !== '' &&
    form.location.trim() !== '' &&
    form.phone.trim() !== '' &&
    form.incidentAt !== ''
  const selectedCryptoChain = (CRYPTO_OPTIONS.find((option) => option.label === form.cryptoLabel) ?? CRYPTO_OPTIONS[0]).chain

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const selectedCrypto = CRYPTO_OPTIONS.find((option) => option.label === form.cryptoLabel) ?? CRYPTO_OPTIONS[0]
      const createdCase = await api.createCase({
        complainant: form.complainant,
        ncrp: form.ncrp,
        location: form.location,
        phone: form.phone,
        incidentAt: new Date(form.incidentAt).toISOString(),
        fraudType: form.fraudType,
        amountINR: form.amountINR,
        amountCrypto: form.amountCrypto,
        asset: selectedCrypto.label,
        chain: selectedCrypto.chain.toLowerCase(),
        suspectWallet: form.suspectWallet,
      })

      if (createdCase.guestTicketToken) {
        navigate(ROUTES.myTicket(createdCase.guestTicketToken), { state: { justFiled: true } })
        return
      }
      if (useAuthStore.getState().email) {
        navigate(ROUTES.citizenMyComplaints, { state: { justFiled: true } })
        return
      }
      // Guest, but nothing bookmarkable came back (mock mode has no guest concept at all) --
      // stay on this screen with an honest confirmation instead of navigating nowhere useful.
      setFiledWithNoTicket(true)
      showToast('Complaint filed')
    } catch {
      showToast('Could not file your complaint — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  if (filedWithNoTicket) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <IconTile color="moss" size="lg">
          <Check size={22} />
        </IconTile>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-foreground">
            Complaint filed
          </h1>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            DEMO DATA · your complaint was recorded. No bookmarkable ticket link is available in
            this demo mode.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <Card className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-3.5">
          <IconTile color="primary">
            <ShieldCheck size={20} />
          </IconTile>
          <div className="min-w-0 flex-1">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-foreground">
              File a complaint
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Tell us what happened — every field below is what a police station already asks for.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Who was defrauded?
            </span>

            <Input
              label="Your name"
              value={form.complainant}
              onChange={(e) => updateField('complainant', e.target.value)}
            />
            <Input
              label="NCRP acknowledgement number"
              subtitle="From your report at cybercrime.gov.in, if you've already filed one there"
              className="font-[family-name:var(--font-mono)]"
              value={form.ncrp}
              onChange={(e) => updateField('ncrp', e.target.value)}
            />
            <Input
              label="State / district"
              value={form.location}
              onChange={(e) => updateField('location', e.target.value)}
            />
            <Input
              label="Contact number"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
            />
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
                    <Button
                      key={option.label}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => updateField('cryptoLabel', option.label)}
                      className={cn(
                        selected
                          ? 'border-primary bg-primary/10 text-primary hover:bg-primary/10'
                          : 'text-muted-foreground',
                      )}
                    >
                      {selected && <Check size={13} />}
                      {option.label}
                    </Button>
                  )
                })}
              </div>
            </div>

            <Input
              type="datetime-local"
              label="Date & time you sent the money"
              value={form.incidentAt}
              onChange={(e) => updateField('incidentAt', e.target.value)}
            />

            <div className="flex w-full flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="fraudType">
                What kind of fraud was this?
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
            The wallet address you sent the money to
          </label>
          <span className="-mt-1 text-xs text-muted-foreground">
            Copy this exactly from your transaction history — this is the only technical detail we need.
          </span>
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
          {isGuest
            ? "You're filing as a guest — after you submit, you'll get a private link to check your case's status. Bookmark it, since there's no account to log back into."
            : 'This goes straight to the cyber cell — no separate visit needed to start the trace.'}
        </PlainWords>

        <div className="flex justify-end">
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={submitting || !walletValid || !requiredFieldsFilled}
          >
            {submitting ? 'Submitting…' : 'Submit complaint →'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
