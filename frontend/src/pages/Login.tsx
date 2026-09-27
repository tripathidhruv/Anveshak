import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { KeyRound, Mail, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { AuroraBackground } from '@/components/ui/aurora-background'
import { setAuthToken } from '@/lib/authToken'
import { ROUTES } from '../utils/constants'

const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL
const TENANT = 'kaizen'
const OTP_LENGTH = 6
const RESEND_COOLDOWN_SECONDS = 60

type Step = 'email' | 'otp'

const GENERIC_ERROR = 'Something went wrong. Please try again.'

async function postJson(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(`${AUTH_API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  let data: any = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  return { ok: res.ok, status: res.status, data }
}

/** Officer login — two-step email + OTP flow against E:/API's Lighthouse Auth API
 * (a separate FastAPI service, see VITE_AUTH_API_URL). Not wrapped in PageShell/app-shell:
 * this is the one page reachable with no token at all. On success, stores the JWT and
 * redirects to the Dashboard. */
function Login() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const otpInputs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  async function sendOtp(e?: FormEvent) {
    e?.preventDefault()
    if (!email.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const { ok, status } = await postJson('/capAm/authentication/sendOtp', { tenant: TENANT, email: email.trim() })
      if (!ok) {
        setError(status === 404 ? 'Sign-in is not set up for this service yet.' : GENERIC_ERROR)
        return
      }
      setOtp(Array(OTP_LENGTH).fill(''))
      setStep('otp')
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch {
      setError('Could not reach the auth service. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function verifyOtp() {
    const code = otp.join('')
    if (code.length !== OTP_LENGTH || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const { ok, data } = await postJson('/capAm/authentication/verifyOtp', {
        tenant: TENANT,
        email: email.trim(),
        otp: code,
      })
      if (!ok || !data?.access_token) {
        setError('Invalid or expired code. Please try again.')
        setOtp(Array(OTP_LENGTH).fill(''))
        otpInputs.current[0]?.focus()
        return
      }
      setAuthToken(data.access_token as string)
      navigate(ROUTES.dashboard, { replace: true })
    } catch {
      setError('Could not reach the auth service. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1)
    setOtp((prev) => {
      const next = [...prev]
      next[index] = digit
      return next
    })
    if (digit && index < OTP_LENGTH - 1) {
      otpInputs.current[index + 1]?.focus()
    }
  }

  function handleOtpKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus()
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!pasted) return
    e.preventDefault()
    setOtp((prev) => {
      const next = [...prev]
      for (let i = 0; i < OTP_LENGTH; i++) next[i] = pasted[i] ?? ''
      return next
    })
    otpInputs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus()
  }

  const otpComplete = otp.every((d) => d !== '')

  return (
    <AuroraBackground className="flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <IconTile color="primary" size="lg">
            <ShieldCheck size={26} />
          </IconTile>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
              KAIZEN officer sign-in
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">DEMO DATA · email verification, no password needed</p>
          </div>
        </div>

        <Card className="overflow-hidden p-8">
          <AnimatePresence mode="wait" initial={false}>
            {step === 'email' ? (
              <motion.form
                key="email-step"
                onSubmit={sendOtp}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="flex flex-col gap-5"
              >
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="officer-email" className="text-sm font-medium text-foreground">
                    Work email
                  </label>
                  <span className="text-xs text-muted-foreground">
                    We'll send a 6-digit code to a pre-registered officer address.
                  </span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="officer-email"
                      type="email"
                      autoFocus
                      autoComplete="email"
                      required
                      placeholder="officer@example.gov.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-border bg-card py-2.5 pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>

                {error && <p className="text-sm font-medium text-destructive">{error}</p>}

                <Button type="submit" size="lg" disabled={submitting || !email.trim()} className="w-full">
                  {submitting ? 'Sending code…' : 'Send code'}
                </Button>
              </motion.form>
            ) : (
              <motion.div
                key="otp-step"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="flex flex-col gap-5"
              >
                <div className="flex flex-col gap-1.5 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <KeyRound size={18} />
                  </div>
                  <p className="text-sm font-medium text-foreground">Check your inbox</p>
                  <p className="text-xs text-muted-foreground">
                    Enter the 6-digit code sent to <span className="font-medium text-foreground">{email}</span>
                  </p>
                </div>

                <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        otpInputs.current[i] = el
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      autoFocus={i === 0}
                      className="h-12 w-11 rounded-xl border border-border bg-card text-center font-[family-name:var(--font-mono)] text-lg font-semibold text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  ))}
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center text-sm font-medium text-destructive"
                  >
                    {error}
                  </motion.p>
                )}

                <Button onClick={verifyOtp} size="lg" disabled={submitting || !otpComplete} className="w-full">
                  {submitting ? 'Verifying…' : 'Verify & sign in'}
                </Button>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('email')
                      setError(null)
                    }}
                    className="font-medium text-primary hover:underline"
                  >
                    Use a different email
                  </button>
                  <button
                    type="button"
                    onClick={() => sendOtp()}
                    disabled={cooldown > 0 || submitting}
                    className="font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>
    </AuroraBackground>
  )
}

export default Login
