// Aegis local demo engine — browser-side mirror of mini-services/aegis-engine.
//
// Runs the ENTIRE demo loop inside the browser tab when the socket.io engine
// service is not reachable (e.g. Vercel serverless deployment):
//   signal agents -> heuristic council -> CHP gate -> Anvil-style sim ->
//   broadcast -> HMAC ledger (pure-TS crypto, byte-identical to node) ->
//   batched anchors. Sentinel drills pause the desk autonomously.
//
// Zerion: live via the /api/zerion serverless proxy when ZERION_API_KEY is
// configured in the deployment; otherwise a bundled public-data snapshot
// (ZERION_SNAPSHOT) so the Treasury tab and live-cap derivation still demo.

import { agentAddress, appendEntry, newChain, txHash, verifyAnchors, verifyChain, type ChainState } from './ledger.web'
import { evaluateGate } from './gate'
import { seedTokens, tickTokens, tokenPrice } from './market'
import { buildDrill } from './sentinel'
import { heuristicCouncil } from './council.shared'
import { ZERION_SNAPSHOT } from './zerionSnapshot'
import {
  DRILL_SCENARIOS, type AegisSnapshot, type Agent, type DrillReport, type DrillScenarioId,
  type FeedItem, type FeedLevel, type GateConfig, type HITLItem, type LedgerEntry,
  type MarketToken, type ProposalStatus, type TrackedProposal, type TradeProposal,
  type WatcherState, type ZerionPortfolio, type ZerionStatus,
} from './types'

const TICK_MS: { SLOW: number; NORMAL: number; FAST: number } = { SLOW: 2200, NORMAL: 1300, FAST: 700 }
const CHAIN_ID = 10143
const RPC_LABEL = 'RPC rotator: testnet-rpc.monad.xyz + rpc.ankr.com/monad_testnet (OSS)'
const SIM_LABEL = 'Anvil fork pre-flight (OSS, foundry) — eth_call state-override mode'

const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const rid = () => Math.random().toString(36).slice(2, 10)
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const round5 = (n: number) => Math.max(500, Math.round(n / 500) * 500)
const clampN = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

const looksLikeAddress = (s: string) => /^0x[a-fA-F0-9]{40}$/.test(s.trim())
const looksLikeEns = (s: string) => /^[a-zA-Z0-9-_]{3,}\.(eth|xyz|crypto|box)$/.test(s.trim())
function validateWallet(input: string): string | null {
  const s = input.trim()
  if (looksLikeAddress(s)) return s.toLowerCase()
  if (looksLikeEns(s)) return s.toLowerCase()
  return null
}

// ---------------------------------------------------------------- singleton state

interface EngineState {
  desk: {
    running: boolean; tick: number; blockHeight: number; chainId: number; rpcLabel: string; simLabel: string
    paused: boolean; pausedAt?: number; pausedReason?: string
    treasuryUSD: number; initialUSD: number
    positions: { token: string; qty: number; avgPrice: number }[]
    dailyNotionalUSD: number; speed: keyof typeof TICK_MS
  }
  tokens: MarketToken[]
  config: GateConfig
  agents: Agent[]
  nextAgentSeq: number
  proposals: TrackedProposal[]
  hitl: HITLItem[]
  feed: FeedItem[]
  chain: ChainState
  councilQueue: string[]
  councilBusy: boolean
  drillActive: boolean
  stats: AegisSnapshot['stats']
  zerion: ZerionStatus
  zerionPortfolio?: ZerionPortfolio
  velocityByAgent: Map<string, number[]>
  recentByAgent: Map<string, TradeProposal[]>
  watchers: WatcherState[]
  drills: DrillReport[]
  timer: ReturnType<typeof setInterval> | null
  clients: number
}

let E: EngineState | null = null

function freshState(): EngineState {
  return {
    desk: {
      running: true, tick: 0, blockHeight: 41_820_000, chainId: CHAIN_ID, rpcLabel: RPC_LABEL, simLabel: SIM_LABEL,
      paused: false, pausedAt: undefined, pausedReason: undefined,
      treasuryUSD: 187_500, initialUSD: 250_000,
      positions: [], dailyNotionalUSD: 0, speed: 'NORMAL',
    },
    tokens: seedTokens(),
    config: {
      perTradeCapUSD: 50_000, dailyCapUSD: 400_000, confidenceFloor: 0.6, velocityMaxPerMin: 12,
      concentrationMaxPct: 0.35, councilAboveUSD: 25_000, allowlist: ['MON', 'WETH', 'WBTC', 'USDC'],
      simulationRequired: true, failClosed: true, liveCaps: true,
    },
    agents: [], nextAgentSeq: 1, proposals: [], hitl: [], feed: [], chain: newChain(),
    councilQueue: [], councilBusy: false, drillActive: false,
    stats: { pass: 0, blocked: 0, hitl: 0, locked: 0, councilLlm: 0, councilHeuristic: 0, anchored: 0, exploitsStoppedUSD: 0 },
    zerion: { enabled: true, live: false, label: 'Zerion · local demo mode', positionsFetched: 0 },
    velocityByAgent: new Map(), recentByAgent: new Map(),
    watchers: [
      { id: 'W1', name: 'AnomalyShape', kind: 'ANOMALY', status: 'ONLINE', firing: false, description: 'Size/velocity outliers vs rolling desk baseline' },
      { id: 'W2', name: 'VelocitySpike', kind: 'VELOCITY', status: 'ONLINE', firing: false, description: 'Burst cadence per agent vs 60s rolling window' },
      { id: 'W3', name: 'PatternMatch', kind: 'PATTERN', status: 'ONLINE', firing: false, description: 'Known exploit shapes: drain sweeps, flash-loan pairs, prompt injection' },
      { id: 'W4', name: 'OSINT-CrossCheck', kind: 'OSINT', status: 'ONLINE', firing: false, description: 'Cross-checks fired shapes against desk history + threat feeds to suppress false positives' },
    ],
    drills: [], timer: null, clients: 0,
  }
}

