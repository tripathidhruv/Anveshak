import { useEffect, useState } from 'react'
import { ArrowLeft, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, Chip, Input, PlainWords, Button } from '../components/ui'
import { api } from '../api'
import { useCaseStore } from '../store/caseStore'
import { useUIStore } from '../store/uiStore'
import { ROUTES } from '../utils/constants'
import type { Case } from '../types'
import styles from './NewCase.module.css'

/** Cryptocurrency options for the segmented chip picker — each carries the chain it implies. */
const CRYPTO_OPTIONS = [
  { label: 'USDT (TRC-20)', chain: 'TRON' },
  { label: 'BTC', chain: 'Bitcoin' },
  { label: 'ETH', chain: 'Ethereum' },
] as const

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
    cryptoLabel: matchedCrypto?.label ?? CRYPTO_OPTIONS[0].label,
    incidentAt: source.incidentAt,
    fraudType: FRAUD_TYPES.includes(source.fraudType) ? source.fraudType : FRAUD_TYPES[0],
    suspectWallet: source.suspectWallet,
  }
}

const amountFormatter = new Intl.NumberFormat('en-IN')

/** A wallet address "looks valid" for this demo if it's non-empty and starts with a plausible prefix. */
function isPlausibleWalletAddress(addr: string): boolean {
  return addr.trim().length >= 8 && /^[A-Za-z0-9]/.test(addr.trim())
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
    // The mock API ignores the id argument and always returns the single demo case —
    // this is purely the "pre-filled" seed data for the intake form.
    api.getCase('demo').then((demoCase) => {
      if (cancelled) return
      setSeed(demoCase)
      setForm(toFormState(demoCase))
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!form || !seed) {
    return <Card>Loading case intake…</Card>
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  function handleAmountChange(raw: string) {
    const digitsOnly = raw.replace(/[^\d]/g, '')
    updateField('amountINR', digitsOnly ? Number(digitsOnly) : 0)
  }

  function handleFillDemoData() {
    if (!seed) return
    setForm(toFormState(seed))
    showToast('Demo data restored')
  }

  const walletValid = isPlausibleWalletAddress(form.suspectWallet)

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
        incidentAt: form.incidentAt,
        fraudType: form.fraudType,
        amountINR: form.amountINR,
        asset: selectedCrypto.label,
        chain: selectedCrypto.chain,
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
    <div className={styles.page}>
      <Card className={styles.sections}>
        <div className={styles.header}>
          <button
            type="button"
            className={styles.backButton}
            aria-label="Back to dashboard"
            onClick={() => navigate(ROUTES.dashboard)}
          >
            <ArrowLeft size={18} />
          </button>
          <div className={styles.headerText}>
            <h2>New Case</h2>
            <p>Pre-filled from the complaint already on file — every field stays editable.</p>
          </div>
          <button type="button" className={styles.fillDemoLink} onClick={handleFillDemoData}>
            Fill demo data
          </button>
        </div>

        <div className={styles.formGrid}>
          <div className={styles.column}>
            <span className={styles.columnHeading}>Who was defrauded?</span>

            <Input
              label="Complainant name"
              value={form.complainant}
              onChange={(e) => updateField('complainant', e.target.value)}
            />
            <Input
              label="NCRP acknowledgement number"
              className="mono"
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

          <div className={styles.column}>
            <span className={styles.columnHeading}>What was taken?</span>

            <div className={styles.amountWrapper}>
              <label className="label" htmlFor="amountINR">
                Amount lost (₹)
              </label>
              <div className={styles.amountField}>
                <span className={styles.amountCurrency}>₹</span>
                <input
                  id="amountINR"
                  className={styles.amountInput}
                  inputMode="numeric"
                  value={amountFormatter.format(form.amountINR)}
                  onChange={(e) => handleAmountChange(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.chipRow}>
              <span className="label">Cryptocurrency</span>
              <div className={styles.chips}>
                {CRYPTO_OPTIONS.map((option) => (
                  <Chip
                    key={option.label}
                    variant="segmented"
                    selected={form.cryptoLabel === option.label}
                    onClick={() => updateField('cryptoLabel', option.label)}
                  >
                    {form.cryptoLabel === option.label && <Check size={13} />}
                    {option.label}
                  </Chip>
                ))}
              </div>
            </div>

            <Input
              label="Date & time of transfer"
              value={form.incidentAt}
              onChange={(e) => updateField('incidentAt', e.target.value)}
            />

            <div className={styles.selectWrapper}>
              <label className="label" htmlFor="fraudType">
                Fraud type
              </label>
              <select
                id="fraudType"
                className={styles.select}
                value={form.fraudType}
                onChange={(e) => updateField('fraudType', e.target.value)}
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

        <div className={styles.walletSection}>
          <label className="label" htmlFor="suspectWallet">
            The wallet address the money was sent to
          </label>
          <span className={styles.walletSubtitle}>This is the only technical input required.</span>
          <div className={styles.walletWell}>
            <input
              id="suspectWallet"
              className={styles.walletInput}
              value={form.suspectWallet}
              onChange={(e) => updateField('suspectWallet', e.target.value)}
              spellCheck={false}
            />
            {walletValid && (
              <span className={styles.walletValid}>
                <Check size={15} /> Valid {seed.chain} address
              </span>
            )}
          </div>
        </div>

        <PlainWords>
          This is everything a police station already collects today. Nothing new is asked of the victim.
        </PlainWords>

        <div className={styles.footerRow}>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting || !walletValid}>
            {submitting ? 'Starting…' : 'Start tracing the money →'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
