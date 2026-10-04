import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { Spinner } from '@/components/ui/spinner'
import { ReportDocument } from '../components/report/ReportDocument'
import { api } from '../api'
import { useCaseStore } from '../store/caseStore'
import type { ReportData } from '../types'
import { ROUTES } from '../utils/constants'

/** Only case in the DEMO dataset with a full evidence pack behind it (per Global Constraints —
 * don't fabricate report detail for the other `recentCases` rows). */
const FULL_DATA_CASE_ID = 'ANV-2026-0417'

/** Screen — a small archive of generated evidence reports. The DEMO dataset only ever produces
 * one real report (`FULL_DATA_CASE_ID`), so this reads as a single-row registry that a second
 * report would slot into naturally once more cases reach the evidence stage. */
export default function Reports() {
  const navigate = useNavigate()
  const setActiveCase = useCaseStore((s) => s.setActiveCase)
  const setTraceResult = useCaseStore((s) => s.setTraceResult)
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  /** Evidence.tsx's route guard requires an active case + trace result in the store, not just
   * a valid case ID in the URL -- populate both before navigating so "View" lands on the real
   * report tab instead of bouncing back to New Case. */
  async function handleView(caseId: string) {
    const [caseData, trace] = await Promise.all([api.getCase(caseId), api.getRoutes(caseId)])
    setActiveCase(caseData)
    setTraceResult(trace.routeA, trace.routeB)
    navigate(`${ROUTES.evidence(caseId)}?tab=report`)
  }

  useEffect(() => {
    let cancelled = false
    api.generateReport(FULL_DATA_CASE_ID).then((data) => {
      if (cancelled) return
      setReport(data)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const generatedDate = report
    ? new Date(report.generatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-[30px] font-bold text-foreground">
          Evidence reports archive.
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          Every court-ready report ANVESHAK has generated, with a one-click PDF export.
        </p>
      </header>

      <Card className="flex flex-col p-6">
        {loading || !report ? (
          <div className="flex min-h-[160px] flex-col items-center justify-center gap-4 text-muted-foreground">
            <Spinner percent={70} label="Loading" />
            <p className="text-sm">Assembling the archive…</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-4">
              <div className="flex items-center gap-4">
                <IconTile color="teal">
                  <FileText size={20} />
                </IconTile>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-[family-name:var(--font-mono)] text-sm font-semibold text-foreground">
                      {report.case.id}
                    </span>
                    <Badge variant="moss">Report ready</Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CalendarDays size={14} />
                    Generated {generatedDate}
                  </div>
                </div>
              </div>

              <Button variant="secondary" onClick={() => handleView(report.case.id)}>
                View
              </Button>
            </div>

            {/* Reuses ReportDocument exactly as the Evidence page's report tab does — same
               preview markup and the same html2pdf.js Download PDF button, nothing reimplemented. */}
            <ReportDocument data={report} />
          </div>
        )}
      </Card>
    </div>
  )
}