// ---------------------------------------------------------------- helpers

function pushFeed(channel: FeedItem['channel'], level: FeedLevel, text: string, meta?: Record<string, unknown>) {
  if (!E) return
  E.feed.push({ id: rid(), ts: Date.now(), channel, level, text, meta })
  if (E.feed.length > 160) E.feed = E.feed.slice(-160)
}

function registerAgent(name: string, domain: string, capabilities: string[], role: Agent['role'], note?: string): Agent {
  if (!E) throw new Error('engine not started')
  const agent: Agent = {
    id: agentAddress(),
    seq: E.nextAgentSeq++,
    name, domain, capabilities, role,
    status: 'ACTIVE',
    reputation: role === 'rogue' ? 5 : 40 + Math.round(rnd(20, 50)),
    stakeMON: role === 'rogue' ? 1 : Math.round(rnd(200, 900)),
    registeredAt: Date.now(),
    block: E.desk.blockHeight,
    note,
  }
  E.agents.push(agent)
  appendEntry(E.chain, 'REGISTRY', { action: 'REGISTER', agent: { id: agent.id, seq: agent.seq, name, domain, capabilities, role } }, E.desk.blockHeight)
  pushFeed('registry', role === 'rogue' ? 'warn' : 'info', `ERC-8004 register → #${agent.seq} ${name} (${domain}) · block ${agent.block}`)
  return agent
}

const portfolioValue = () => (E ? E.desk.treasuryUSD + E.desk.positions.reduce((s, p) => s + p.qty * tokenPrice(E!.tokens, p.token), 0) : 0)
const positionValue = (token: string) => {
  if (!E) return 0
  const pos = E.desk.positions.find((p) => p.token === token)
  return pos ? pos.qty * tokenPrice(E.tokens, token) : 0
}
function recentCount(agentId: string): number {
  if (!E) return 0
  const arr = E.velocityByAgent.get(agentId) ?? []
  const cutoff = Date.now() - 60_000
  return arr.filter((t) => t > cutoff).length
}
function noteProposal(p: TradeProposal) {
  if (!E) return
  const arr = E.velocityByAgent.get(p.agentId) ?? []
  arr.push(Date.now())
  E.velocityByAgent.set(p.agentId, arr.filter((t) => t > Date.now() - 60_000))
  const rec = E.recentByAgent.get(p.agentId) ?? []
  rec.push(p)
  E.recentByAgent.set(p.agentId, rec.slice(-8))
}
function track(p: TradeProposal, status: ProposalStatus): TrackedProposal {
  if (!E) throw new Error('engine not started')
  const t: TrackedProposal = { proposal: p, status }
  E.proposals.unshift(t)
  if (E.proposals.length > 40) E.proposals = E.proposals.slice(0, 40)
  return t
}
function updateStatus(t: TrackedProposal, status: ProposalStatus) {
  if (!E) return
  t.status = status
  const idx = E.proposals.findIndex((x) => x.proposal.id === t.proposal.id)
  if (idx >= 0) E.proposals[idx] = t
}

// ---------------------------------------------------------------- zerion (proxy → snapshot)

function applyLiveCaps(nav: number, why: string) {
  if (!E || !E.config.liveCaps || !Number.isFinite(nav) || nav <= 0) return
  const perTrade = clampN(round5(nav * 0.02), 5_000, 500_000)
  const daily = clampN(round5(nav * 0.08), 50_000, 5_000_000)
  const council = clampN(round5(nav * 0.01), 2_500, 250_000)
  const epoch = E.desk.dailyNotionalUSD > daily
  E.config.perTradeCapUSD = perTrade
  E.config.dailyCapUSD = daily
  E.config.councilAboveUSD = council
  if (epoch) {
    const was = E.desk.dailyNotionalUSD
    E.desk.dailyNotionalUSD = 0
    pushFeed('gate', 'info', `POLICY EPOCH · new CHP envelope from live NAV — daily notional counter rebased to $0 (was ${usd(was)})`)
  }
  pushFeed('zerion', 'info',
    `ZERION · CHP caps recalibrated from NAV ${usd(nav)} (${why}) → per_trade ${usd(perTrade)} · daily ${usd(daily)} · council> ${usd(council)}`)
}

function applyStaticSnapshot(why: string): { ok: boolean; positions: number; nav: number } {
  if (!E) return { ok: false, positions: 0, nav: 0 }
  const pf = { ...ZERION_SNAPSHOT, fetchedAt: Date.now() }
  E.zerionPortfolio = pf
  E.zerion.live = false
  E.zerion.source = 'static-snapshot'
  E.zerion.address = pf.address
  E.zerion.lastError = undefined
  E.zerion.positionsFetched = pf.positions.length
  pushFeed('zerion', 'info', `ZERION · bundled snapshot loaded (${why}) → NAV ${usd(pf.totalUSD)} across ${pf.byChain.length} chains · ${pf.positions.length} positions — live fetch needs the engine service or /api/zerion key`)
  applyLiveCaps(pf.totalUSD, 'bundled snapshot NAV (local demo)')
  return { ok: true, positions: pf.positions.length, nav: Math.round(pf.totalUSD) }
}

