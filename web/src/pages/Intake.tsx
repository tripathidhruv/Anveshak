import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useLenis } from 'lenis/react'
import { ArrowLeft, ArrowRight, RotateCcw, ScanText } from 'lucide-react'
import { Button, Chip, DemoChip, PageHeader } from '@/components/kit'
import { USE_MOCK } from '@/api'
import { FIELD_LABEL } from './intake/data'
import { Kbd, StageFooter, Stepper } from './intake/parts'
import { missingRequired, STAGES, useDraft, walletProblem, type StageIndex } from './intake/draft'
import { MIN_CHARS, StageComplaint } from './intake/StageComplaint'
import { StageReading } from './intake/StageReading'
import { StageDetails } from './intake/StageDetails'
import { StageLinks } from './intake/StageLinks'
import { StageOpen } from './intake/StageOpen'

/** Slide in from the side we're heading to; blur + scale sells the hand-off between stages. */
const stageVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 72, scale: 0.985, filter: 'blur(10px)' }),
  center: { opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' },
  exit: (dir: number) => ({ opacity: 0, x: dir * -56, scale: 0.985, filter: 'blur(8px)' }),
}

export default function IntakePage() {
  const { draft, patch, reset } = useDraft()
  const [dir, setDir] = React.useState(1)
  const [confirmReset, setConfirmReset] = React.useState(false)
  const lenis = useLenis()
  const { stage } = draft

  const fresh = Boolean(draft.parse) && draft.text === draft.parsedText
  const missing = draft.parse ? missingRequired(draft) : []
  const wallet = walletProblem(draft)
  const detailsOk = fresh && missing.length === 0 && !wallet
  const reachable = (i: StageIndex) => (i === 0 ? true : i === 2 ? fresh : detailsOk)

  // a double-click on Continue mustn't skip the stage that's sliding in
  const lastGo = React.useRef(0)
  const go = React.useCallback(
    (to: StageIndex) => {
      const now = performance.now()
      if (now - lastGo.current < 450) return
      lastGo.current = now
      setDir(to > stage ? 1 : -1)
      patch({ stage: to })
    },
    [stage, patch],
  )

  React.useEffect(() => {
    if (lenis) lenis.scrollTo(0, { duration: 0.6 })
    else window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [stage, lenis])

  React.useEffect(() => {
    if (!confirmReset) return
    const t = setTimeout(() => setConfirmReset(false), 3000)
    return () => clearTimeout(t)
  }, [confirmReset])

  const startOver = () => {
    // a finished case has nothing to lose; an unfinished draft asks once before it's thrown away
    if (!confirmReset && !draft.created && (draft.text || draft.parse)) return setConfirmReset(true)
    setConfirmReset(false)
    setDir(-1)
    reset()
  }

  /* primary action per stage — the footer button and Ctrl+Enter both call this */
  const chars = draft.text.trim().length
  const primary: { label: string; disabled: boolean; why?: string; run: () => void } | null = draft.created
    ? null
    : stage === 0
      ? fresh
        ? { label: 'Continue to details', disabled: false, run: () => go(2) }
        : {
            label: 'Read complaint',
            disabled: chars < MIN_CHARS,
            why:
              chars === 0
                ? 'Paste the complaint or pick one from the NCRP queue.'
                : chars < MIN_CHARS
                  ? 'A little more text is needed to read it reliably.'
                  : undefined,
            run: () => go(1),
          }
      : stage === 2
        ? {
            label: 'Continue',
            disabled: !detailsOk,
            why: wallet ?? (missing.length ? `Still needed: ${missing.map((m) => FIELD_LABEL[m.id].toLowerCase()).join(', ')}.` : undefined),
            run: () => go(3),
          }
        : stage === 3
          ? { label: 'Review & open case', disabled: false, run: () => go(4) }
          : null

  const back: StageIndex = stage === 2 ? 0 : (Math.max(0, stage - 1) as StageIndex)

  // the listener reads the latest primary action through a ref so it isn't re-bound every render
  const primaryRef = React.useRef(primary)
  React.useEffect(() => {
    primaryRef.current = primary
  })

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const p = primaryRef.current
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && p && !p.disabled) {
        e.preventDefault()
        p.run()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={
          <>
            <DemoChip /> <span>Step 1 of the investigation · complaint to case</span>
            {!USE_MOCK && (
              <Chip tone="moss" dot>
                Live backend
              </Chip>
            )}
          </>
        }
        title="Smart Intake"
        tech="reads a raw complaint, checks every detail, opens the case"
        actions={
          <Button
            onClick={startOver}
            disabled={stage === 0 && !draft.text && !draft.parse}
            variant={confirmReset ? 'outline' : 'ghost'}
            className={confirmReset ? 'border-crimson/50 text-crimson' : undefined}
          >
            <RotateCcw /> {confirmReset ? 'Discard this complaint?' : 'Start over'}
          </Button>
        }
      />

      <div className="rounded-2xl border border-line bg-white/[0.015] px-4 py-4 sm:px-6">
        <Stepper stage={stage} reachable={reachable} locked={Boolean(draft.created)} onJump={go} />
      </div>

      {/* clip, not hidden: the sideways slide mustn't spawn a page scrollbar, and sticky children keep working */}
      <div className="overflow-x-clip">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.section
            key={stage}
            custom={dir}
            variants={stageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 260, damping: 30, mass: 0.8 }}
            aria-label={STAGES[stage].label}
          >
            {stage === 0 && <StageComplaint draft={draft} patch={patch} />}
            {stage === 1 && <StageReading draft={draft} patch={patch} onDone={() => go(2)} onBack={() => go(0)} />}
            {stage === 2 && draft.parse && <StageDetails draft={draft} patch={patch} />}
            {stage === 3 && draft.parse && <StageLinks draft={draft} patch={patch} />}
            {stage === 4 && draft.parse && <StageOpen draft={draft} patch={patch} onReset={startOver} />}
          </motion.section>
        </AnimatePresence>
      </div>

      {stage !== 1 && !draft.created && (
        <StageFooter
          left={
            stage > 0 ? (
              <Button variant="quiet" onClick={() => go(back)}>
                <ArrowLeft /> {STAGES[back].label}
              </Button>
            ) : (
              <span className="hidden items-center gap-1.5 pl-1 text-[12.5px] text-dim sm:flex">
                <ScanText className="size-3.5" /> Nothing is saved until you open the case
              </span>
            )
          }
          note={
            stage === 0 && draft.parse && !fresh ? (
              <span className="text-gold">The text changed since it was read — reading it again replaces the details found before.</span>
            ) : primary?.disabled && primary.why ? (
              <span className="text-gold">{primary.why}</span>
            ) : primary ? (
              <span className="hidden md:inline">
                <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd> to continue
              </span>
            ) : null
          }
          right={
            primary && (
              <Button variant="ember" onClick={primary.run} disabled={primary.disabled}>
                {primary.label} <ArrowRight />
              </Button>
            )
          }
        />
      )}
    </div>
  )
}
