/**
 * Wire types for the ANVESHAK 26182 backend. Each block mirrors a Pydantic model in
 * `backend/app/api/v1/<module>.py` — keep the two in step, field for field (camelCase on the wire).
 */

/* ───────── intake (backend/app/api/v1/intake.py) ───────── */
export type ChainId = 'tron' | 'ethereum' | 'bitcoin'
export type EntityType = 'wallet' | 'amount' | 'hash' | 'handle' | 'date' | 'pii'
export type FieldSource = 'text' | 'screenshot' | 'ncrp'

export type IntakeParseIn = { text: string; source?: 'text' | 'ncrp' }

export type IntakeEntity = {
  id: string
  type: EntityType
  text: string
  start: number
  end: number
  confidence: number
  reason: string
  normalized: string | null
  chain: ChainId | null
  warnings: string[]
}

export type IntakeFieldId =
  | 'suspectWallet'
  | 'network'
  | 'amountCrypto'
  | 'amountInr'
  | 'txHash'
  | 'incidentAt'
  | 'platform'
  | 'upi'
  | 'phone'
  | 'complainant'
  | 'location'
  | 'typology'
  | 'victimWallet'

export type IntakeField = {
  id: IntakeFieldId
  label: string
  value: string
  normalized: string | null
  confidence: number
  reason: string
  sources: FieldSource[]
  entityIds: string[]
}

export type TypologyClass = { id: string; name: string; p: number }
export type TypologyTrigger = { phrase: string; weight: number; classId: string }
export type Typology = { top: string; classes: TypologyClass[]; triggers: TypologyTrigger[]; disclaimer: string }

export type IntakeParseOut = {
  language: 'hinglish' | 'hindi' | 'english'
  scripts: string[]
  entities: IntakeEntity[]
  fields: IntakeField[]
  typology: Typology
  chain: ChainId | null
  elapsedMs: number
  warnings: string[]
}

export type IntakeCaseIn = {
  complainant: string
  location: string
  suspectWallet: string
  chain: ChainId
  asset: string
  amountCrypto: number
  amountInr: number
  incidentAt: string
  fraudType: string
  txHash?: string | null
  platform?: string | null
  ncrp?: string | null
  unit?: string
  state?: string | null
  correctedFields?: string[]
}

export type IntakeCaseOut = {
  caseId: string
  ncrp: string
  createdAt: string
  memory: MemoryLookup
  auditHash: string
}

/* ───────── national memory (backend/app/api/v1/memory.py) ───────── */
export type MemoryRelation = 'same_wallet' | 'one_hop' | 'shared_hub'

export type MemoryLinkedCase = {
  caseId: string
  relation: MemoryRelation
  city: string
  state: string
  amountInr: number
  reportedAt: string
}

export type MemorySyndicate = {
  id: string
  name: string
  caseCount: number
  stateCount: number
  valueInr: number
  confidence: number
  hub: string
}

export type MemoryProvenance = { at: string; unit: string; state: string; event: string; detail: string }

export type MemoryLookup = {
  address: string
  chain: ChainId | null
  known: boolean
  firstSeen: string | null
  submissionCount: number
  linkedCases: MemoryLinkedCase[]
  syndicate: MemorySyndicate | null
  provenance: MemoryProvenance[]
  disclaimer: string
}

export type MemoryStats = { wallets: number; cases: number; events: number; states: number; syndicates: number }

/* ───────── case queue (backend/app/api/v1/cases.py · CaseListItemOut, mapped in http.ts) ───────── */
export type CaseStage = 'Intake' | 'Tracing' | 'Traced' | 'Notice sent' | 'Frozen' | 'Closed'
export type Recoverability = 'moving' | 'at_rest' | 'at_exchange' | 'frozen' | 'lost'

/** One row of the investigator queue — the shape every screen sees, mock or live. */
export type CaseSummary = {
  id: string
  who: string
  city: string
  state: string
  amt: number
  chain: 'TRON' | 'Ethereum' | 'Bitcoin'
  status: CaseStage
  risk: 'HIGH' | 'MEDIUM' | 'LOW' | null
  recover: Recoverability
  goldenMin: number | null
  syndicate?: string
  exchange?: string
  type: string
  filed: string
  /** scammer's wallet when the backend knows it */
  wallet?: string
  /** true for a case opened through Smart Intake in this session */
  isNew?: boolean
}

/** Raw backend list item (CaseOut + recoverability). */
export type CaseListItemWire = {
  id: string
  complainant: string
  location: string
  reportedAt: string
  fraudType: string
  amountINR: number
  chain: string
  status: string
  suspectWallet: string
  recoverabilityState: 'at_rest' | 'at_exchange' | 'moving' | 'unknown'
  recoverabilityDeadlineMinutes: number | null
}

/* ───────── typology (backend/app/api/v1/typology.py) ───────── */
export type TypologyBand = 'strong' | 'present' | 'not_indicated'
export type TypologyIndicator = { id: string; plain: string; tech: string; weight: number; value: number; contribution: number }
export type TypologyClassOut = { id: string; name: string; score: number; band: TypologyBand; indicators: TypologyIndicator[] }
/** Crime typology from on-chain behaviour: score = Σ weight × signal, every term returned. */
export type TypologyOut = { primary: string; classes: TypologyClassOut[]; disclaimer: string; signalsUsed: number }