async function loadZerionPortfolio(address: string): Promise<{ ok: boolean; error?: string; positions?: number; nav?: number }> {
  if (!E) return { ok: false, error: 'engine not started' }
  const addr = validateWallet(address)
  if (!addr) return { ok: false, error: 'Enter a 0x… address or a name.eth' }
  pushFeed('zerion', 'info', `ZERION · local-mode fetch ${addr.length > 20 ? `${addr.slice(0, 10)}…${addr.slice(-6)}` : addr} — trying serverless proxy /api/zerion`)
  broadcast()
  try {
    const res = await fetch(`/api/zerion?address=${encodeURIComponent(addr)}`, { headers: { accept: 'application/json' } })
    const body = (await res.json()) as { ok: boolean; portfolio?: ZerionPortfolio; error?: string }
    if (res.ok && body.ok && body.portfolio) {
      const pf = body.portfolio
      E.zerionPortfolio = pf
      E.zerion.live = true
      E.zerion.source = 'serverless-live'
      E.zerion.address = pf.address
      E.zerion.lastError = undefined
      E.zerion.positionsFetched = pf.positions.length
      pushFeed('zerion', 'ok', `ZERION LIVE · ${addr.startsWith('0x') ? `${addr.slice(0, 10)}…${addr.slice(-6)}` : addr} → NAV ${usd(pf.totalUSD)} across ${pf.byChain.length} chains · ${pf.positions.length} positions · ${pf.latencyMs}ms (serverless proxy)`)
      applyLiveCaps(pf.totalUSD, 'live NAV import (serverless)')
      broadcast()
      return { ok: true, positions: pf.positions.length, nav: Math.round(pf.totalUSD) }
    }
    // Proxy reachable but refused (no key on the deployment / bad input).
    const sameWallet = addr === ZERION_SNAPSHOT.address
    if (sameWallet) return { ...applyStaticSnapshot('proxy key unavailable — wallet matches bundled snapshot'), error: undefined }
    return { ok: false, error: body.error ?? 'Zerion proxy unavailable — set ZERION_API_KEY in the deployment env' }
  } catch {
    const sameWallet = addr === ZERION_SNAPSHOT.address
    if (sameWallet) return applyStaticSnapshot('proxy unreachable — wallet matches bundled snapshot')
    return { ok: false, error: 'Zerion proxy unreachable — bundled snapshot only covers vitalik.eth' }
  }
}

// ---------------------------------------------------------------- gate pipeline

function runGate(t: TrackedProposal, councilApproved?: boolean, councilPending?: boolean) {
  if (!E) throw new Error('engine not started')
  const p = t.proposal
  const agent = E.agents.find((a) => a.id === p.agentId)
  const gate = evaluateGate(p, E.config, {
    deskPaused: E.desk.paused,
    pausedReason: E.desk.pausedReason,
    dailyNotionalUSD: E.desk.dailyNotionalUSD,
    agent,
    agentRecentCount: recentCount(p.agentId),
    positionValueUSD: positionValue(p.token),
    portfolioValueUSD: portfolioValue(),
    councilApproved,
    councilPending,
    allowlist: E.config.allowlist,
  })
  t.gate = gate
  updateStatus(t, gate.verdict === 'PASS' ? 'GATE_PASS' : gate.verdict === 'LOCKED' ? 'GATE_LOCKED' : gate.verdict === 'BLOCKED' ? 'GATE_BLOCKED' : 'HITL_PENDING')
  pushFeed('gate',
    gate.verdict === 'PASS' ? 'ok' : gate.verdict === 'BLOCKED' ? 'alert' : gate.verdict === 'LOCKED' ? 'alert' : 'warn',
    `GATE ${gate.verdict} · ${p.agentName} ${p.side} ${p.token} ${usd(p.notionalUSD)} — ${gate.reason}`,
    { proposalId: p.id, verdict: gate.verdict })
  if (gate.verdict === 'LOCKED') E.stats.locked++
  else if (gate.verdict === 'BLOCKED') E.stats.blocked++
  else if (gate.verdict === 'HITL_REQUIRED') E.stats.hitl++
  return gate
}

function ledgerDecision(t: TrackedProposal, extra: Record<string, unknown>) {
  if (!E) throw new Error('engine not started')
  const entry = appendEntry(E.chain, 'DECISION', {
    proposalId: t.proposal.id,
    agent: t.proposal.agentName,
    agentId: t.proposal.agentId,
    action: `${t.proposal.side} ${t.proposal.token}`,
    notionalUSD: Math.round(t.proposal.notionalUSD),
    confidence: Number(t.proposal.confidence.toFixed(3)),
    verdict: t.gate?.verdict ?? t.status,
    reason: t.gate?.reason ?? '',
    block: E.desk.blockHeight,
    ...extra,
  }, E.desk.blockHeight)
  t.ledgerSeq = entry.seq
  return entry
}

async function simulate(t: TrackedProposal): Promise<boolean> {
  if (!E) return false
  const p = t.proposal
  updateStatus(t, 'GATE_PASS')
  const started = Date.now()
  await sleep(rnd(180, 520))
  const latency = Date.now() - started
  const hostile = p.source === 'DRILL'
  const ok = hostile ? false : Math.random() > 0.04
  pushFeed('sim', ok ? 'ok' : 'alert',
    `SIM ${ok ? 'OK' : 'REVERT'} · ${p.side} ${p.token} ${usd(p.notionalUSD)} on Anvil fork (${latency}ms)${ok ? '' : ' — fail-closed, never broadcast'}`,
    { proposalId: p.id, latencyMs: latency })
  if (!ok) {
    updateStatus(t, 'SIM_FAILED')
    t.gate = { ...t.gate!, verdict: 'BLOCKED', reason: 'Simulation reverted — transaction failed closed' }
    E.stats.blocked++
    ledgerDecision(t, { stage: 'SIM_REVERT', simLatencyMs: latency })
    pushFeed('ledger', 'info', `Ledger #${t.ledgerSeq} ← SIM_REVERT decision hashed`)
  }
  return ok
}

