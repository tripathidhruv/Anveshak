import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Landmark, ShieldCheck, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { AuroraBackground } from '@/components/ui/aurora-background'
import { setAuthToken, setGuestMode } from '@/lib/authToken'
import { useAuthStore, type Role } from '@/store/authStore'
import { ROUTES } from '../utils/constants'

/** Where each role lands right after picking it (unified-role-based-portal design doc's
 * "Frontend shape" section). A logged-in citizen goes to their complaints list, not the
 * complaint-filing form -- that's the guest-only landing page (see the "Continue as guest"
 * button below), since a citizen who already has an account presumably wants to check on
 * what they already filed at least as often as file something new. */
function roleHome(role: Role): string {
  switch (role) {
    case 'officer':
      return ROUTES.dashboard
    case 'exchange':
      return ROUTES.exchangeHome
    case 'citizen':
      return ROUTES.citizenMyComplaints
  }
}

/** The clearly-fake demo email `setIdentity` is called with for each role -- there is no real
 * account behind any of these, per CLAUDE.md's "all prototype data is synthetic" rule. */
function demoEmailFor(role: Role): string {
  return `${role}@kaizen.demo`
}

interface RoleCard {
  role: Role
  label: string
  description: string
  icon: LucideIcon
  color: 'primary' | 'gold' | 'sky'
}

const ROLE_CARDS: RoleCard[] = [
  {
    role: 'officer',
    label: 'Officer',
    description: 'Investigate cases, trace stolen funds, and draft legal notices.',
    icon: ShieldCheck,
    color: 'primary',
  },
  {
    role: 'exchange',
    label: 'Exchange',
    description: 'Review flagged wallets and respond to compliance requests.',
    // gold = exchange everywhere else in KAIZEN's design system (CLAUDE.md's colour semantics)
    icon: Landmark,
    color: 'gold',
  },
  {
    role: 'citizen',
    label: 'Citizen',
    description: 'File a fraud complaint and track what happens to it.',
    icon: UserRound,
    color: 'sky',
  },
]

/** Instant role picker -- replaces the real email + OTP officer sign-in that used to call
 * E:/API's Lighthouse Auth API (a separate FastAPI repo). That auth microservice is not part of
 * this deployment target (a static/demo-only AWS EC2 build) and won't be reachable there, so
 * there is no OTP, no JWT, and no network call on this page at all any more: clicking a role
 * card sets a clearly-fake demo identity (see `demoEmailFor`) directly on `useAuthStore` and
 * persists just the chosen role string to localStorage (see `lib/authToken.ts`) so a hard
 * refresh doesn't bounce back here -- `RequireRole` reads that directly, with no `GET
 * /api/v1/me` call involved. DEMO DATA throughout, per CLAUDE.md. Not wrapped in PageShell/app-
 * shell: this is the one page reachable with no identity at all. */
function Login() {
  const navigate = useNavigate()

  function selectRole(role: Role) {
    setAuthToken(role)
    useAuthStore.getState().setIdentity(demoEmailFor(role), role)
    navigate(roleHome(role), { replace: true })
  }

  /** Task 10 brief / design doc's "Guest citizens" section: no OTP, no JWT, no `UserRole` row
   * -- just a local flag and a straight navigation to the complaint-filing form. */
  function continueAsGuest() {
    setGuestMode()
    useAuthStore.getState().setGuest()
    navigate(ROUTES.citizenComplaintNew, { replace: true })
  }

  return (
    <AuroraBackground className="flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl">
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <IconTile color="primary" size="lg">
            <ShieldCheck size={26} />
          </IconTile>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground">
              Welcome to KAIZEN
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              DEMO DATA · pick how you&rsquo;re using KAIZEN to jump straight in
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          {ROLE_CARDS.map((card, i) => (
            <motion.button
              key={card.role}
              type="button"
              onClick={() => selectRole(card.role)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.06, ease: 'easeOut' }}
              className="text-left focus-visible:outline-none"
            >
              <Card className="flex h-full flex-col items-start gap-4 p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                <IconTile color={card.color} size="lg">
                  <card.icon size={24} />
                </IconTile>
                <div>
                  <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-foreground">
                    {card.label}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
                </div>
              </Card>
            </motion.button>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center gap-2">
          <p className="text-xs text-muted-foreground">Filing a complaint and don&rsquo;t have an account?</p>
          <Button type="button" variant="outline" onClick={continueAsGuest} className="w-full max-w-xs">
            Continue as guest
          </Button>
        </div>
      </div>
    </AuroraBackground>
  )
}

export default Login
