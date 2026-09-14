import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, Button, PlainWords } from '../components/ui'
import { RouteCard } from '../components/route/RouteCard'
import { api } from '../api'
import { useCaseStore } from '../store/caseStore'
import { useUIStore } from '../store/uiStore'
import { ROUTES } from '../utils/constants'
import styles from './RouteChoice.module.css'

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
    return <Card>Loading routes…</Card>
  }

  const assetShort = activeCase.asset.split(' ')[0]

  return (
    <div className={styles.page}>
      <Card className={styles.headingCard}>
        <span className={styles.heading}>The money took two different routes.</span>
        <span className={styles.subheading}>Click either route to follow it.</span>
      </Card>

      <div className={styles.cardsGrid}>
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

      <div className={styles.footerRow}>
        <Button variant="primary" onClick={() => navigate(ROUTES.exchange(caseId))}>
          Who cashed it out? →
        </Button>
      </div>
    </div>
  )
}