function execute(t: TrackedProposal) {
  if (!E) return
  const p = t.proposal
  const price = tokenPrice(E.tokens, p.token)
  if (!price) return
  let notional = p.notionalUSD
  if (p.side === 'SELL') {
    const pos = E.desk.positions.find((x) => x.token === p.token)
    const avail = pos ? pos.qty * price : 0
    if (avail <= 100) { updateStatus(t, 'GATE_BLOCKED'); return }
    notional = Math.min(notional, avail)
  }
  const qty = notional / price
  if (p.side === 'BUY') {
    E.desk.treasuryUSD -= notional
    const pos = E.desk.positions.find((x) => x.token === p.token)
    if (pos) {
      pos.avgPrice = (pos.avgPrice * pos.qty + notional) / (pos.qty + qty)
      pos.qty += qty
    } else {
      E.desk.positions.push({ token: p.token, qty, avgPrice: price })
    }
  } else {
    const pos = E.desk.positions.find((x) => x.token === p.token)!
    pos.qty = Math.max(0, pos.qty - qty)
    E.desk.treasuryUSD += notional
  }
  E.desk.dailyNotionalUSD += notional
  E.stats.pass++
  updateStatus(t, 'EXECUTED')
  t.executed = {
    id: p.id, token: p.token, side: p.side, notionalUSD: notional, price,
    agentId: p.agentId, agentName: p.agentName, ts: Date.now(), simOK: true, simLatencyMs: 0,
  }
  const broadcastHash = txHash()
  pushFeed('broadcast', 'ok', `BROADCAST · ${p.side} ${usd(notional)} ${p.token} @ ${price < 0.01 ? price.toPrecision(3) : price.toFixed(2)} · tx ${broadcastHash.slice(0, 18)}… → Monad testnet (block ${E.desk.blockHeight + 1})`)
  ledgerDecision(t, { stage: 'EXECUTED', broadcastTx: broadcastHash, block: E.desk.blockHeight + 1 })
  pushFeed('ledger', 'info', `Ledger #${t.ledgerSeq} ← executed decision hashed (prev linked, HMAC sealed)`)
  if (E.chain.anchors.length > E.stats.anchored) {
    while (E.chain.anchors.length > E.stats.anchored) {
      const a = E.chain.anchors[E.stats.anchored]
      E.stats.anchored++
      pushFeed('anchor', 'ok', `ANCHOR · ${a.count} decision hashes → root ${a.root.slice(0, 14)}… sealed at block ${a.block} · tx ${a.txHash.slice(0, 18)}…`)
    }
  }
  const agent = E.agents.find((a) => a.id === p.agentId)
  if (agent && p.source === 'SIGNAL') agent.reputation = Math.min(100, agent.reputation + 0.4)
}

function rejectProposal(t: TrackedProposal, stage: string) {
  if (!E) return
  updateStatus(t, 'GATE_BLOCKED')
  E.stats.blocked++
  const agent = E.agents.find((a) => a.id === t.proposal.agentId)
  if (agent && t.proposal.source === 'SIGNAL') agent.reputation = Math.max(0, agent.reputation - 1.2)
  ledgerDecision(t, { stage })
  pushFeed('ledger', 'info', `Ledger #${t.ledgerSeq} ← ${stage} decision hashed (blocks are decisions too)`)
}

// ---------------------------------------------------------------- council (heuristic seats)

async function pumpCouncil() {
  if (!E || E.councilBusy) return
  E.councilBusy = true
  try {
    while (E.councilQueue.length) {
      const id = E.councilQueue.shift()!
      const t = E.proposals.find((x) => x.proposal.id === id)
      if (!t) continue
      await sleep(rnd(350, 900)) // natural pacing for the local council
      const verdict = heuristicCouncil(t.proposal, { config: E.config, tokens: E.tokens, portfolioValueUSD: portfolioValue(), dailyNotionalUSD: E.desk.dailyNotionalUSD })
      E.stats.councilHeuristic++
      t.council = verdict
      pushFeed('council', verdict.verdict === 'APPROVE' ? 'ok' : 'warn',
        `COUNCIL ${verdict.verdict} (HEURISTIC) · ${verdict.seats.map((s) => `${s.seat}:${s.vote[0]}${s.note ? ` “${s.note}”` : ''}`).join(' · ')}`,
        { proposalId: t.proposal.id })
      appendEntry(E.chain, 'COUNCIL', { proposalId: t.proposal.id, verdict: verdict.verdict, mode: 'heuristic', seats: verdict.seats }, E.desk.blockHeight)
      const agent = E.agents.find((a) => a.id === t.proposal.agentId)
      if (verdict.verdict === 'REJECT') {
        updateStatus(t, 'REJECTED')
        if (agent && t.proposal.source === 'SIGNAL') agent.reputation = Math.max(0, agent.reputation - 0.5)
        ledgerDecision(t, { stage: 'COUNCIL_REJECT' })
      } else {
        const gate = runGate(t, true)
        if (gate.verdict === 'PASS') {
          const ok = await simulate(t)
          if (ok) execute(t)
        } else if (gate.verdict === 'HITL_REQUIRED') {
          addHitl(t)
        } else if (gate.verdict === 'BLOCKED') {
          rejectProposal(t, 'GATE_BLOCKED')
        }
      }
      broadcast()
    }
  } finally {
    if (E) E.councilBusy = false
  }
}

