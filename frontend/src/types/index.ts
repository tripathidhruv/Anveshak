export type { Case, CaseInput, CaseStatus, RiskBand, DashboardKpi, RecentCase, DashboardData, CampaignSummary } from './case'

export type {
  Hop,
  Route,
  TraceResult,
  EvidenceItem,
  Exchange,
  RiskFactor,
  RiskScore,
  GraphNodeKind,
  GraphNode,
  GraphEdge,
  GraphData,
  ReportData,
  NoticeType,
  NoticeResult,
} from './trace'

import type { Case, CaseInput, DashboardData, CampaignSummary, RecentCase } from './case'
import type { Exchange, GraphData, NoticeResult, NoticeType, ReportData, RiskScore, TraceResult } from './trace'

/**
 * The full data-layer contract every screen depends on. `frontend/src/api/mock.ts` implements
 * this against the verbatim `DEMO` dataset; `frontend/src/api/index.ts` swaps in a real HTTP
 * implementation later (Phase 2) behind the same shape, so no screen code changes.
 */
export interface KaizenApi {
  createCase(input: CaseInput): Promise<Case>
  getCase(id: string): Promise<Case>
  listCases(): Promise<RecentCase[]>
  /** Runs the animated trace — resolves after the ~1800ms "finding the money" delay. */
  startTrace(caseId: string): Promise<TraceResult>
  getRoutes(caseId: string): Promise<TraceResult>
  getExchange(caseId: string): Promise<Exchange>
  getRisk(caseId: string): Promise<RiskScore>
  getGraph(caseId: string): Promise<GraphData>
  generateReport(caseId: string): Promise<ReportData>
  sendNotice(caseId: string, type: NoticeType): Promise<NoticeResult>
  getDashboard(): Promise<DashboardData>
  getCampaign(campaignId?: string): Promise<CampaignSummary>
}
