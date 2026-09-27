import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { api } from '../api'
import { useUIStore } from '../store/uiStore'
import type { CaseStatus, RecentCase, RecoverabilityState, RiskBand } from '../types'
import type { SemanticColour } from '../utils/constants'
import { COLOUR_SEMANTICS, ROUTES } from '../utils/constants'
import { formatINR } from '../utils/format'

const STATUS_COLOUR: Record<CaseStatus, SemanticColour> = {
  New: 'info',
  Traced: 'onchain',
  'Notice sent': 'bridge',
  Closed: 'safe',
}

const RISK_COLOUR: Partial<Record<RiskBand, SemanticColour>> = {
  HIGH: 'criminal',
  MEDIUM: 'exchange',
  LOW: 'safe',
}

// Colour semantics per CLAUDE.md: gold = exchange, moss = safe/done, vermillion = criminal
// path/high risk. "Moving" money is still an active criminal flow (highest urgency, no
// confirmed resting point yet), so it borrows the criminal-path colour rather than a new one.
const RECOVERABILITY_COLOUR: Record<RecoverabilityState, SemanticColour> = {
  at_rest: 'safe',
  at_exchange: 'exchange',
  moving: 'criminal',
  unknown: 'info',
}

const RECOVERABILITY_LABEL: Record<RecoverabilityState, string> = {
  at_rest: 'At rest',
  at_exchange: 'At exchange',
  moving: 'Moving',
  unknown: 'Unknown',
}

/** Plain-English deadline text for a table cell — `null` means "don't show a deadline"
 * (state known but no fixed resting point to measure one against, or no signal at all). */
function formatRecoverabilityDeadline(minutes: number | null | undefined): string | null {
  if (minutes == null) return null
  if (minutes <= 0) return 'Window likely closed'
  const hours = minutes / 60
  return hours < 1 ? `~${Math.round(minutes)}m left` : `~${Math.round(hours)}h left`
}

/** Default sort: cases with a real deadline first (least time left = most urgent first),
 * then still-moving cases, then cases with no traceable state last — mirrors the backend's
 * own `_sort_key` in `backend/app/api/v1/cases.py` exactly (see that function's comment). */
function recoverabilitySortKey(row: RecentCase): [number, number] {
  const state = row.recoverabilityState ?? 'unknown'
  const deadline = row.recoverabilityDeadlineMinutes
  if (deadline != null) return [0, deadline]
  return [state === 'moving' ? 1 : 2, 0]
}

/** The case with full backing trace/risk/evidence data in this demo — see `mock.ts`. */
const FULL_DATA_CASE_ID = 'KZN-2026-0417'

const STATUS_FILTERS: Array<CaseStatus | 'All'> = ['All', 'New', 'Traced', 'Notice sent', 'Closed']

/**
 * Screen — `/cases`. A full registry view of every case from `api.listCases()`, with a
 * status-filter row and a search box (client-side, no new API needed). Only the one case with
 * full backing data (`KZN-2026-0417`) routes into the real workflow when clicked; every other
 * row is an honest summary row only, so it shows a toast instead of a broken/blank screen.
 */
export default function Cases() {
  const navigate = useNavigate()
  const showToast = useUIStore((s) => s.showToast)
  const [cases, setCases] = useState<RecentCase[] | null>(null)
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'All'>('All')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    api.listCases().then((result) => {
      if (!cancelled) setCases(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (!cases) return []
    return cases
      .filter((row) => {
        if (statusFilter !== 'All' && row.status !== statusFilter) return false
        if (query.trim() && !row.id.toLowerCase().includes(query.trim().toLowerCase()) && !row.who.toLowerCase().includes(query.trim().toLowerCase())) return false
        return true
      })
      // Default sort — most recoverable / most urgent first (see recoverabilitySortKey).
      // The status filter above still narrows the rows; this only orders what's left.
      .slice()
      .sort((a, b) => {
        const [tierA, valueA] = recoverabilitySortKey(a)
        const [tierB, valueB] = recoverabilitySortKey(b)
        return tierA !== tierB ? tierA - tierB : valueA - valueB
      })
  }, [cases, statusFilter, query])

  function handleRowClick(row: RecentCase) {
    if (row.id === FULL_DATA_CASE_ID) {
      // Status is 'New' in the DEMO data, so New Case is the narratively-correct destination
      // (this case hasn't been traced yet) -- NewCase seeds its own form via api.getCase('demo')
      // regardless of store state, so no store population is needed here (unlike Reports' View
      // button, which routes past NewCase's own guard-free path into Evidence.tsx's guarded route).
      navigate(ROUTES.newCase)
      return
    }
    showToast(`Full detail available for ${FULL_DATA_CASE_ID} in this demo`)
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-xl">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-foreground">Cases</h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">Every registered complaint, in one registry.</p>
      </header>

      <Card className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((status) => (
              <Button
                key={status}
                type="button"
                size="sm"
                variant={statusFilter === status ? 'default' : 'outline'}
                onClick={() => setStatusFilter(status)}
                className={cn(statusFilter !== status && 'text-muted-foreground')}
              >
                {status}
              </Button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search case ID or complainant"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {!cases ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center text-muted-foreground">
            <Spinner percent={70} label="Loading" />
            <p>Loading cases…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <IconTile color="primary">
              <FolderOpen size={20} />
            </IconTile>
            <p>No cases match this filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Case ID</th>
                  <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Complainant</th>
                  <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Amount</th>
                  <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Chain</th>
                  <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Risk</th>
                  <th className="border-b border-border px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Recoverability</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const hasFullData = row.id === FULL_DATA_CASE_ID
                  return (
                    <tr
                      key={row.id}
                      className="cursor-pointer transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                      onClick={() => handleRowClick(row)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') handleRowClick(row)
                      }}
                    >
                      <td className="whitespace-nowrap border-b border-border px-3 py-3 font-[family-name:var(--font-mono)] text-sm text-foreground">
                        {row.id}
                        {hasFullData && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-moss">Full detail</span>}
                      </td>
                      <td className="whitespace-nowrap border-b border-border px-3 py-3 text-sm text-foreground">{row.who}</td>
                      <td className="whitespace-nowrap border-b border-border px-3 py-3 font-[family-name:var(--font-mono)] text-sm text-foreground">{formatINR(row.amt)}</td>
                      <td className="whitespace-nowrap border-b border-border px-3 py-3 text-sm text-foreground">{row.chain}</td>
                      <td className="whitespace-nowrap border-b border-border px-3 py-3">
                        <Badge variant={COLOUR_SEMANTICS[STATUS_COLOUR[row.status]]}>{row.status}</Badge>
                      </td>
                      <td className="whitespace-nowrap border-b border-border px-3 py-3">
                        {row.risk ? (
                          <Badge variant={COLOUR_SEMANTICS[RISK_COLOUR[row.risk]!]}>{row.risk}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap border-b border-border px-3 py-3">
                        {row.recoverabilityState ? (
                          <div className="flex flex-col gap-1">
                            <Badge variant={COLOUR_SEMANTICS[RECOVERABILITY_COLOUR[row.recoverabilityState]]}>
                              {RECOVERABILITY_LABEL[row.recoverabilityState]}
                            </Badge>
                            {formatRecoverabilityDeadline(row.recoverabilityDeadlineMinutes) && (
                              <span className="text-[11px] text-muted-foreground">
                                {formatRecoverabilityDeadline(row.recoverabilityDeadlineMinutes)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