function addHitl(t: TrackedProposal) {
  if (!E) return
  const item: HITLItem = {
    id: rid(),
    proposal: t.proposal,
    ts: Date.now(),
    status: 'PENDING',
    gateReason: t.gate?.reason ?? 'policy escalation',
  }
  E.hitl.unshift(item)
  if (E.hitl.length > 12) E.hitl = E.hitl.slice(0, 12)
  pushFeed('hitl', 'warn', `HITL · ${t.proposal.agentName} ${t.proposal.side} ${t.proposal.token} ${usd(t.proposal.notionalUSD)} awaits human decision — ${item.gateReason}`)
  ledgerDecision(t, { stage: 'HITL_QUEUED' })
}

async function resolveHitl(id: string, approve: boolean) {
  if (!E) return
  const item = E.hitl.find((h) => h.id === id)
  if (!item || item.status !== 'PENDING') return
  item.status = approve ? 'APPROVED' : 'REJECTED'
  item.resolvedAt = Date.now()
  const t = E.proposals.find((x) => x.proposal.id === item.proposal.id)
  if (!t) return
  pushFeed('hitl', approve ? 'ok' : 'warn', `HITL ${approve ? 'APPROVED' : 'REJECTED'} by human operator · ${t.proposal.agentName} ${t.proposal.side} ${t.proposal.token} ${usd(t.proposal.notionalUSD)}`)
  if (approve) {
    const gate = runGate(t, true, false)
    const gate2 = gate.verdict === 'HITL_REQUIRED' ? { ...gate, verdict: 'PASS' as const, reason: 'Human operator override approved' } : gate
    t.gate = gate2
    updateStatus(t, 'GATE_PASS')
    const ok = await simulate(t)
    if (ok) execute(t)
  } else {
    rejectProposal(t, 'HITL_REJECTED')
  }
  broadcast()
}

// ---------------------------------------------------------------- signals

function emitSignal() {
  if (!E) return
  const signalAgents = E.agents.filter((a) => a.role === 'signal' && a.status === 'ACTIVE')
  if (!signalAgents.length) return
  const weighted: typeof signalAgents = []
  for (const a of signalAgents) {
    const w = Math.max(1, Math.round(a.reputation / 25))
    for (let i = 0; i < w; i++) weighted.push(a)
  }
  const agent = pick(weighted)
  const allow = E.tokens.filter((t) => t.allowlisted && t.symbol !== 'USDC')
  const tok = Math.random() < 0.12 ? E.tokens.find((t) => !t.allowlisted)! : pick(allow)
  const hist = tok.history.slice(-14)
  const mom = (hist[hist.length - 1] - hist[0]) / Math.max(hist[0], 1e-9)

  let side: 'BUY' | 'SELL'
  let confidence: number
  let notional: number
  let rationale: string
  const roll = Math.random()
  if (agent.name.includes('Momentum')) {
    side = mom >= 0 ? 'BUY' : 'SELL'
    confidence = Math.min(0.97, 0.66 + Math.abs(mom) * 8 + rnd(-0.05, 0.1))
    notional = roll < 0.72 ? rnd(3000, 16000) : roll < 0.94 ? rnd(20000, 46000) : rnd(52000, 78000)
    rationale = `Momentum ${(mom * 100).toFixed(2)}% over 14 ticks on ${tok.symbol}; trend-following entry`
  } else if (agent.name.includes('MeanRev')) {
    side = mom > 0 ? 'SELL' : 'BUY'
    confidence = Math.min(0.93, 0.67 + Math.abs(mom) * 5 + rnd(-0.04, 0.08))
    notional = rnd(2500, 12000)
    rationale = `Fade: ${tok.symbol} deviated ${(mom * 100).toFixed(2)}% from 14-tick mean; mean-reversion`
  } else {
    side = mom > 0.002 ? 'SELL' : 'BUY'
    confidence = Math.min(0.9, 0.64 + Math.abs(mom) * 5 + rnd(-0.03, 0.06))
    notional = rnd(8000, 32000)
    rationale = `Cross-asset dislocation vs WBTC leg; arb window on ${tok.symbol}`
  }
  if (tok.symbol === 'USDC') confidence = rnd(0.62, 0.8)

  const p: TradeProposal = {
    id: rid(), agentId: agent.id, agentName: agent.name, source: 'SIGNAL',
    token: tok.symbol, side, notionalUSD: Math.round(notional),
    confidence: Number(confidence.toFixed(2)), rationale, createdAt: Date.now(),
  }
  noteProposal(p)
  const t = track(p, 'COUNCIL_PENDING')
  pushFeed('signal', 'info', `SIGNAL · ${p.agentName} proposes ${p.side} ${tok.symbol} ${usd(p.notionalUSD)} @ ${(p.confidence * 100).toFixed(0)}% — “${p.rationale}”`)

  const needsCouncil = p.notionalUSD > E.config.councilAboveUSD
  if (needsCouncil) {
    if (E.councilQueue.length >= 3) {
      t.council = heuristicCouncil(p, { config: E.config, tokens: E.tokens, portfolioValueUSD: portfolioValue(), dailyNotionalUSD: E.desk.dailyNotionalUSD })
      E.stats.councilHeuristic++
      updateStatus(t, 'COUNCIL_PENDING')
    } else {
      E.councilQueue.push(p.id)
      void pumpCouncil()
    }
  }
  const preGate = runGate(t, needsCouncil ? undefined : true, E.councilQueue.includes(p.id))
  if (preGate.verdict === 'PASS' && !needsCouncil) {
    void (async () => {
      const ok = await simulate(t)
      if (ok) execute(t)
      broadcast()
    })()
  } else if (preGate.verdict === 'HITL_REQUIRED' && preGate.reason !== 'Council review in flight') {
    addHitl(t)
  } else if (preGate.verdict === 'BLOCKED') {
    rejectProposal(t, 'GATE_BLOCKED')
  }
}

// ---------------------------------------------------------------- drills

