// Aegis on Monad — shared type contract between the engine (mini-service) and the UI.
// Single source of truth: both sides import from here.

export type GateVerdict = 'PASS' | 'HITL_REQUIRED' | 'BLOCKED' | 'LOCKED'
export type AgentStatus = 'ACTIVE' | 'PAUSED' | 'FROZEN'
export type AgentRole = 'signal' | 'executor' | 'council' | 'sentinel' | 'rogue'
export type Side = 'BUY' | 'SELL'
export type ProposalSource = 'SIGNAL' | 'DRILL'
export type FeedChannel =
  | 'signal' | 'council' | 'gate' | 'sim' | 'broadcast'
  | 'ledger' | 'anchor' | 'sentinel' | 'registry' | 'hitl' | 'system' | 'zerion'
export type FeedLevel = 'info' | 'warn' | 'alert' | 'ok'

export interface Agent {
  id: string            // 0x + 40 hex — ERC-8004 agent identity (Monad-style address)
  seq: number           // registry token id
  name: string
  domain: string        // e.g. aegis://dreamdesk/momentum
  capabilities: string[]
  role: AgentRole
  status: AgentStatus
  reputation: number    // 0-100
  stakeMON: number
  registeredAt: number
  block: number         // registration block (simulated Monad testnet)
  note?: string
}

export interface MarketToken {
  symbol: string
  name: string
  price: number
  history: number[]     // rolling window of prices
  allowlisted: boolean
  vol: number           // per-tick volatility factor
}

export interface GateCheck {
  rule: string
  label: string
  passed: boolean | null // null = short-circuited / not evaluated
  detail: string
}

export interface GateEvaluation {
  verdict: GateVerdict
  checks: GateCheck[]
  reason: string
}

export interface TradeProposal {
  id: string
  agentId: string
  agentName: string
  source: ProposalSource
  token: string
  side: Side
  notionalUSD: number
  confidence: number    // 0-1
  rationale: string
  createdAt: number
}

export interface CouncilSeat {
  seat: 'BULL' | 'BEAR' | 'RISK'
  vote: 'APPROVE' | 'REJECT'
  note: string
}

export interface CouncilVerdict {
  proposalId: string
  seats: CouncilSeat[]
  verdict: 'APPROVE' | 'REJECT'
  mode: 'llm' | 'heuristic'
  latencyMs: number
}

export interface AnchorRecord {
  txHash: string
  block: number
  root: string
  count: number
  ts: number
  status: 'CONFIRMED'
  gasUsed: number
}

export type LedgerKind = 'DECISION' | 'ANCHOR' | 'SENTINEL' | 'REGISTRY' | 'HITL' | 'COUNCIL'

export interface LedgerEntry {
  seq: number
  ts: number
  kind: LedgerKind
  decisionHash: string
  prevHash: string
  hash: string          // HMAC-SHA256 chain value
  payload: Record<string, unknown>
  anchor?: AnchorRecord
}

export interface ExecutedTrade {
  id: string
  token: string
  side: Side
  notionalUSD: number
  price: number
  agentId: string
  agentName: string
  ts: number
  simOK: boolean
  simLatencyMs: number
}

export interface Position {
  token: string
  qty: number
  avgPrice: number
}

export interface SentinelOsint {
  crossChecked: boolean
  result: 'CONFIRMED' | 'FALSE_POSITIVE' | 'PENDING'
  note: string
  latencyMs: number
}

export interface SentinelAlert {
  id: string
  ts: number
  watcher: string
  shape: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  detail: string
  osint: SentinelOsint
}

export interface DrillStep {
  at: number
  phase: string
  detail: string
  latencyMs?: number
}

export interface DrillReport {
  id: string
  scenario: string
  label: string
  startedAt: number
  outcome: 'PAUSED' | 'FALSE_POSITIVE_CLEARED' | 'RUNNING'
  steps: DrillStep[]
  alerts: SentinelAlert[]
  detectLatencyMs?: number
  pauseLatencyMs?: number
  blockedValueUSD: number
  pausedReason?: string
}

export interface WatcherState {
  id: string
  name: string
  kind: 'ANOMALY' | 'VELOCITY' | 'PATTERN' | 'OSINT'
  status: 'ONLINE'
  firing: boolean
  lastFireTs?: number
  description: string
}

export interface DeskState {
  running: boolean
  tick: number
  blockHeight: number
  chainId: number
  rpcLabel: string
  simLabel: string
  paused: boolean
  pausedAt?: number
  pausedReason?: string
  treasuryUSD: number
  initialUSD: number
  positions: Position[]
  dailyNotionalUSD: number
  speed: 'SLOW' | 'NORMAL' | 'FAST'
}

