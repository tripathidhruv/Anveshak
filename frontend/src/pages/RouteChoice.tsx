import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PlainWords } from '@/components/ui/plain-words'
import { RouteCard } from '../components/route/RouteCard'
import { api } from '../api'
import { useCaseStore } from '../store/caseStore'
import { useUIStore } from '../store/uiStore'
import { ROUTES } from '../utils/constants'

export default function RouteChoice() {
  const { id: caseId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const activeCase = useCaseStore((s) => s.activeCase)
  const routeA = useCaseStore((s) => s.routeA)
  const routeB = useCaseStore((s) => s.routeB)
  const setTraceResult = useCaseStore((s) => s.setTraceResult)
  const showToast = useUIStore((s) => s.showToast)

  const [expandedA, setExpandedA] = useState(false)
  const [expandedB, setExpandedB] = useState(false)

  useEffect(() => {
    if (!caseId || !activeCase || activeCase.id !== caseId) {
      navigate(ROUTES.newCase, { replace: true })
      return
    }
    // Guard against a direct load / refresh on this route: the case is active but the
    // trace result never ran in this session — fetch it instead of rendering a crash.
    if (!routeA || !routeB) {
      api.getRoutes(caseId).then((result) => setTraceResult(result.routeA, result.routeB))
    }
  }, [caseId, activeCase, routeA, routeB, navigate, setTraceResult])

  async function handleCopyAddress(addr: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(addr)
        showToast('Address copied')
      } else {
        showToast('Copy unavailable in this browser')
      }
    } catch {
      showToast('Copy unavailable in this browser')
    }
  }

  if (!activeCase || !routeA || !routeB || !caseId) {
    return <Card className="p-6">Loading routes…</Card>
  }

  const assetShort = activeCase.asset.split(' ')[0]

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-1 p-6">
        <span className="font-[family-name:var(--font-display)] text-xl font-bold text-foreground">
          The money took two different routes.
        </span>
        <span className="text-sm text-muted-foreground">Click either route to follow it.</span>
      </Card>

      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
        <RouteCard
          routeLabel="Route A"
          route={routeA}
          accent="teal"
          assetShort={assetShort}
          badgeText="EASIER TO FOLLOW"
          badgeColour="safe"
          expanded={expandedA}
          onToggle={() => setExpandedA((v) => !v)}
          onCopyAddress={handleCopyAddress}
        />
        <RouteCard
          routeLabel="Route B"
          route={routeB}
          accent="violet"
          assetShort={assetShort}
          badgeText="HARDER — CROSSES CHAINS"
          badgeColour="bridge"
          expanded={expandedB}
          onToggle={() => setExpandedB((v) => !v)}
          onCopyAddress={handleCopyAddress}
        />
      </div>

      <PlainWords>
        A bridge is a currency exchange between two blockchains. Criminals use it hoping the trail breaks. It
        doesn&rsquo;t — we pick it up on the other side.
      </PlainWords>

      <div className="flex justify-end">
        <Button size="lg" onClick={() => navigate(ROUTES.exchange(caseId))}>
          Who cashed it out? →
        </Button>
      </div>
    </div>
  )
}