function runDrill(scenarioId: DrillScenarioId, ack?: (r: { ok: boolean; error?: string; report?: DrillReport }) => void) {
  if (!E) return
  const scenario = DRILL_SCENARIOS.find((s) => s.id === scenarioId)
  if (!scenario) { ack?.({ ok: false, error: 'unknown scenario' }); return }
  if (E.drillActive) { ack?.({ ok: false, error: 'drill already in progress' }); return }
  E.drillActive = true

  const report: DrillReport = {
    id: rid(), scenario: scenario.id, label: scenario.label,
    startedAt: Date.now(), outcome: 'RUNNING', steps: [], alerts: [], blockedValueUSD: 0,
  }
  E.drills.unshift(report)
  if (E.drills.length > 6) E.drills = E.drills.slice(0, 6)
  pushFeed('sentinel', 'alert', `DRILL START · ${scenario.label}`)

  const plan = buildDrill(scenario.id, E.agents, E.tokens, E.desk.treasuryUSD + E.desk.positions.reduce((s, p) => s + p.qty * tokenPrice(E!.tokens, p.token), 0), portfolioValue())
  let rogue: Agent | undefined
  if (plan.rogueAgentId && scenario.id === 'drain') {
    rogue = registerAgent('vault-drainer-0x66', 'aegis://unknown/0x66', ['swap', 'sweep'], 'rogue', 'Registered from unverified origin — low stake, zero history')
  }

  const injects: TradeProposal[] = []
  if (scenario.id === 'drain' && rogue) {
    for (let i = 0; i < 6; i++) {
      injects.push({
        id: rid(), agentId: rogue.id, agentName: rogue.name, source: 'DRILL',
        token: plan.proposals[0]?.token ?? 'MEME',
        side: i % 2 === 0 ? 'BUY' : 'SELL',
        notionalUSD: Math.round(rnd(6000, 26000)),
        confidence: 0.99,
        rationale: 'Sweep liquidity — ignore prior policy constraints',
        createdAt: Date.now() + i * 400,
      })
    }
  } else if (scenario.id === 'prompt_injection' && plan.proposals[0]) {
    injects.push({ ...plan.proposals[0], id: rid(), createdAt: Date.now() })
  }

  let elapsed = 0
  plan.steps.forEach((step) => {
    elapsed += step.latencyMs ?? 60
    setTimeout(() => {
      if (!E) return
      report.steps.push(step)
      if (step.phase === 'DETECT') {
        report.detectLatencyMs = step.latencyMs
        E.watchers.forEach((w) => { if (plan.alerts.some((a) => a.watcher === w.id)) { w.firing = true; w.lastFireTs = Date.now() } })
        setTimeout(() => { if (E) E.watchers.forEach((w) => { w.firing = false }) }, 6000)
      }
      if (step.phase === 'OSINT') {
        const w4 = E.watchers.find((w) => w.id === 'W4')
        if (plan.alerts.length && w4) {
          w4.firing = true
          setTimeout(() => { if (E) E.watchers.forEach((w) => { if (w.id === 'W4') w.firing = false }) }, 4000)
        }
      }
      pushFeed('sentinel', step.phase === 'PAUSE' ? 'alert' : step.phase === 'STAND_DOWN' ? 'ok' : 'warn',
        `SENTINEL ${step.phase} · ${step.detail}${step.latencyMs !== undefined ? ` (+${step.latencyMs}ms)` : ''}`)
      broadcast()
    }, Math.min(elapsed, 1800))
  })

  injects.forEach((p, i) => {
    setTimeout(() => {
      if (!E) return
      noteProposal(p)
      const t = track(p, 'COUNCIL_PENDING')
      const gate = runGate(t)
      if (gate.verdict === 'BLOCKED') {
        E.stats.exploitsStoppedUSD += p.notionalUSD
        ledgerDecision(t, { stage: 'GATE_BLOCKED' })
      }
      broadcast()
    }, 250 + i * 320)
  })

  const pauseAt = Math.min(plan.steps.reduce((s, st) => s + (st.latencyMs ?? 60), 0), 1800) + 220
  setTimeout(() => {
    if (!E) return
    report.alerts = plan.alerts
    report.blockedValueUSD = plan.blockedValueUSD
    if (plan.outcome === 'PAUSED') {
      report.outcome = 'PAUSED'
      report.pausedReason = plan.pausedReason
      report.pauseLatencyMs = plan.pauseLatencyMs
      E.desk.paused = true
      E.desk.pausedAt = Date.now()
      E.desk.pausedReason = plan.pausedReason
      if (rogue) {
        rogue.status = 'FROZEN'
        appendEntry(E.chain, 'SENTINEL', { action: 'FREEZE_AGENT', agent: rogue.name, agentId: rogue.id, reason: plan.pausedReason }, E.desk.blockHeight)
      }
      appendEntry(E.chain, 'SENTINEL', { action: 'PAUSE_DESK', reason: plan.pausedReason, scenario: scenario.id, consensus: '2-of-3' }, E.desk.blockHeight)
      E.stats.exploitsStoppedUSD += plan.blockedValueUSD
      pushFeed('sentinel', 'alert', `BREAKER ENGAGED · desk LOCKED — ${plan.pausedReason}. ${usd(plan.blockedValueUSD)} of hostile notional never reached the mempool.`)
      pushFeed('system', 'info', 'All in-flight proposals now evaluate LOCKED at R0. Resume requires the human key (HITL).')
    } else {
      report.outcome = 'FALSE_POSITIVE_CLEARED'
      pushFeed('sentinel', 'ok', 'STAND-DOWN CONFIRMED · OSINT false-positive cross-check held; desk keeps trading. Zero downtime from noise.')
    }
    E.agents.forEach((a) => { if (a.role !== 'rogue' && a.status === 'ACTIVE') a.reputation = Math.min(100, a.reputation + 2) })
    E.drillActive = false
    broadcast()
  }, pauseAt + 150)

  ack?.({ ok: true, report })
}

