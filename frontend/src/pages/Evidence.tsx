import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ShieldAlert, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Well } from '@/components/ui/well'
import { FundFlowGraph } from '../components/graph/FundFlowGraph'
import { NodeDrawer } from '../components/graph/NodeDrawer'
import { ReportDocument } from '../components/report/ReportDocument'
import { LawfulActionTab } from '../components/action/LawfulActionTab'
import { api } from '../api'
import {
  getEvidencePack as getEvidencePackMock,
  verifyEvidencePack as verifyEvidencePackMock,
} from '../api/mock'
import {
  getEvidencePack as getEvidencePackHttp,
  verifyEvidencePack as verifyEvidencePackHttp,
  type EvidencePackOut,
  type EvidenceVerifyOut,
} from '../api/httpApi'
import { useCaseStore } from '../store/caseStore'
import { useUIStore, type EvidenceTab } from '../store/uiStore'
import type { GraphData, GraphNode, ReportData } from '../types'
import { ROUTES } from '../utils/constants'

/** These two calls aren't part of `KaizenApi` (no mock/real switch in `api/index.ts` covers
 * them -- see the doc comment above both real functions in `api/httpApi.ts`), so this screen
 * resolves the same one-env-var switch locally, matching `api/index.ts`'s own `VITE_USE_MOCK`
 * check exactly. */
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
const fetchEvidencePack: (caseId: string) => Promise<EvidencePackOut> = USE_MOCK ? getEvidencePackMock : getEvidencePackHttp
const runVerifyEvidencePack: (caseId: string) => Promise<EvidenceVerifyOut> = USE_MOCK
  ? verifyEvidencePackMock
  : verifyEvidencePackHttp

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

  // The evidence pack (real, backend-computed, reproducible hash over the manifest of sources
  // actually consulted) is fetched independently of graph/report above -- a failure here
  // shouldn't block the fund-flow graph or the printable report from rendering.
  const [evidencePack, setEvidencePack] = useState<EvidencePackOut | null>(null)
  const [evidencePackError, setEvidencePackError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<EvidenceVerifyOut | null>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)

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

  useEffect(() => {
    if (!caseId || !activeCase || activeCase.id !== caseId) return
    let cancelled = false
    setEvidencePack(null)
    setEvidencePackError(null)
    setVerifyResult(null)
    setVerifyError(null)
    fetchEvidencePack(caseId)
      .then((pack) => {
        if (cancelled) return
        setEvidencePack(pack)
      })
      .catch(() => {
        if (cancelled) return
        setEvidencePackError('Could not load the evidence pack for this case.')
      })
    return () => {
      cancelled = true
    }
  }, [caseId, activeCase])

  async function handleVerify() {
    if (!caseId || verifying) return
    setVerifying(true)
    setVerifyResult(null)
    setVerifyError(null)
    try {
      const result = await runVerifyEvidencePack(caseId)
      setVerifyResult(result)
    } catch {
      setVerifyError('Could not verify the evidence pack right now. Try again in a moment.')
    } finally {
      setVerifying(false)
    }
  }

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
      <Card className="mx-auto my-16 flex max-w-[420px] flex-col items-center justify-center gap-4 p-10 text-center">
        <Spinner percent={70} label="Loading" />
        <p className="text-sm text-muted-foreground">Loading case…</p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-[30px] font-bold text-foreground">
          The evidence pack.
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          Everything a court, an exchange, or FIU-IND would need — the trail, the report, and the notices.
        </p>
      </header>

      <Card className="flex flex-col">
        <div className="flex flex-col gap-6 p-6">
          <Tabs value={activeTab} onValueChange={(v) => selectTab(v as EvidenceTab)}>
            <TabsList aria-label="Evidence sections">
              {TABS.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="min-h-[560px]">
            {loading || !graph || !report ? (
              <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 text-muted-foreground">
                <Spinner percent={70} label="Loading" />
                <p className="text-sm">Assembling the evidence pack…</p>
              </div>
            ) : (
              <>
                {activeTab === 'graph' && (
                  <div className="flex items-start gap-6 max-[1279px]:flex-col">
                    <div className="min-w-0 flex-1">
                      <FundFlowGraph graph={graph} onSelectNode={setSelectedNode} routeA={routeA} routeB={routeB} />
                    </div>
                    <NodeDrawer
                      node={selectedNode}
                      onClose={() => setSelectedNode(null)}
                      onCopyAddress={handleCopyAddress}
                      assetShort={activeCase.asset.split(' ')[0]}
                      routeA={routeA}
                      routeB={routeB}
                    />
                  </div>
                )}

                {activeTab === 'report' && (
                  <div className="flex flex-col gap-6">
                    <Card className="flex flex-col gap-4 p-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-foreground">
                            Evidence pack integrity
                          </h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            A reproducible hash of every source this case's trace actually consulted — computed
                            server-side, not derived by hand in the browser.
                          </p>
                        </div>
                        <Button variant="outline" onClick={handleVerify} disabled={!evidencePack || verifying}>
                          {verifying && <Spinner percent={70} size={16} strokeWidth={3} label="" />}
                          {verifying ? 'Verifying…' : 'Verify'}
                        </Button>
                      </div>

                      {evidencePackError && (
                        <Well className="flex items-center gap-3 text-sm text-vermillion">
                          <ShieldAlert size={16} className="shrink-0" />
                          {evidencePackError}
                        </Well>
                      )}

                      {!evidencePackError && !evidencePack && (
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <Spinner percent={70} size={16} strokeWidth={3} label="" />
                          Loading the evidence pack…
                        </div>
                      )}

                      {evidencePack && (
                        <div className="flex flex-col gap-3">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <p className="text-xs text-muted-foreground">Pack hash</p>
                              <p className="mt-1 break-all font-[family-name:var(--font-mono)] text-xs text-foreground">
                                {evidencePack.packHash}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Generated</p>
                              <p className="mt-1 text-sm text-foreground">{evidencePack.createdAt}</p>
                            </div>
                          </div>

                          <Well className="flex flex-col gap-2">
                            <p className="text-xs font-semibold text-foreground">
                              {evidencePack.manifestEntries.length} source
                              {evidencePack.manifestEntries.length === 1 ? '' : 's'} in this manifest
                            </p>
                            <div className="flex flex-col divide-y divide-border">
                              {evidencePack.manifestEntries.map((entry, i) => (
                                <div
                                  key={i}
                                  className="flex flex-wrap gap-x-4 gap-y-1 py-2 text-xs text-muted-foreground first:pt-0 last:pb-0"
                                >
                                  {Object.entries(entry).map(([k, v]) => (
                                    <span key={k}>
                                      <span className="text-foreground/70">{k}:</span>{' '}
                                      <span className="font-[family-name:var(--font-mono)]">{String(v)}</span>
                                    </span>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </Well>
                        </div>
                      )}

                      {verifyError && (
                        <Well className="flex items-center gap-3 text-sm text-vermillion">
                          <ShieldAlert size={16} className="shrink-0" />
                          {verifyError}
                        </Well>
                      )}

                      {verifyResult && (
                        <Well className="flex flex-col gap-3">
                          <div className="flex flex-wrap items-center gap-3">
                            {verifyResult.dataUnavailable ? (
                              <Badge variant="gold" className="px-3 py-1">
                                <ShieldAlert size={14} /> Could not re-verify
                              </Badge>
                            ) : !verifyResult.packHashMatches ? (
                              <Badge variant="vermillion" className="px-3 py-1">
                                <XCircle size={14} /> Tampered — hash mismatch
                              </Badge>
                            ) : !verifyResult.valid ? (
                              <Badge variant="gold" className="px-3 py-1">
                                <ShieldAlert size={14} /> Not fully verified
                              </Badge>
                            ) : (
                              <Badge variant="moss" className="px-3 py-1">
                                <CheckCircle2 size={14} /> Verified — hash matches
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {verifyResult.sourcesReproduced} of {verifyResult.sourcesChecked} sources reproduced
                            </span>
                          </div>
                          {!verifyResult.packHashMatches && !verifyResult.dataUnavailable && (
                            <p className="text-xs text-vermillion">
                              The recomputed hash no longer matches the pack recorded for this case — treat this
                              evidence pack as compromised until re-investigated.
                            </p>
                          )}
                          {verifyResult.packHashMatches && !verifyResult.dataUnavailable && !verifyResult.valid && (
                            <p className="text-xs text-gold">
                              The pack hash still matches — {verifyResult.sourcesChecked - verifyResult.sourcesReproduced}{' '}
                              of {verifyResult.sourcesChecked} source{verifyResult.sourcesChecked === 1 ? '' : 's'} could
                              not be freshly reproduced from the live chain just now. This does not necessarily mean
                              tampering — the underlying chain data may have legitimately changed since this evidence
                              pack was generated. Re-run verification or investigate the affected sources before
                              relying on this pack as-is.
                            </p>
                          )}
                        </Well>
                      )}
                    </Card>

                    <ReportDocument data={report} />
                  </div>
                )}

                {activeTab === 'action' && (
                  <LawfulActionTab caseId={caseId} caseData={report.case} exchange={report.exchange} campaign={report.campaign} />
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end p-6 pt-0">
          <Button onClick={() => navigate(ROUTES.closed(caseId))}>
            Finish case
            <ArrowRight size={16} />
          </Button>
        </div>
      </Card>
    </div>
  )
}