export interface GateConfig {
  perTradeCapUSD: number
  dailyCapUSD: number
  confidenceFloor: number
  velocityMaxPerMin: number
  concentrationMaxPct: number
  councilAboveUSD: number
  allowlist: string[]
  simulationRequired: boolean
  failClosed: boolean
  liveCaps: boolean           // derive $ caps from live Zerion NAV when connected
}

export interface FeedItem {
  id: string
  ts: number
  channel: FeedChannel
  level: FeedLevel
  text: string
  meta?: Record<string, unknown>
}

export interface HITLItem {
  id: string
  proposal: TradeProposal
  ts: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  gateReason: string
  resolvedAt?: number
}

export type ProposalStatus =
  | 'COUNCIL_PENDING' | 'GATE_PASS' | 'GATE_BLOCKED' | 'GATE_LOCKED'
  | 'HITL_PENDING' | 'EXECUTED' | 'SIM_FAILED' | 'REJECTED'

export interface TrackedProposal {
  proposal: TradeProposal
  status: ProposalStatus
  gate?: GateEvaluation
  council?: CouncilVerdict
  ledgerSeq?: number
  executed?: ExecutedTrade
}

export interface SentinelState {
  watchers: WatcherState[]
  alerts: SentinelAlert[]
  drills: DrillReport[]
  lastDrill?: DrillReport
}

export interface ZerionPosition {
  symbol: string
  name: string
  qty: number
  value: number         // USD
  price: number
  chain: string         // zerion chain id, e.g. "monad"
  verified: boolean
  icon?: string
  change1d?: number     // percent points, e.g. 4.79 = +4.79%
}

export interface ZerionPortfolio {
  address: string
  totalUSD: number
  byType: Record<string, number>
  byChain: { id: string; usd: number }[]
  positions: ZerionPosition[]
  changes: {
    absolute?: Record<string, number>
    percent?: Record<string, number>
  }
  fetchedAt: number
  latencyMs: number
  stale: boolean
}

export interface ZerionStatus {
  enabled: boolean            // API key present server-side
  live: boolean               // at least one successful live fetch
  label: string
  positionsFetched: number
  address?: string
  lastError?: string
  portfolio?: ZerionPortfolio
  source?: 'engine-live' | 'serverless-live' | 'static-snapshot' | 'mirror'
}

export interface AegisStats {
  pass: number
  blocked: number
  hitl: number
  locked: number
  councilLlm: number
  councilHeuristic: number
  anchored: number
  exploitsStoppedUSD: number
}

export interface AegisSnapshot {
  desk: DeskState
  agents: Agent[]
  tokens: MarketToken[]
  config: GateConfig
  ledger: LedgerEntry[]       // most recent N
  ledgerHead: { seq: number; hash: string; count: number }
  anchors: AnchorRecord[]     // most recent N
  trades: ExecutedTrade[]     // most recent N
  feed: FeedItem[]            // most recent N
  proposals: TrackedProposal[]// most recent N
  hitl: HITLItem[]
  sentinel: SentinelState
  stats: AegisStats
  zerion: ZerionStatus
}

export interface VerifyReport {
  ok: boolean
  checked: number
  brokenAt?: number
  detail: string
  anchorChecks: { txHash: string; rootMatch: boolean }[]
}

export const DRILL_SCENARIOS = [
  {
    id: 'drain',
    label: 'Treasury drain (rogue agent)',
    description: 'A newly registered rogue agent attempts rapid sweeps against an unallowlisted token, then a max-size transfer. Expect: allowlist + velocity BLOCK, PATTERN watcher fires, OSINT confirms, circuit breaker pauses.',
    expectPause: true,
  },
  {
    id: 'flashloan',
    label: 'Flash-loan shaped arbitrage (benign)',
    description: 'A large BUY followed by a rapid SELL — exploit-shaped, but matches historical desk behavior. Expect: ANOMALY watcher fires, OSINT cross-check clears it as FALSE_POSITIVE. No pause.',
    expectPause: false,
  },
  {
    id: 'prompt_injection',
    label: 'Hostile prompt injection',
    description: 'An oracle payload carries an injected instruction trying to override the signal agent. Expect: PATTERN watcher detects injection, OSINT confirms, breaker pauses, rogue agent frozen.',
    expectPause: true,
  },
] as const

export type DrillScenarioId = (typeof DRILL_SCENARIOS)[number]['id']