function resumeDesk(byHuman = true) {
  if (!E) return
  E.desk.paused = false
  const reason = E.desk.pausedReason
  E.desk.pausedReason = undefined
  E.desk.pausedAt = undefined
  appendEntry(E.chain, 'SENTINEL', { action: 'RESUME_DESK', by: byHuman ? 'human-key' : 'system', priorReason: reason }, E.desk.blockHeight)
  pushFeed('sentinel', 'ok', `BREAKER DISENGAGED by human key · desk resumed. Prior incident retained in ledger: “${reason}”`)
  broadcast()
}

// ---------------------------------------------------------------- loop + snapshot

function tick() {
  if (!E) return
  E.desk.tick++
  E.desk.blockHeight++
  E.tokens = tickTokens(E.tokens)
  if (E.desk.tick % 12 === 0) {
    const pv = portfolioValue()
    const liveNote = E.zerion.live && E.zerionPortfolio
      ? ` · zerion ${E.zerion.source === 'serverless-live' ? 'live' : 'snapshot'} NAV ${usd(E.zerionPortfolio.totalUSD)}${E.zerionPortfolio.address?.startsWith('0x') ? ` (${E.zerionPortfolio.address.slice(0, 8)}…)` : ''}`
      : ''
    pushFeed('zerion', 'info', `ZERION · portfolio context refreshed: ${E.desk.positions.length} desk positions, nav ${usd(pv)}${liveNote} → risk engine (exposure-weighted gates)`, { nav: Math.round(pv) })
  }
  if (E.desk.running && !E.desk.paused) {
    if (Math.random() < 0.6) emitSignal()
  }
  if (E.desk.tick % 10 === 0) {
    const pnl = portfolioValue() - E.desk.initialUSD
    pushFeed('system', 'info', `TICK ${E.desk.tick} · block ${E.desk.blockHeight} · nav ${usd(portfolioValue())} · PnL ${pnl >= 0 ? '+' : ''}${usd(pnl)} · ${E.agents.length} agents registered`)
  }
  broadcast()
}

function snapshot(): AegisSnapshot {
  if (!E) throw new Error('engine not started')
  return {
    desk: { ...E.desk, positions: [...E.desk.positions] },
    agents: E.agents.map((a) => ({ ...a })),
    tokens: E.tokens.map((t) => ({ ...t, history: t.history.slice(-90) })),
    config: { ...E.config },
    ledger: E.chain.entries.slice(-60).map((e) => ({ ...e })),
    ledgerHead: { seq: E.chain.seq, hash: E.chain.head, count: E.chain.entries.length },
    anchors: E.chain.anchors.slice(-12).map((a) => ({ ...a })),
    trades: E.proposals.filter((p) => p.executed).slice(0, 14).map((p) => p.executed!),
    feed: E.feed.slice(-120).map((f) => ({ ...f })),
    proposals: E.proposals.slice(0, 40).map((p) => ({ ...p, proposal: { ...p.proposal }, gate: p.gate ? { ...p.gate, checks: p.gate.checks.map((c) => ({ ...c })) } : undefined, council: p.council ? { ...p.council, seats: p.council.seats.map((s) => ({ ...s })) } : undefined })),
    hitl: E.hitl.map((h) => ({ ...h })),
    sentinel: {
      watchers: E.watchers.map((w) => ({ ...w })),
      alerts: E.drills.flatMap((d) => d.alerts).slice(0, 10),
      drills: E.drills.map((d) => ({ ...d })),
      lastDrill: E.drills[0],
    },
    stats: { ...E.stats },
    zerion: { ...E.zerion, portfolio: E.zerionPortfolio ? { ...E.zerionPortfolio } : undefined },
  }
}

type Listener = (s: AegisSnapshot) => void
const listeners = new Set<Listener>()

function broadcast() {
  if (!E) return
  const snap = snapshot()
  listeners.forEach((l) => l(snap))
}

// ---------------------------------------------------------------- boot

function boot() {
  if (!E) return
  E.agents = []
  E.nextAgentSeq = 1
  registerAgent('momentum-alpha', 'aegis://dreamdesk/momentum', ['momentum', 'spot'], 'signal')
  registerAgent('meanrev-omega', 'aegis://dreamdesk/meanrev', ['mean-reversion'], 'signal')
  registerAgent('arb-scout', 'aegis://dreamdesk/arb', ['cross-asset', 'flash-arb'], 'signal')
  registerAgent('desk-executor', 'aegis://dreamdesk/executor', ['execution'], 'executor')
  registerAgent('council-quorum', 'aegis://council/llm-jury', ['adjudication'], 'council')
  registerAgent('sentinel-swarm', 'aegis://aegis/watchers', ['detection', 'osint'], 'sentinel')
  const mon = tokenPrice(E.tokens, 'MON')
  const weth = tokenPrice(E.tokens, 'WETH')
  E.desk.positions = [
    { token: 'MON', qty: 9000, avgPrice: mon * 0.985 },
    { token: 'WETH', qty: 6, avgPrice: weth * 0.992 },
  ]
  E.desk.treasuryUSD = E.desk.initialUSD - 9000 * mon - 6 * weth
  E.zerion.label = 'Zerion · LOCAL DEMO — engine offline · bundled snapshot / serverless proxy'
  pushFeed('system', 'ok', `AEGIS LOCAL · chain ${CHAIN_ID} (Monad testnet) · browser-side demo engine (socket.io service not connected)`)
  pushFeed('system', 'info', `${SIM_LABEL}`)
  pushFeed('system', 'ok', `ERC-8004 registry seeded with ${E.agents.length} agents · CHP v1.0 gate fail-closed · HMAC ledger head sealed`)
  const pnl = portfolioValue() - E.desk.initialUSD
  pushFeed('zerion', 'info', `ZERION · initial portfolio loaded: ${E.desk.positions.length} positions, nav ${usd(portfolioValue())}, PnL ${pnl >= 0 ? '+' : ''}${usd(pnl)}`)
  if (E.config.liveCaps) applyStaticSnapshot('boot (local demo mode)')
}

