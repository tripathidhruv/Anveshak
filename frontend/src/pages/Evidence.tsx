import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import clsx from 'clsx'
import { Button, Card, Spinner } from '../components/ui'
import { FundFlowGraph } from '../components/graph/FundFlowGraph'
import { NodeDrawer } from '../components/graph/NodeDrawer'
import { ReportDocument } from '../components/report/ReportDocument'
import { LawfulActionTab } from '../components/action/LawfulActionTab'
import { api } from '../api'
import { useCaseStore } from '../store/caseStore'
import { useUIStore, type EvidenceTab } from '../store/uiStore'
import type { GraphData, GraphNode, ReportData } from '../types'
import { ROUTES } from '../utils/constants'
import styles from './Evidence.module.css'

const TABS: { key: EvidenceTab; label: string }[] = [
  { key: 'graph', label: 'Fund flow graph' },
  { key: 'report', label: 'Investigation report' },
  { key: 'action', label: 'Lawful action' },
]

const VALID_TABS: EvidenceTab[] = ['graph', 'report', 'action']

/** Screen 6 — three tabs sharing one case's evidence: the fund-flow graph, the printable
 * investigation report, and the lawful-action cards. Tab state lives in the `?tab=` query
 * param (shareable/bookmarkable) and is mirrored into `uiStore` for the rest of the app. */
export default function Evidence() {
  const { id: caseId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const activeCase = useCaseStore((s) => s.activeCase)
  const routeA = useCaseStore((s) => s.routeA)
  const routeB = useCaseStore((s) => s.routeB)
  const setTraceResult = useCaseStore((s) => s.setTraceResult)
  const activeTab = useUIStore((s) => s.activeEvidenceTab)
  const setActiveTab = useUIStore((s) => s.setActiveEvidenceTab)
  const showToast = useUIStore((s) => s.showToast)

  const [graph, setGraph] = useState<GraphData | null>(null)
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)

  // The URL query param is the source of truth for which tab is showing — keep `uiStore` in
  // sync with it (and correct the URL if it's missing/invalid) rather than juggling two
  // independent pieces of state.
  useEffect(() => {
    const param = searchParams.get('tab')
    if (VALID_TABS.includes(param as EvidenceTab)) {
      setActiveTab(param as EvidenceTab)
    } else {
      setSearchParams({ tab: 'graph' }, { replace: true })
    }
  }, [searchParams, setActiveTab, setSearchParams])

  function selectTab(tab: EvidenceTab) {
    setSearchParams({ tab })
  }

  // Same guard pattern as RouteChoice/RiskScore: this screen only makes sense once a case is
  // active and its two routes have been traced.
  useEffect(() => {
    if (!caseId || !activeCase || activeCase.id !== caseId) {
      navigate(ROUTES.newCase, { replace: true })
      return
    }
    if (!routeA || !routeB) {
      api.getRoutes(caseId).then((result) => setTraceResult(result.routeA, result.routeB))
    }
  }, [caseId, activeCase, routeA, routeB, navigate, setTraceResult])

  useEffect(() => {
    if (!caseId || !activeCase || activeCase.id !== caseId) return
    let cancelled = false
    setLoading(true)
    Promise.all([api.getGraph(caseId), api.generateReport(caseId)]).then(([graphData, reportData]) => {
      if (cancelled) return
      setGraph(graphData)
      setReport(reportData)
      setSelectedNode(null)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [caseId, activeCase])

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

  if (!caseId || !activeCase || !routeA || !routeB) {
    return (
      <Card className={styles.loadingCard}>
        <Spinner percent={70} label="Loading" />
        <p>Loading case…</p>
      </Card>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className="page-title">The evidence pack.</h1>
        <p className={styles.subtitle}>
          Everything a court, an exchange, or FIU-IND would need — the trail, the report, and the notices.
        </p>
      </header>

      <Card className={styles.panel} padding={0}>
        <div className={styles.tabRow} role="tablist" aria-label="Evidence sections">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={clsx(styles.tabChip, activeTab === tab.key && styles.tabChipActive)}
              onClick={() => selectTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.tabContent}>
          {loading || !graph || !report ? (
            <div className={styles.loadingInner}>
              <Spinner percent={70} label="Loading" />
              <p>Assembling the evidence pack…</p>
            </div>
          ) : (
            <>
              {activeTab === 'graph' && (
                <div className={styles.graphLayout}>
                  <FundFlowGraph graph={graph} onSelectNode={setSelectedNode} />
                  <NodeDrawer node={selectedNode} onClose={() => setSelectedNode(null)} onCopyAddress={handleCopyAddress} />
                </div>
              )}

              {activeTab === 'report' && <ReportDocument data={report} />}

              {activeTab === 'action' && (
                <LawfulActionTab caseId={caseId} caseData={report.case} exchange={report.exchange} campaign={report.campaign} />
              )}
            </>
          )}
        </div>

        <div className={styles.footerRow}>
          <Button variant="primary" onClick={() => navigate(ROUTES.closed(caseId))}>
            Finish case
            <ArrowRight size={16} />
          </Button>
        </div>
      </Card>
    </div>
  )
}