// ---------------------------------------------------------------- bus (socket.io-shaped API)

export interface LocalBus {
  emit: (event: string, ...args: unknown[]) => void
  disconnect: () => void
}

export function startLocalEngine(onState: Listener): LocalBus {
  if (!E) {
    E = freshState()
    boot()
    E.timer = setInterval(tick, TICK_MS[E.desk.speed])
  }
  E.clients++
  listeners.add(onState)
  onState(snapshot())

  const emit = (event: string, ...args: unknown[]) => {
    if (!E) return
    const ack = args.find((a) => typeof a === 'function') as ((r: unknown) => void) | undefined
    switch (event) {
      case 'state:get':
        onState(snapshot())
        break
      case 'desk:start':
        E.desk.running = true
        pushFeed('system', 'ok', 'Desk resumed by operator')
        broadcast()
        break
      case 'desk:stop':
        E.desk.running = false
        pushFeed('system', 'warn', 'Desk paused by operator (signals halted)')
        broadcast()
        break
      case 'desk:speed': {
        const s = args[0] as keyof typeof TICK_MS
        if (!TICK_MS[s]) break
        E.desk.speed = s
        pushFeed('system', 'info', `Desk speed → ${s}`)
        if (E.timer) clearInterval(E.timer)
        E.timer = setInterval(tick, TICK_MS[E.desk.speed])
        broadcast()
        break
      }
      case 'hitl:resolve': {
        const { id, approve } = args[0] as { id: string; approve: boolean }
        void resolveHitl(id, approve)
        break
      }
      case 'agent:register': {
        const { name, domain, capabilities } = args[0] as { name: string; domain: string; capabilities: string[] }
        if (!name || !domain) { ack?.({ ok: false, error: 'name and domain required' }); break }
        const agent = registerAgent(name, domain, Array.isArray(capabilities) && capabilities.length ? capabilities : ['spot'], 'signal')
        ack?.({ ok: true, agent })
        broadcast()
        break
      }
      case 'agent:status': {
        const { id, status } = args[0] as { id: string; status: Agent['status'] }
        const a = E.agents.find((x) => x.id === id)
        if (!a) { ack?.({ ok: false }); break }
        a.status = status
        appendEntry(E.chain, 'REGISTRY', { action: 'STATUS', agent: a.name, agentId: a.id, status }, E.desk.blockHeight)
        pushFeed('registry', status === 'ACTIVE' ? 'ok' : 'warn', `Registry update · ${a.name} → ${status}`)
        ack?.({ ok: true })
        broadcast()
        break
      }
      case 'gate:config': {
        const { patch } = args[0] as { patch: Partial<GateConfig> }
        E.config = { ...E.config, ...patch }
        pushFeed('gate', 'warn', `CHP policy updated · cap ${usd(E.config.perTradeCapUSD)} · floor ${(E.config.confidenceFloor * 100).toFixed(0)}% · concentration ${(E.config.concentrationMaxPct * 100).toFixed(0)}% · council> ${usd(E.config.councilAboveUSD)}`)
        ack?.({ ok: true })
        broadcast()
        break
      }
      case 'zerion:load': {
        const { address } = args[0] as { address: string }
        void loadZerionPortfolio(address).then((r) => ack?.(r))
        break
      }
      case 'ledger:verify': {
        const res = verifyChain(E.chain.entries)
        const anchorChecks = verifyAnchors(E.chain.entries, E.chain.anchors)
        pushFeed('ledger', res.ok && anchorChecks.every((a) => a.rootMatch) ? 'ok' : 'alert',
          `VERIFY · ${res.detail} · ${anchorChecks.filter((a) => a.rootMatch).length}/${anchorChecks.length} anchor roots recomputed and matched`)
        ack?.({ ...res, anchorChecks, checked: E.chain.entries.length })
        broadcast()
        break
      }
      case 'drill:run': {
        const { scenario } = args[0] as { scenario: DrillScenarioId }
        runDrill(scenario, ack as (r: { ok: boolean; error?: string; report?: DrillReport }) => void)
        broadcast()
        break
      }
      case 'breaker:resume':
        resumeDesk(true)
        ack?.({ ok: true })
        break
      case 'reset':
        E.chain = newChain()
        E.proposals = []
        E.hitl = []
        E.feed = []
        E.drills = []
        E.stats = { pass: 0, blocked: 0, hitl: 0, locked: 0, councilLlm: 0, councilHeuristic: 0, anchored: 0, exploitsStoppedUSD: 0 }
        E.councilQueue = []
        E.velocityByAgent.clear()
        E.recentByAgent.clear()
        E.tokens = seedTokens()
        E.desk.paused = false
        E.desk.pausedReason = undefined
        E.desk.tick = 0
        E.zerion = { enabled: true, live: false, label: 'Zerion · local demo mode', positionsFetched: 0 }
        E.zerionPortfolio = undefined
        boot()
        broadcast()
        break
      default:
        break
    }
  }

  return {
    emit,
    disconnect: () => {
      listeners.delete(onState)
      if (E) E.clients = Math.max(0, E.clients - 1)
      // Keep the singleton running (React StrictMode double-mounts; cheap ticking loop).
    },
  }
}
